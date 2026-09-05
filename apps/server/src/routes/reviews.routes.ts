import { Router } from 'express';
import { z } from 'zod';
import type { Order } from '@prisma/client';
import { prisma } from '../lib/db.js';
import { requireAuth, type AuthedRequest } from '../lib/auth.js';

export const reviewsRouter = Router();

const PERSON_REVIEW_REVEAL_WAIT_DAYS = 7;

reviewsRouter.get('/mine', requireAuth, async (req: AuthedRequest, res) => {
  const [received, given] = await Promise.all([
    prisma.review.findMany({
      where: { type: 'Person', reviewedUserId: req.userId, revealed: true },
      orderBy: { createdAt: 'desc' }
    }),
    // A person's own left reviews are shown on their profile too — a trust signal in itself.
    prisma.review.findMany({
      where: { type: 'Person', reviewerId: req.userId, revealed: true },
      orderBy: { createdAt: 'desc' }
    })
  ]);
  const avgRating = received.length ? received.reduce((sum, r) => sum + (r.starRating ?? 0), 0) / received.length : null;
  return res.json({ received, given, avgRating });
});

type ReviewEligibility =
  | { ok: false; status: number; error: string; reviewUnlockAt?: Date | null }
  | { ok: true; order: Order };

async function getReviewableOrder(orderId: string, userId: string): Promise<ReviewEligibility> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: 'Order not found', status: 404 };
  if (order.buyerId !== userId && order.sellerId !== userId) return { ok: false, error: 'Not your order', status: 403 };
  if (order.escrowStatus !== 'PaymentReleased') {
    return { ok: false, error: 'Reviews unlock only after delivery is confirmed and payment is released.', status: 409 };
  }
  if (!order.reviewUnlockAt || order.reviewUnlockAt > new Date()) {
    return { ok: false, error: 'The review waiting period has not elapsed yet.', status: 409, reviewUnlockAt: order.reviewUnlockAt };
  }
  return { ok: true, order };
}

/** Non-blocking fraud signals surfaced to moderators — flags for review, never auto-blocks. */
async function collectFraudSignals(reviewerId: string, orderId: string, afterPhotoUrl?: string, listingImages?: string[]) {
  const signals: string[] = [];

  const recentReviewCount = await prisma.review.count({
    where: { reviewerId, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } }
  });
  if (recentReviewCount >= 3) signals.push('unnatural_review_timing');

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (order) {
    const flippedRoleOrder = await prisma.order.findFirst({
      where: {
        id: { not: orderId },
        OR: [
          { buyerId: order.sellerId, sellerId: order.buyerId },
          { buyerId: order.buyerId, sellerId: order.sellerId }
        ]
      }
    });
    if (flippedRoleOrder) signals.push('repeat_counterparty_role_swap');
  }

  if (afterPhotoUrl && listingImages?.includes(afterPhotoUrl)) {
    signals.push('after_photo_matches_listing_photo');
  }

  return signals;
}

const productReviewSchema = z.object({
  orderId: z.string().min(1),
  productIdentity: z.string().min(1),
  usageDuration: z.string().min(1),
  starRating: z.number().int().min(1).max(5),
  beforePhotoUrl: z.string().min(1),
  afterPhotoUrl: z.string().min(1),
  notes: z.string().optional()
});

reviewsRouter.post('/product', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = productReviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const eligibility = await getReviewableOrder(parsed.data.orderId, req.userId!);
  if (!eligibility.ok) return res.status(eligibility.status).json(eligibility);
  const order = eligibility.order;

  // Product reviews are buyer-only: "was this item as described" only makes sense from the purchaser.
  if (order.buyerId !== req.userId) return res.status(403).json({ error: 'Only the buyer may leave a product review.' });

  const existing = await prisma.review.findFirst({ where: { orderId: order.id, reviewerId: req.userId, type: 'Product' } });
  if (existing) return res.status(409).json({ error: 'A product review already exists for this order.' });

  const listing = await prisma.listing.findUnique({ where: { id: order.listingId } });
  const fraudSignals = await collectFraudSignals(req.userId!, order.id, parsed.data.afterPhotoUrl, listing?.images);

  const review = await prisma.review.create({
    data: {
      orderId: order.id,
      reviewerId: req.userId!,
      reviewedUserId: order.sellerId,
      type: 'Product',
      productIdentity: parsed.data.productIdentity,
      usageDuration: parsed.data.usageDuration,
      starRating: parsed.data.starRating,
      beforePhotoUrl: parsed.data.beforePhotoUrl,
      afterPhotoUrl: parsed.data.afterPhotoUrl,
      notes: parsed.data.notes,
      revealed: true,
      fraudSignals,
      flagged: fraudSignals.length > 0
    }
  });

  return res.status(201).json({ review });
});

reviewsRouter.get('/product', async (req, res) => {
  const productIdentity = req.query.productIdentity as string | undefined;
  if (!productIdentity) return res.status(400).json({ error: 'productIdentity query param is required' });

  // All reviews for a given canonical product share one pool, regardless of which
  // listing/seller they came from — this is the aggregation the fuzzy-matched
  // product-identity field exists to support.
  const reviews = await prisma.review.findMany({ where: { type: 'Product', productIdentity }, orderBy: { createdAt: 'desc' } });
  const avgRating = reviews.length
    ? reviews.reduce((sum, r) => sum + (r.starRating ?? 0), 0) / reviews.length
    : null;

  return res.json({ productIdentity, reviews, avgRating, count: reviews.length });
});

const personReviewSchema = z.object({
  orderId: z.string().min(1),
  honestListing: z.boolean(),
  easyToCommunicate: z.boolean(),
  showedUpAsAgreed: z.boolean(),
  starRating: z.number().int().min(1).max(5),
  notes: z.string().optional()
});

reviewsRouter.post('/person', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = personReviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const eligibility = await getReviewableOrder(parsed.data.orderId, req.userId!);
  if (!eligibility.ok) return res.status(eligibility.status).json(eligibility);
  const order = eligibility.order;

  const existing = await prisma.review.findFirst({ where: { orderId: order.id, reviewerId: req.userId, type: 'Person' } });
  if (existing) return res.status(409).json({ error: 'You already reviewed this person for this order.' });

  const reviewedUserId = order.buyerId === req.userId ? order.sellerId : order.buyerId;
  const fraudSignals = await collectFraudSignals(req.userId!, order.id);
  const revealDeadline = new Date(Date.now() + PERSON_REVIEW_REVEAL_WAIT_DAYS * 24 * 60 * 60 * 1000);

  const review = await prisma.review.create({
    data: {
      orderId: order.id,
      reviewerId: req.userId!,
      reviewedUserId,
      type: 'Person',
      honestListing: parsed.data.honestListing,
      easyToCommunicate: parsed.data.easyToCommunicate,
      showedUpAsAgreed: parsed.data.showedUpAsAgreed,
      starRating: parsed.data.starRating,
      notes: parsed.data.notes,
      revealDeadline,
      fraudSignals,
      flagged: fraudSignals.length > 0
    }
  });

  // Blind & simultaneous: reveal both sides the instant the second one lands.
  const counterpartReview = await prisma.review.findFirst({
    where: { orderId: order.id, type: 'Person', reviewerId: reviewedUserId }
  });
  if (counterpartReview) {
    await prisma.review.updateMany({
      where: { orderId: order.id, type: 'Person' },
      data: { revealed: true }
    });
  }

  // Trigger a moderation case on a report OR a repeated pattern (2+ low ratings in
  // a rolling window) — not on every single low rating in isolation, to keep
  // moderator workload sustainable once volume is real.
  if (parsed.data.starRating <= 3) {
    const recentLowRatings = await prisma.review.count({
      where: {
        type: 'Person',
        reviewedUserId,
        starRating: { lte: 3 },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    });
    if (recentLowRatings >= 2) {
      await prisma.moderationCase.create({
        data: {
          contextType: 'review_flag',
          contextId: review.id,
          reviewerId: review.reviewerId,
          reviewedUserId,
          reason: `${recentLowRatings} low ratings (3★ or below) in the last 30 days`
        }
      });
    }
  }

  return res.status(201).json({ review: { ...review, revealed: Boolean(counterpartReview) } });
});

reviewsRouter.get('/person/:orderId', requireAuth, async (req: AuthedRequest, res) => {
  const reviews = await prisma.review.findMany({ where: { orderId: req.params.orderId, type: 'Person' } });

  const isRevealed = reviews.some((r) => r.revealed) || reviews.some((r) => r.revealDeadline && r.revealDeadline <= new Date());
  if (!isRevealed) {
    // Only show the reviewer their own not-yet-revealed submission, never the other side's.
    const own = reviews.filter((r) => r.reviewerId === req.userId);
    return res.json({ revealed: false, ownSubmission: own[0] ?? null });
  }

  return res.json({ revealed: true, reviews });
});

reviewsRouter.post('/:id/dispute', requireAuth, async (req: AuthedRequest, res) => {
  const review = await prisma.review.findUnique({ where: { id: req.params.id } });
  if (!review) return res.status(404).json({ error: 'Review not found' });
  if (review.reviewedUserId !== req.userId) return res.status(403).json({ error: 'Only the reviewed party can dispute a review.' });

  const parsed = z.object({ note: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  // Reviewed parties get a dispute button, never a delete button — routes to a moderator.
  const updated = await prisma.review.update({
    where: { id: review.id },
    data: { disputeStatus: 'disputed', disputeNote: parsed.data.note }
  });
  await prisma.moderationCase.create({
    data: {
      contextType: 'review_dispute',
      contextId: review.id,
      reviewerId: review.reviewerId,
      reviewedUserId: review.reviewedUserId,
      reason: 'Reviewed party disputes this review',
      reviewedNotes: parsed.data.note
    }
  });

  return res.json({ review: updated });
});
