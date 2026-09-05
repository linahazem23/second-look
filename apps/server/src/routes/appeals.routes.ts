import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireAuth, type AuthedRequest } from '../lib/auth.js';

export const appealsRouter = Router();

const RESPONSE_WINDOW_BUSINESS_DAYS = 3;

function addBusinessDays(from: Date, days: number) {
  const result = new Date(from);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return result;
}

const appealSchema = z.object({
  originalDecision: z.string().min(1),
  statement: z.string().min(20, 'Please provide a real written explanation, not just an unblock request.')
});

appealsRouter.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.status === 'Good') return res.status(422).json({ error: 'No active restriction to appeal.' });

  const parsed = appealSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  // Track which moderator made the underlying call so a different one reviews the appeal.
  const originalCase = await prisma.moderationCase.findFirst({
    where: { reviewedUserId: req.userId, status: 'resolved' },
    orderBy: { resolvedAt: 'desc' }
  });

  const appeal = await prisma.appeal.create({
    data: {
      userId: req.userId!,
      originalDecision: parsed.data.originalDecision,
      originalModeratorId: originalCase?.resolvedByAdminId,
      statement: parsed.data.statement,
      responseDueAt: addBusinessDays(new Date(), RESPONSE_WINDOW_BUSINESS_DAYS)
    }
  });

  return res.status(201).json({ appeal });
});

appealsRouter.get('/mine', requireAuth, async (req: AuthedRequest, res) => {
  const appeals = await prisma.appeal.findMany({ where: { userId: req.userId }, orderBy: { createdAt: 'desc' } });
  return res.json({ appeals });
});
