import { Router } from 'express';
import { prisma } from '../lib/db.js';

export const adsRouter = Router();

// Public — the feed needs to know whether there's a live sponsored card to
// show before deciding whether to fall back to the "Advertise here" prompt.
// A category ("Skincare", "Haircare", ...) prefers an ad targeted at that
// feed specifically — a hair clinic in Haircare, a baby brand in Mom & Baby —
// and falls back to a category-less (shows-everywhere) ad if none is
// scheduled for that category right now.
adsRouter.get('/active', async (req, res) => {
  const slotType = (req.query.slotType as string) ?? 'in_feed_sponsored_card';
  const category = req.query.category as string | undefined;
  const now = new Date();

  const baseWhere = { slotType, status: { not: 'cancelled' as const }, startDate: { lte: now }, endDate: { gte: now } };

  if (category && category !== 'All') {
    const targeted = await prisma.ad.findFirst({ where: { ...baseWhere, category }, orderBy: { startDate: 'desc' } });
    if (targeted) return res.json({ ad: targeted });

    const fallback = await prisma.ad.findFirst({ where: { ...baseWhere, category: null }, orderBy: { startDate: 'desc' } });
    return res.json({ ad: fallback });
  }

  const ad = await prisma.ad.findFirst({ where: baseWhere, orderBy: { startDate: 'desc' } });
  return res.json({ ad });
});
