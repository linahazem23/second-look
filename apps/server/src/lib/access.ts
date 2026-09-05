import type { Response, NextFunction } from 'express';
import { prisma } from './db.js';
import type { AuthedRequest } from './auth.js';

/** Full marketplace access requires the automated female-identity verification to have passed. */
export async function requireVerified(req: AuthedRequest, res: Response, next: NextFunction) {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.verifiedFemale) {
    return res.status(403).json({ error: 'Identity verification must be completed before this action.' });
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
