import { Prisma } from '@prisma/client';
import { prisma } from './db.js';

const TRUSTED_REVIEWER_THRESHOLD = 5;
const COMMUNITY_HELPER_THRESHOLD = 10;

export const POINTS = {
  SALE_COMPLETED: 20,
  REVIEW_LEFT: 5,
  COMMUNITY_POST: 3,
  REFERRAL_SIGNUP: 15,
  GIFT_CONTRIBUTION: 10
} as const;

// Deliberately called *after* the primary business transaction succeeds, not
// inside it — a gamification award should never be able to block or roll back
// a real sale/review/post. The PointsLedger unique constraint on
// (userId, reason, refId) is what actually prevents a double-award; a P2002
// here just means "already awarded," which is a safe no-op, not an error.
export async function awardPoints(userId: string, amount: number, reason: string, refId: string): Promise<void> {
  try {
    await prisma.$transaction([
      prisma.pointsLedger.create({ data: { userId, amount, reason, refId } }),
      prisma.user.update({ where: { id: userId }, data: { points: { increment: amount } } })
    ]);
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
  }
}

export async function awardCharm(userId: string, charmKey: string): Promise<void> {
  try {
    const charm = await prisma.charm.findUnique({ where: { key: charmKey } });
    if (!charm) return;
    await prisma.userCharm.create({ data: { userId, charmId: charm.id } });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
  }
}

/** Counts a user's own award events for a reason — used to unlock a milestone charm at a threshold. */
async function countPointsEvents(userId: string, reason: string): Promise<number> {
  return prisma.pointsLedger.count({ where: { userId, reason } });
}

export async function maybeAwardReviewerCharm(userId: string): Promise<void> {
  const count = await countPointsEvents(userId, 'review_left');
  if (count >= TRUSTED_REVIEWER_THRESHOLD) await awardCharm(userId, 'trusted_reviewer');
}

export async function maybeAwardCommunityHelperCharm(userId: string): Promise<void> {
  const count = await countPointsEvents(userId, 'community_post');
  if (count >= COMMUNITY_HELPER_THRESHOLD) await awardCharm(userId, 'community_helper');
}
