import { prisma } from './db.js';

// Strikes reset if the last one is older than this many months of clean standing.
const STRIKE_ROLLING_EXPIRY_MONTHS = 9;
const BUY_ONLY_RESTRICTION_DAYS = 7;
const TEMP_BLOCK_DAYS = 14;

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function monthsAgo(months: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}

/**
 * Applies the next tier of the strike ladder to a user and returns what happened.
 * 1st flag -> coaching only. 2nd -> 7-day buy-only restriction. 3rd -> 14-day block.
 * Old strikes roll off after a clean stretch so one incident doesn't linger forever.
 */
export async function applyStrike(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const strikeExpired = user.lastFlagAt && user.lastFlagAt < monthsAgo(STRIKE_ROLLING_EXPIRY_MONTHS);
  const currentCount = strikeExpired ? 0 : user.flagCount;
  const nextCount = currentCount + 1;

  let update: Parameters<typeof prisma.user.update>[0]['data'] = {
    flagCount: nextCount,
    lastFlagAt: new Date()
  };
  let tier: 'coach' | 'buy_only_restriction' | 'temp_block';

  if (nextCount === 1) {
    tier = 'coach';
  } else if (nextCount === 2) {
    tier = 'buy_only_restriction';
    update = { ...update, status: 'BuyOnlyRestricted', buyOnlyUntil: daysFromNow(BUY_ONLY_RESTRICTION_DAYS) };
  } else {
    tier = 'temp_block';
    update = { ...update, status: 'Blocked', blockedUntil: daysFromNow(TEMP_BLOCK_DAYS) };
  }

  const updated = await prisma.user.update({ where: { id: userId }, data: update });
  return { tier, user: updated };
}

/** Severe, unambiguous violations can skip the ladder entirely, per moderator judgment. */
export async function applyImmediateBlock(userId: string, permanent: boolean) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      status: 'Blocked',
      blockedUntil: permanent ? null : daysFromNow(TEMP_BLOCK_DAYS)
    }
  });
}

/** Enforcement never interrupts an order already in escrow — only applies going forward. */
export async function hasActiveEscrowOrder(userId: string) {
  const order = await prisma.order.findFirst({
    where: {
      escrowStatus: 'InEscrow',
      OR: [{ buyerId: userId }, { sellerId: userId }]
    }
  });
  return Boolean(order);
}
