import { prisma } from './db.js';
import type { User } from '@prisma/client';

export const MEMBERSHIP_GRANT_DAYS = 30;
export const VIDEO_PROMO_MAX_GRANTS = 5;
export const REFERRAL_BATCH_SIZE = 3;

// No unambiguous 0/O/1/I/L in the alphabet — codes get read aloud/typed by hand.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomCode(length = 8) {
  let code = '';
  for (let i = 0; i < length; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return code;
}

/** Retries on the (very rare) collision — referralCode is unique. */
export async function generateUniqueReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const existing = await prisma.user.findUnique({ where: { referralCode: code } });
    if (!existing) return code;
  }
  // Astronomically unlikely to ever reach here (32^8 keyspace), but never loop forever.
  return `${randomCode()}${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Membership perks are active purely based on whether membershipExpiresAt is in the
 * future — checked live on every read. Nothing is ever written back on expiry, so
 * there's no cron job or background sweep that could be forgotten: the moment the
 * date passes, every caller of this function sees it as expired, automatically.
 */
export function isPlusActive(user: Pick<User, 'membershipExpiresAt'>): boolean {
  return Boolean(user.membershipExpiresAt && user.membershipExpiresAt > new Date());
}

/** Grants stack: a new reward extends from the current expiry (if still active) rather than from now, so nothing is wasted. */
export async function grantMembershipDays(userId: string, days: number) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const base = isPlusActive(user) ? user.membershipExpiresAt! : new Date();
  const membershipExpiresAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  return prisma.user.update({ where: { id: userId }, data: { membershipExpiresAt } });
}

/** The growth promo (video or referral path) unlocks once a seller has posted 3 listings, ever. */
export async function isGrowthPromoUnlocked(userId: string): Promise<boolean> {
  const count = await prisma.listing.count({ where: { sellerId: userId } });
  return count >= 3;
}
