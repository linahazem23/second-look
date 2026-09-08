import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireAuth, optionalAuth, type AuthedRequest } from '../lib/auth.js';
import { requireVerified, requireCanSell } from '../lib/access.js';
import { isPlusActive } from '../lib/membership.js';

export const listingsRouter = Router();

const CATEGORIES = ['Skincare', 'Makeup', 'Clothes'] as const;
const CONDITIONS = ['NeverUsed', 'UsedOnce', 'UsedAFewTimes', 'RegularlyUsed'] as const;

const listingSchema = z
  .object({
    title: z.string().min(1),
    category: z.enum(CATEGORIES),
    originalPrice: z.number().positive(),
    price: z.number().positive(),
    reasonForSelling: z.string().min(1),
    condition: z.enum(CONDITIONS),
    allowOffers: z.boolean().default(false),
    size: z.string().optional(),
    images: z.array(z.string().min(1)).min(1, 'At least one photo is required.'),
    area: z.string().min(1)
  })
  .refine((data) => data.price < data.originalPrice, {
    message: 'Your price must be strictly lower than the original price.',
    path: ['price']
  })
  .refine((data) => data.category !== 'Clothes' || Boolean(data.size), {
    message: 'Size is required for Clothes listings.',
    path: ['size']
  });

function withDiscount(listing: { originalPrice: number; price: number }) {
  const percentOff = Math.round(((listing.originalPrice - listing.price) / listing.originalPrice) * 100);
  return { ...listing, percentOff };
}

listingsRouter.get('/', optionalAuth, async (req: AuthedRequest, res) => {
  const { q, category, size, condition, area, allowOffers, sortBy, sortDir } = req.query as Record<string, string | undefined>;

  const where: any = { status: 'Active' };
  if (q) where.title = { contains: q, mode: 'insensitive' };
  if (category) where.category = category;
  if (size) where.size = { in: [size, 'One Size'] };
  if (condition) where.condition = condition;
  if (area) where.area = area;
  if (allowOffers !== undefined) where.allowOffers = allowOffers === 'true';

  const orderBy: any[] = [
    { boosted: 'desc' },
    sortBy === 'price' ? { price: sortDir === 'desc' ? 'desc' : 'asc' } : { createdAt: 'desc' }
  ];

  const listings = await prisma.listing.findMany({ where, orderBy, include: { seller: { select: { id: true, fullName: true, area: true } } } });

  let savedIds = new Set<string>();
  if (req.userId) {
    const saved = await prisma.savedListing.findMany({ where: { userId: req.userId, listingId: { in: listings.map((l) => l.id) } }, select: { listingId: true } });
    savedIds = new Set(saved.map((s) => s.listingId));
  }

  return res.json({
    listings: listings.map((l) => ({ ...withDiscount(l), savedByMe: savedIds.has(l.id) })),
    count: listings.length
  });
});

listingsRouter.get('/mine', requireAuth, async (req: AuthedRequest, res) => {
  const listings = await prisma.listing.findMany({ where: { sellerId: req.userId }, orderBy: { createdAt: 'desc' } });
  return res.json({ listings: listings.map(withDiscount) });
});

listingsRouter.get('/saved', requireAuth, async (req: AuthedRequest, res) => {
  const saved = await prisma.savedListing.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: 'desc' },
    include: { listing: { include: { seller: { select: { id: true, fullName: true, area: true } } } } }
  });
  return res.json({ listings: saved.map((s) => withDiscount(s.listing)) });
});

listingsRouter.post('/:id/save', requireAuth, async (req: AuthedRequest, res) => {
  const listing = await prisma.listing.findUnique({ where: { id: req.params.id } });
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  await prisma.savedListing.upsert({
    where: { userId_listingId: { userId: req.userId!, listingId: listing.id } },
    update: {},
    create: { userId: req.userId!, listingId: listing.id }
  });
  return res.status(201).json({ saved: true });
});

listingsRouter.delete('/:id/save', requireAuth, async (req: AuthedRequest, res) => {
  await prisma.savedListing.deleteMany({ where: { userId: req.userId, listingId: req.params.id } });
  return res.json({ saved: false });
});

listingsRouter.get('/areas', async (_req, res) => {
  const grouped = await prisma.listing.groupBy({
    by: ['area'],
    where: { status: 'Active' },
    _count: { area: true }
  });
  const areas = grouped
    .map((g) => ({ area: g.area, count: g._count.area }))
    .sort((a, b) => b.count - a.count);
  return res.json({ areas });
});

listingsRouter.get('/:id', async (req, res) => {
  const listing = await prisma.listing.findUnique({
    where: { id: req.params.id },
    include: { seller: { select: { id: true, fullName: true, area: true } } }
  });
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  return res.json({ listing: withDiscount(listing) });
});

listingsRouter.post('/', requireAuth, requireVerified, requireCanSell, async (req: AuthedRequest, res) => {
  const parsed = listingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const listing = await prisma.listing.create({
    data: { ...parsed.data, sellerId: req.userId! }
  });

  const priorListingCount = await prisma.listing.count({ where: { sellerId: req.userId }, });
  const isFirstListing = priorListingCount === 1;

  return res.status(201).json({ listing: withDiscount(listing), isFirstListing });
});

const listingUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  price: z.number().positive().optional(),
  originalPrice: z.number().positive().optional(),
  images: z.array(z.string().min(1)).min(1).optional(),
  allowOffers: z.boolean().optional(),
  status: z.enum(['Active', 'Removed', 'Sold']).optional()
});

listingsRouter.patch('/:id', requireAuth, async (req: AuthedRequest, res) => {
  const listing = await prisma.listing.findUnique({ where: { id: req.params.id } });
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.sellerId !== req.userId) return res.status(403).json({ error: 'Not your listing' });

  const parsed = listingUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const nextPrice = parsed.data.price ?? listing.price;
  const nextOriginal = parsed.data.originalPrice ?? listing.originalPrice;
  if (nextPrice >= nextOriginal) {
    return res.status(422).json({ error: 'Your price must be strictly lower than the original price.' });
  }

  const updated = await prisma.listing.update({ where: { id: listing.id }, data: parsed.data });
  return res.json({ listing: withDiscount(updated) });
});

listingsRouter.post('/:id/boost', requireAuth, async (req: AuthedRequest, res) => {
  const listing = await prisma.listing.findUnique({ where: { id: req.params.id } });
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.sellerId !== req.userId) return res.status(403).json({ error: 'Not your listing' });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  // Unlimited free boosting is the concrete Second Look Plus perk while membership is active.
  const amount = isPlusActive(user) ? 0 : 25;
  await prisma.boostPayment.create({ data: { userId: req.userId!, targetType: 'listing', targetId: listing.id, amount } });
  const updated = await prisma.listing.update({ where: { id: listing.id }, data: { boosted: true } });
  return res.json({ listing: withDiscount(updated), wasFree: amount === 0 });
});
