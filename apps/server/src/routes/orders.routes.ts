import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireAuth, type AuthedRequest } from '../lib/auth.js';
import { requireVerified } from '../lib/access.js';
import { createPaymobCheckout } from '../lib/paymob.js';
import { buyerProtectionFee as calcBuyerProtectionFee } from '../lib/pricing.js';
import { notifyOrderPlaced } from '../lib/email.js';

export const ordersRouter = Router();

const DELIVERY_METHODS = ['Meetup', 'UberCourier', 'InDrive', 'BostaMylerz'] as const;
const REVIEW_UNLOCK_WAIT_DAYS = 6;
const SELLER_PLUS_OFFER_THRESHOLD = 5;

const createOrderSchema = z.object({
  listingId: z.string().min(1)
});

/**
 * Shared by a direct Buy and by an accepted negotiation offer — `priceOverride`
 * lets an accepted offer create the order at the agreed amount instead of the
 * listing's asking price. Deal is finalized at payment/escrow, so the listing
 * comes off the active feed immediately either way.
 */
export async function createOrderForListing(listingId: string, buyerId: string, priceOverride?: number) {
  const listing = await prisma.listing.findUnique({ where: { id: listingId }, include: { seller: true } });
  if (!listing || listing.status !== 'Active') throw new Error('Listing is not available');
  if (listing.sellerId === buyerId) throw new Error('You cannot buy your own listing');

  const itemPrice = priceOverride ?? listing.price;
  const buyerProtectionFee = calcBuyerProtectionFee(itemPrice);

  // Two buyers tapping Buy at the same instant both pass the check above — what
  // actually decides the winner is this conditional UPDATE. Postgres locks the
  // row for the first transaction to reach it; by the time the second one runs
  // its own updateMany, status is already 'Sold', so it matches zero rows and
  // the whole transaction (including the order it hasn't created yet) aborts.
  const order = await prisma.$transaction(async (tx) => {
    const claim = await tx.listing.updateMany({ where: { id: listingId, status: 'Active' }, data: { status: 'Sold' } });
    if (claim.count === 0) throw new Error('This listing was just bought by someone else.');

    return tx.order.create({
      data: {
        buyerId,
        sellerId: listing.sellerId,
        listingId: listing.id,
        amount: itemPrice + buyerProtectionFee,
        buyerProtectionFee
      }
    });
  });

  // Fire-and-forget — the seller's only signal that an item sold before they
  // open the app themselves. Never blocks or fails the purchase.
  notifyOrderPlaced({
    sellerEmail: listing.seller.email,
    sellerName: listing.seller.username ?? listing.seller.fullName,
    itemTitle: listing.title,
    amount: itemPrice,
    orderId: order.id
  }).catch(() => {});

  return order;
}

// Delivery method is chosen afterwards, from inside the order chat — Buy only
// starts the payment hold and connects buyer and seller.
ordersRouter.post('/', requireAuth, requireVerified, async (req: AuthedRequest, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  try {
    const order = await createOrderForListing(parsed.data.listingId, req.userId!);
    return res.status(201).json({ order });
  } catch (err) {
    return res.status(409).json({ error: err instanceof Error ? err.message : 'Could not create order' });
  }
});

// Kicks off the real Paymob checkout — auth, order registration, and a payment
// key — and hands back the hosted iframe URL to redirect the buyer to. Escrow
// only actually starts once Paymob's webhook confirms a successful charge.
ordersRouter.post('/:id/pay', requireAuth, async (req: AuthedRequest, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { buyer: true } });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.buyerId !== req.userId) return res.status(403).json({ error: 'Only the buyer can pay for this order' });
  if (order.escrowStatus !== 'AwaitingPayment') return res.status(409).json({ error: 'This order is not awaiting payment' });

  try {
    const [firstName, ...rest] = order.buyer.fullName.split(' ');
    const { paymobOrderId, iframeUrl } = await createPaymobCheckout({
      amountEgp: order.amount,
      merchantOrderId: order.id,
      billing: { firstName, lastName: rest.join(' '), email: order.buyer.email, phone: '' }
    });
    await prisma.order.update({ where: { id: order.id }, data: { paymobOrderId } });
    return res.json({ iframeUrl });
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : 'Payment provider error' });
  }
});

const deliveryMethodSchema = z.object({ deliveryMethod: z.enum(DELIVERY_METHODS) });

ordersRouter.post('/:id/delivery-method', requireAuth, async (req: AuthedRequest, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.buyerId !== req.userId && order.sellerId !== req.userId) return res.status(403).json({ error: 'Not your order' });
  if (order.escrowStatus !== 'InEscrow') return res.status(409).json({ error: 'Delivery method can only be set once payment is confirmed' });

  const parsed = deliveryMethodSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  // BostaMylerz integration is "coming soon" per spec — not a live delivery option yet.
  if (parsed.data.deliveryMethod === 'BostaMylerz') {
    return res.status(422).json({ error: 'Integrated courier delivery is coming soon and not yet available.' });
  }

  const updated = await prisma.order.update({ where: { id: order.id }, data: { deliveryMethod: parsed.data.deliveryMethod } });
  return res.json({ order: updated });
});

ordersRouter.get('/mine', requireAuth, async (req: AuthedRequest, res) => {
  const orders = await prisma.order.findMany({
    where: { OR: [{ buyerId: req.userId }, { sellerId: req.userId }] },
    orderBy: { createdAt: 'desc' },
    include: {
      listing: { select: { title: true, images: true } },
      buyer: { select: { id: true, fullName: true, username: true } },
      seller: { select: { id: true, fullName: true, username: true } },
      chats: { orderBy: { createdAt: 'desc' }, take: 1 }
    }
  });

  const withUnread = orders.map((o) => {
    const isBuyer = o.buyerId === req.userId;
    const lastRead = isBuyer ? o.buyerLastReadAt : o.sellerLastReadAt;
    const latest = o.chats[0];
    const unread = Boolean(latest && latest.senderId !== req.userId && (!lastRead || latest.createdAt > lastRead));
    return { ...o, unread };
  });

  return res.json({ orders: withUnread });
});

ordersRouter.get('/:id', requireAuth, async (req: AuthedRequest, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      listing: true,
      trackingLinks: true,
      buyer: { select: { id: true, fullName: true, username: true } },
      seller: { select: { id: true, fullName: true, username: true } }
    }
  });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.buyerId !== req.userId && order.sellerId !== req.userId) return res.status(403).json({ error: 'Not your order' });
  return res.json({ order });
});

ordersRouter.post('/:id/confirm-delivery', requireAuth, async (req: AuthedRequest, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.buyerId !== req.userId) return res.status(403).json({ error: 'Only the buyer confirms delivery' });
  if (order.escrowStatus !== 'InEscrow') return res.status(409).json({ error: 'Order is not currently in escrow' });

  const now = new Date();
  const reviewUnlockAt = new Date(now.getTime() + REVIEW_UNLOCK_WAIT_DAYS * 24 * 60 * 60 * 1000);

  const [updatedOrder, seller] = await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        deliveryConfirmed: true,
        deliveryConfirmedAt: now,
        escrowStatus: 'PaymentReleased',
        paymentReleasedAt: now,
        reviewUnlockAt
      }
    }),
    prisma.user.update({ where: { id: order.sellerId }, data: { completedSalesCount: { increment: 1 } } })
  ]);

  const offerMonetizationChoice =
    seller.completedSalesCount === SELLER_PLUS_OFFER_THRESHOLD && !seller.monetizationMode;

  return res.json({ order: updatedOrder, offerMonetizationChoice });
});

// Mirrors the same escalation on an inquiry — opens a moderation case and
// drops a system notice into the order's own chat so admin can reply directly
// into it (as 'admin') once they pick up the case.
ordersRouter.post('/:id/sos', requireAuth, async (req: AuthedRequest, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { listing: { select: { title: true } } } });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.buyerId !== req.userId && order.sellerId !== req.userId) return res.status(403).json({ error: 'Not your order' });

  const requester = req.userId === order.buyerId ? 'the buyer' : 'the seller';
  await prisma.$transaction([
    prisma.moderationCase.create({
      data: {
        contextType: 'order',
        contextId: order.id,
        reason: `SOS raised by ${requester} on "${order.listing.title}"`,
        status: 'open'
      }
    }),
    prisma.chat.create({
      data: {
        orderId: order.id,
        senderId: 'system',
        messageText: '🆘 Second Look Support has been notified and will join this chat shortly.'
      }
    })
  ]);

  return res.status(201).json({ ok: true });
});

ordersRouter.post('/:id/dispute', requireAuth, async (req: AuthedRequest, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.buyerId !== req.userId && order.sellerId !== req.userId) return res.status(403).json({ error: 'Not your order' });

  const updated = await prisma.order.update({ where: { id: order.id }, data: { escrowStatus: 'Disputed' } });
  await prisma.moderationCase.create({
    data: { contextType: 'order', contextId: order.id, reason: 'Order marked disputed by a party', status: 'open' }
  });
  return res.json({ order: updated });
});

const trackingLinkSchema = z.object({ url: z.string().url() });

ordersRouter.post('/:id/tracking-link', requireAuth, async (req: AuthedRequest, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.buyerId !== req.userId && order.sellerId !== req.userId) return res.status(403).json({ error: 'Not your order' });

  const parsed = trackingLinkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  // Unconditionally saved to the order record and visible to ops — not gated behind a report.
  const link = await prisma.trackingLink.create({ data: { orderId: order.id, url: parsed.data.url } });
  return res.status(201).json({ trackingLink: link });
});

ordersRouter.post('/monetization-mode', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = z.object({ mode: z.enum(['commission', 'seller_plus']) }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const user = await prisma.user.update({ where: { id: req.userId }, data: { monetizationMode: parsed.data.mode } });
  return res.json({ monetizationMode: user.monetizationMode });
});
