import type { Response, NextFunction } from 'express';
import { prisma } from './db.js';
import type { AuthedRequest } from './auth.js';

/**
 * Full marketplace access requires the member's own identity verification —
 * and, for a member who signed up under 18, her guardian's consent too (a
 * real ID reviewed by an admin, not an automated phone check).
 */
export async function requireVerified(req: AuthedRequest, res: Response, next: NextFunction) {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.verifiedFemale) {
    return res.status(403).json({ error: 'Identity verification must be completed before this action.' });
  }
  if (user.guardianConsentStatus === 'pending') {
    return res.status(403).json({ error: "Your guardian's consent is still pending review before this action unlocks." });
  }
  if (user.guardianConsentStatus === 'rejected') {
    return res.status(403).json({ error: "Your guardian's consent submission was rejected — ask them to resubmit." });
  }
  next();
}

/** Buy-only restriction blocks new listings/selling but must still allow browsing and buying. */
export async function requireCanSell(req: AuthedRequest, res: Response, next: NextFunction) {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.status === 'Blocked') return res.status(403).json({ error: 'Account is blocked.' });
  if (user.status === 'BuyOnlyRestricted') {
    return res.status(403).json({ error: 'Account is temporarily restricted to buying only.', buyOnlyUntil: user.buyOnlyUntil });
  }
  next();
}
