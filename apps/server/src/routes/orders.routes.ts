import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireAuth, type AuthedRequest } from '../lib/auth.js';
import { requireVerified } from '../lib/access.js';
import { createPaymobCheckout } from '../lib/paymob.js';
import { buyerProtectionFee as calcBuyerProtectionFee } from '../lib/pricing.js';
import { notifyOrderPlaced } from '../lib/email.js';
import { awardPoints, awardCharm, POINTS } from '../lib/points.js';

export const ordersRouter = Router();

const DELIVERY_METHODS = ['Meetup', 'UberCourier', 'InDrive', 'BostaMylerz'] as const;
const REVIEW_UNLOCK_WAIT_DAYS = 6;
const SELLER_PLUS_OFFER_THRESHOLD = 5;
// Buy Now reserves the listing and opens chat right away, before any money moves —
// the buyer has this long to pick a delivery method (and pay, if it's a paid
// courier method) before the hold lazily expires and the listing reopens.
const HOLD_WINDOW_HOURS = 3;
// Safety net only — protects a seller whose buyer goes silent after a courier
// delivery, not the normal path. The buyer can still confirm early or dispute
// any time before this; only orders with no online payment held (Meetup) are
// exempt, since there's nothing sitting in escrow to release for those.
const AUTO_RELEASE_WINDOW_DAYS = 2;

const createOrderSchema = z.object({
  listingId: z.string().min(1)
});

/**
 * Shared by a direct Buy and by an accepted negotiation offer — `priceOverride`
 * lets an accepted offer create the order at the agreed amount instead of the
 * listing's asking price. Deal is finalized once a delivery method is chosen
 * (and paid, if required), but the listing comes off the active feed immediately
 * either way, guarded by `holdExpiresAt` in case the buyer never finishes.
 *
 * No buyer protection fee is charged yet — whether one applies at all depends
 * on the delivery method, chosen afterwards from inside the order chat.
 */
export async function createOrderForListing(listingId: string, buyerId: string, priceOverride?: number) {
  const listing = await prisma.listing.findUnique({ where: { id: listingId }, include: { seller: true } });
  if (!listing || listing.status !== 'Active') throw new Error('Listing is not available');
  if (listing.sellerId === buyerId) throw new Error('You cannot buy your own listing');

  const itemPrice = priceOverride ?? listing.price;
  const holdExpiresAt = new Date(Date.now() + HOLD_WINDOW_HOURS * 60 * 60 * 1000);

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
        amount: itemPrice,
        holdExpiresAt
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

/**
 * Called once a birthday gift pool tied to a real listing hits its target — the
 * money was already collected across many separate contributor charges (see
 * payments.routes.ts's `giftpool_` webhook branch), so unlike createOrderForListing
 * there is no buyer payment to collect here: the order is created directly in
 * InEscrow, with paymobOrderId left null and giftPoolId set for the audit trail
 * back to the individual contributions if it's ever disputed.
 */
export async function createOrderFromGiftPool(poolId: string, listingId: string, buyerId: string) {
  const listing = await prisma.listing.findUnique({ where: { id: listingId }, include: { seller: true } });
  if (!listing || listing.status !== 'Active') throw new Error('Listing is not available');
  if (listing.sellerId === buyerId) throw new Error('You cannot buy your own listing');

  const buyerProtectionFee = calcBuyerProtectionFee(listing.price);

  const order = await prisma.$transaction(async (tx) => {
    const claim = await tx.listing.updateMany({ where: { id: listingId, status: 'Active' }, data: { status: 'Sold' } });
    if (claim.count === 0) throw new Error('This listing was just bought by someone else.');

    return tx.order.create({
      data: {
        buyerId,
        sellerId: listing.sellerId,
        listingId: listing.id,
        amount: listing.price + buyerProtectionFee,
        buyerProtectionFee,
        escrowStatus: 'InEscrow',
        giftPoolId: poolId
      }
    });
  });

  notifyOrderPlaced({
    sellerEmail: listing.seller.email,
    sellerName: listing.seller.username ?? listing.seller.fullName,
    itemTitle: listing.title,
    amount: listing.price,
    orderId: order.id
  }).catch(() => {});

  return order;
}

/**
 * Lazy expiry, run on read — matches this codebase's existing preference (see
 * birthdays.routes.ts's expireOverduePools) over a background job. A buyer who
 * never finishes picking a delivery method (and paying, if required) within the
 * hold window loses the reservation; the listing goes back to Active so it
 * isn't stuck off the marketplace for someone who abandoned the purchase.
 */
async function expireStaleOrders() {
  const stale = await prisma.order.findMany({
    where: { escrowStatus: { in: ['AwaitingDeliveryMethod', 'AwaitingPayment'] }, holdExpiresAt: { lt: new Date() } },
    select: { id: true, listingId: true }
  });
  for (const order of stale) {
    await prisma.$transaction([
      prisma.order.update({ where: { id: order.id }, data: { escrowStatus: 'Expired' } }),
      prisma.listing.updateMany({ where: { id: order.listingId, status: 'Sold' }, data: { status: 'Active' } })
    ]);
  }
}

/**
 * Shared by the buyer's manual Confirm delivery tap and the auto-release safety
 * net below — moves an order from InEscrow to PaymentReleased and runs the same
 * seller-side side effects (sale count, points, first-sale charm) either way.
 */
async function releaseOrderPayout(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.escrowStatus !== 'InEscrow') return null;

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

  await awardPoints(order.sellerId, POINTS.SALE_COMPLETED, 'sale_completed', order.id);
  if (seller.completedSalesCount === 1) await awardCharm(order.sellerId, 'first_sale');

  return { updatedOrder, seller };
}

/**
 * Safety net for a buyer who goes silent after a courier delivery — without
 * this, a seller could be stuck unpaid forever since only the buyer can tap
 * Confirm delivery. Only orders with real money in escrow qualify (Meetup has
 * none — cash changes hands in person), and only once AUTO_RELEASE_WINDOW_DAYS
 * has passed since the tracking link went up, giving the buyer a full window to
 * confirm early or dispute before anything moves automatically.
 */
async function autoReleaseStaleEscrow() {
  const cutoff = new Date(Date.now() - AUTO_RELEASE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const candidates = await prisma.order.findMany({
    where: {
      escrowStatus: 'InEscrow',
      deliveryMethod: { notIn: ['Meetup'] },
      trackingLinks: { some: { createdAt: { lt: cutoff } } }
    },
    select: { id: true }
  });
  for (const order of candidates) await releaseOrderPayout(order.id);
}

// Delivery method is chosen first, from inside the order chat — Buy only opens
// the chat and starts the hold window. Only a paid courier method then needs
// an actual payment; Meetup settles in person with nothing held in escrow.
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
  await expireStaleOrders();

  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { buyer: true } });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.buyerId !== req.userId) return res.status(403).json({ error: 'Only the buyer can pay for this order' });
  if (order.escrowStatus !== 'AwaitingPayment') return res.status(409).json({ error: 'This order is not awaiting payment — it may have expired.' });

  // Store credit (from a funded birthday gift pool with no linked listing) is
  // applied automatically to reduce what's actually charged — it can only ever
  // help the buyer, so there's no opt-out. Fully covering the order skips
  // Paymob entirely rather than initiating a zero/negative-amount charge.
  const creditToApply = Math.min(order.amount, order.buyer.storeCredit);
  const remaining = order.amount - creditToApply;

  if (creditToApply > 0) {
    await prisma.$transaction([
      prisma.user.update({ where: { id: order.buyerId }, data: { storeCredit: { decrement: creditToApply } } }),
      prisma.order.update({ where: { id: order.id }, data: { storeCreditApplied: creditToApply } })
    ]);
  }

  if (remaining <= 0) {
    await prisma.order.update({ where: { id: order.id }, data: { escrowStatus: 'InEscrow' } });
    return res.json({ settledWithCredit: true });
  }

  try {
    const [firstName, ...rest] = order.buyer.fullName.split(' ');
    const { paymobOrderId, iframeUrl } = await createPaymobCheckout({
      amountEgp: remaining,
      merchantOrderId: order.id,
      billing: { firstName, lastName: rest.join(' '), email: order.buyer.email, phone: '' }
    });
    await prisma.order.update({ where: { id: order.id }, data: { paymobOrderId } });
    return res.json({ iframeUrl });
  } catch (err) {
    // Paymob checkout failed to even initiate — restore the credit rather than losing it silently.
    if (creditToApply > 0) {
      await prisma.$transaction([
        prisma.user.update({ where: { id: order.buyerId }, data: { storeCredit: { increment: creditToApply } } }),
        prisma.order.update({ where: { id: order.id }, data: { storeCreditApplied: 0 } })
      ]);
    }
    return res.status(502).json({ error: err instanceof Error ? err.message : 'Payment provider error' });
  }
});

const deliveryMethodSchema = z.object({ deliveryMethod: z.enum(DELIVERY_METHODS) });

ordersRouter.post('/:id/delivery-method', requireAuth, async (req: AuthedRequest, res) => {
  await expireStaleOrders();

  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.buyerId !== req.userId && order.sellerId !== req.userId) return res.status(403).json({ error: 'Not your order' });

  // A gift-pool-funded order (see createOrderFromGiftPool) is already fully paid
  // before any delivery method exists — it lands straight in InEscrow with
  // deliveryMethod still null. Everything else starts in AwaitingDeliveryMethod.
  const alreadyPaid = order.escrowStatus === 'InEscrow' && !order.deliveryMethod;
  if (!alreadyPaid && order.escrowStatus !== 'AwaitingDeliveryMethod') {
    return res.status(409).json({ error: 'Delivery method has already been set for this order, or it has expired.' });
  }

  const parsed = deliveryMethodSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  // BostaMylerz integration is "coming soon" per spec — not a live delivery option yet.
  if (parsed.data.deliveryMethod === 'BostaMylerz') {
    return res.status(422).json({ error: 'Integrated courier delivery is coming soon and not yet available.' });
  }

  // Already paid in full (gift pool) — just record the method, nothing else changes.
  if (alreadyPaid) {
    const updated = await prisma.order.update({ where: { id: order.id }, data: { deliveryMethod: parsed.data.deliveryMethod } });
    return res.json({ order: updated });
  }

  // Meetup settles in person — no buyer protection fee, no online payment, no
  // escrow hold. The order moves straight to InEscrow purely so it flows through
  // the same tracking/confirm/review pipeline as a paid order, with $0 actually held.
  if (parsed.data.deliveryMethod === 'Meetup') {
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { deliveryMethod: 'Meetup', buyerProtectionFee: 0, escrowStatus: 'InEscrow', holdExpiresAt: null }
    });
    return res.json({ order: updated });
  }

  // A courier method still needs an actual payment — buyer protection fee now
  // applies, and the buyer has the rest of the hold window to pay it.
  const buyerProtectionFee = calcBuyerProtectionFee(order.amount);
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      deliveryMethod: parsed.data.deliveryMethod,
      buyerProtectionFee,
      amount: order.amount + buyerProtectionFee,
      escrowStatus: 'AwaitingPayment'
    }
  });
  return res.json({ order: updated });
});

ordersRouter.get('/mine', requireAuth, async (req: AuthedRequest, res) => {
  await expireStaleOrders();
  await autoReleaseStaleEscrow();

  const orders = await prisma.order.findMany({
    where: { OR: [{ buyerId: req.userId }, { sellerId: req.userId }] },
    orderBy: { createdAt: 'desc' },
    include: {
      listing: { select: { title: true, images: true } },
      buyer: { select: { id: true, fullName: true, username: true, avatarUrl: true, avatarPreset: true } },
      seller: { select: { id: true, fullName: true, username: true, avatarUrl: true, avatarPreset: true } },
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
  await expireStaleOrders();
  await autoReleaseStaleEscrow();

  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      listing: true,
      trackingLinks: true,
      buyer: { select: { id: true, fullName: true, username: true, avatarUrl: true, avatarPreset: true } },
      seller: { select: { id: true, fullName: true, username: true, avatarUrl: true, avatarPreset: true } }
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

  const result = await releaseOrderPayout(order.id);
  const offerMonetizationChoice =
    result!.seller.completedSalesCount === SELLER_PLUS_OFFER_THRESHOLD && !result!.seller.monetizationMode;

  return res.json({ order: result!.updatedOrder, offerMonetizationChoice });
});

const CONDITION_RATINGS = ['as_described', 'slightly_different', 'not_as_described'] as const;
const deliveryFeedbackSchema = z.object({
  conditionRating: z.enum(CONDITION_RATINGS),
  comment: z.string().max(1000).optional()
});

// A quick, immediate pulse-check right after confirming delivery — separate
// from the considered, 6-day-locked Review. Upserted by orderId so a resubmit
// just overwrites rather than erroring.
ordersRouter.post('/:id/delivery-feedback', requireAuth, async (req: AuthedRequest, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.buyerId !== req.userId) return res.status(403).json({ error: 'Only the buyer can leave delivery feedback' });
  if (!order.deliveryConfirmed) return res.status(409).json({ error: 'Delivery must be confirmed first' });

  const parsed = deliveryFeedbackSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const feedback = await prisma.deliveryFeedback.upsert({
    where: { orderId: order.id },
    update: { conditionRating: parsed.data.conditionRating, comment: parsed.data.comment },
    create: { orderId: order.id, buyerId: req.userId!, conditionRating: parsed.data.conditionRating, comment: parsed.data.comment }
  });

  return res.status(201).json({ feedback });
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
