import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireAuth, optionalAuth, type AuthedRequest } from '../lib/auth.js';
import { requireVerified } from '../lib/access.js';
import { createPaymobCheckout, refundPaymobTransaction } from '../lib/paymob.js';

export const birthdaysRouter = Router();

const AUTHOR_SELECT = { id: true, fullName: true, username: true, avatarUrl: true, avatarPreset: true } as const;

/** Days from `from` (inclusive of today = 0) to the next calendar occurrence of birthday's month/day. */
function daysUntilNextOccurrence(birthday: Date, from: Date): number {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let next = new Date(from.getFullYear(), birthday.getMonth(), birthday.getDate());
  if (next < today) next = new Date(from.getFullYear() + 1, birthday.getMonth(), birthday.getDate());
  return Math.round((next.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function nextBirthdayDate(birthday: Date, from: Date): Date {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let next = new Date(from.getFullYear(), birthday.getMonth(), birthday.getDate());
  if (next < today) next = new Date(from.getFullYear() + 1, birthday.getMonth(), birthday.getDate());
  return next;
}

// A pool past its deadline and still underfunded refunds every paid contribution
// and closes — lazily checked here rather than via a background job, matching
// how this codebase already handles boost-slot and other time-bounded state.
async function expireOverduePools(): Promise<void> {
  const overdue = await prisma.birthdayGiftPool.findMany({
    where: { status: 'open', deadline: { lt: new Date() } },
    include: { contributions: { where: { status: 'paid' } } }
  });

  for (const pool of overdue) {
    for (const contribution of pool.contributions) {
      if (contribution.paymobTransactionId) {
        try {
          await refundPaymobTransaction({ transactionId: contribution.paymobTransactionId, amountEgp: contribution.amount });
        } catch {
          // Best-effort — an admin can still see the contribution trail and refund manually if this fails.
        }
      }
    }
    await prisma.$transaction([
      prisma.giftContribution.updateMany({ where: { poolId: pool.id, status: 'paid' }, data: { status: 'refunded' } }),
      prisma.birthdayGiftPool.update({ where: { id: pool.id }, data: { status: 'expired' } })
    ]);
  }
}

birthdaysRouter.get('/', optionalAuth, async (_req: AuthedRequest, res) => {
  await expireOverduePools();

  const users = await prisma.user.findMany({
    where: { birthday: { not: null }, birthdayBoardHidden: false },
    select: {
      id: true,
      fullName: true,
      username: true,
      avatarUrl: true,
      avatarPreset: true,
      birthday: true,
      birthdayGiftPool: {
        where: { status: 'open' },
        select: { id: true, targetAmount: true, raisedAmount: true, listingId: true, giftDescription: true, deadline: true }
      }
    }
  });

  const now = new Date();
  const members = users
    .map((u) => ({
      id: u.id,
      fullName: u.fullName,
      username: u.username,
      avatarUrl: u.avatarUrl,
      avatarPreset: u.avatarPreset,
      daysUntil: daysUntilNextOccurrence(u.birthday!, now),
      giftPool: u.birthdayGiftPool[0] ?? null
    }))
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return res.json({ members });
});

const createPoolSchema = z
  .object({
    listingId: z.string().min(1).optional(),
    giftDescription: z.string().min(1).max(300).optional(),
    targetAmount: z.number().positive(),
    deadline: z.string().datetime().optional()
  })
  .refine((d) => d.listingId || d.giftDescription, { message: 'Either a listing or a gift description is required.' });

birthdaysRouter.post('/gift-pool', requireAuth, requireVerified, async (req: AuthedRequest, res) => {
  const parsed = createPoolSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const me = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!me?.birthday) return res.status(422).json({ error: 'Set your birthday before creating a gift pool.' });

  const existing = await prisma.birthdayGiftPool.findFirst({ where: { userId: req.userId, status: 'open' } });
  if (existing) return res.status(409).json({ error: 'You already have an open gift pool.' });

  if (parsed.data.listingId) {
    const listing = await prisma.listing.findUnique({ where: { id: parsed.data.listingId } });
    if (!listing || listing.status !== 'Active') return res.status(422).json({ error: 'That listing is not available.' });
  }

  const deadline = parsed.data.deadline ? new Date(parsed.data.deadline) : nextBirthdayDate(me.birthday, new Date());

  const pool = await prisma.birthdayGiftPool.create({
    data: {
      userId: req.userId!,
      listingId: parsed.data.listingId,
      giftDescription: parsed.data.giftDescription,
      targetAmount: parsed.data.targetAmount,
      deadline
    }
  });

  return res.status(201).json({ pool });
});

birthdaysRouter.get('/gift-pool/:id', optionalAuth, async (req: AuthedRequest, res) => {
  const pool = await prisma.birthdayGiftPool.findUnique({
    where: { id: req.params.id },
    include: {
      contributions: {
        where: { status: 'paid' },
        include: { contributor: { select: AUTHOR_SELECT } },
        orderBy: { createdAt: 'desc' }
      }
    }
  });
  if (!pool) return res.status(404).json({ error: 'Gift pool not found' });
  return res.json({ pool });
});

const contributeSchema = z.object({ amount: z.number().positive() });

// Mirrors demand.routes.ts's single-payer boost-payment flow exactly — one
// contribution is one independent Paymob charge by one contributor, confirmed
// by the shared webhook's `giftpool_` branch (payments.routes.ts).
birthdaysRouter.post('/gift-pool/:id/contribute', requireAuth, requireVerified, async (req: AuthedRequest, res) => {
  const pool = await prisma.birthdayGiftPool.findUnique({ where: { id: req.params.id } });
  if (!pool) return res.status(404).json({ error: 'Gift pool not found' });
  if (pool.status !== 'open') return res.status(409).json({ error: 'This gift pool is no longer accepting contributions.' });
  if (pool.userId === req.userId) return res.status(403).json({ error: "You can't contribute to your own gift pool." });

  const parsed = contributeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const me = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  const contribution = await prisma.giftContribution.create({
    data: { poolId: pool.id, contributorId: req.userId!, amount: parsed.data.amount }
  });

  try {
    const [firstName, ...rest] = me.fullName.split(' ');
    const { paymobOrderId, iframeUrl } = await createPaymobCheckout({
      amountEgp: parsed.data.amount,
      merchantOrderId: `giftpool_${contribution.id}`,
      billing: { firstName, lastName: rest.join(' '), email: me.email, phone: '' }
    });
    await prisma.giftContribution.update({ where: { id: contribution.id }, data: { paymobOrderId } });
    return res.status(201).json({ contributionId: contribution.id, iframeUrl });
  } catch (err) {
    await prisma.giftContribution.update({ where: { id: contribution.id }, data: { status: 'failed' } });
    return res.status(502).json({ error: err instanceof Error ? err.message : 'Payment provider error' });
  }
});

// Polled by the client after opening the Paymob checkout tab — same pattern as
// demand.routes.ts's GET /boost-payments/:id.
birthdaysRouter.get('/gift-pool/contributions/:id', requireAuth, async (req: AuthedRequest, res) => {
  const contribution = await prisma.giftContribution.findUnique({ where: { id: req.params.id } });
  if (!contribution || contribution.contributorId !== req.userId) return res.status(404).json({ error: 'Not found' });
  return res.json({ status: contribution.status });
});
