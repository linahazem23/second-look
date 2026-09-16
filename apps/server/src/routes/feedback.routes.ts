import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireAuth, type AuthedRequest } from '../lib/auth.js';

export const feedbackRouter = Router();

const feedbackSchema = z.object({ message: z.string().min(1).max(2000) });

feedbackRouter.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = feedbackSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const feedback = await prisma.appFeedback.create({
    data: { userId: req.userId!, message: parsed.data.message }
  });
  return res.status(201).json({ feedback });
});
