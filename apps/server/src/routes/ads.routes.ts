import { Router } from 'express';
import { prisma } from '../lib/db.js';

export const adsRouter = Router();

// Public — the feed needs to know whether there's a live sponsored card to
// show before deciding whether to fall back to the "Advertise here" prompt.
adsRouter.get('/active', async (req, res) => {
  const slotType = (req.query.slotType as string) ?? 'in_feed_sponsored_card';
  const now = new Date();

  const ad = await prisma.ad.findFirst({
    where: {
      slotType,
      status: { not: 'cancelled' },
      startDate: { lte: now },
      endDate: { gte: now }
    },
    orderBy: { startDate: 'desc' }
  });

  return res.json({ ad });
});
