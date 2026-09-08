import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireAuth, type AuthedRequest } from '../lib/auth.js';
import { requireVerified } from '../lib/access.js';

export const ordersRouter = Router();

const DELIVERY_METHODS = ['Meetup', 'UberCourier', 'InDrive', 'BostaMylerz'] as const;
const REVIEW_UNLOCK_WAIT_DAYS = 6;
const SELLER_PLUS_OFFER_THRESHOLD = 5;

const createOrderSchema = z.object({
  listingId: z.string().min(1)
});

// Delivery method is chosen afterwards, from inside the order chat — Buy only
// starts the payment hold and connects buyer and seller.
ordersRouter.post('/', requireAuth, requireVerified, async (req: AuthedRequest, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const listing = await prisma.listing.findUnique({ where: { id: parsed.data.listingId } });
  if (!listing || listing.status !== 'Active') return res.status(409).json({ error: 'Listing is not available' });
  if (listing.sellerId === req.userId) return res.status(422).json({ error: 'You cannot buy your own listing' });

  const [order] = await prisma.$transaction([
    prisma.order.create({
      data: {
        buyerId: req.userId!,
        sellerId: listing.sellerId,
        listingId: listing.id,
        amount: listing.price
      }
    }),
    // Deal is finalized at payment/escrow, so the listing comes off the active feed immediately.
    prisma.listing.update({ where: { id: listing.id }, data: { status: 'Sold' } })
  ]);

  return res.status(201).json({ order });
});

const deliveryMethodSchema = z.object({ deliveryMethod: z.enum(DELIVERY_METHODS) });

ordersRouter.post('/:id/delivery-method', requireAuth, async (req: AuthedRequest, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.buyerId !== req.userId && order.sellerId !== req.userId) return res.status(403).json({ error: 'Not your order' });

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
      buyer: { select: { id: true, fullName: true } },
      seller: { select: { id: true, fullName: true } },
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
      buyer: { select: { id: true, fullName: true } },
      seller: { select: { id: true, fullName: true } }
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
