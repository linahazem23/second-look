import { Router } from 'express';
import { prisma } from '../lib/db.js';

export const profilesRouter = Router();

// Public trust profile for any user — the core signal buyers rely on before dealing
// with a seller they've never met. No auth required to view (mirrors public listing browsing).
profilesRouter.get('/:id', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const [activeListings, received, given] = await Promise.all([
    prisma.listing.findMany({ where: { sellerId: user.id, status: 'Active' }, orderBy: { createdAt: 'desc' } }),
    prisma.review.findMany({ where: { type: 'Person', reviewedUserId: user.id, revealed: true }, orderBy: { createdAt: 'desc' } }),
    prisma.review.findMany({ where: { type: 'Person', reviewerId: user.id, revealed: true }, orderBy: { createdAt: 'desc' } })
  ]);

  const avgRating = received.length ? received.reduce((sum, r) => sum + (r.starRating ?? 0), 0) / received.length : null;

  return res.json({
    profile: {
      id: user.id,
      fullName: user.fullName,
      area: user.area,
      createdAt: user.createdAt,
      completedSalesCount: user.completedSalesCount,
      verifiedFemale: user.verifiedFemale
    },
    activeListings: activeListings.map((l) => ({
      id: l.id,
      title: l.title,
      category: l.category,
      price: l.price,
      originalPrice: l.originalPrice,
      images: l.images
    })),
    avgRating,
    reviewsReceived: received,
    reviewsGiven: given
  });
});
