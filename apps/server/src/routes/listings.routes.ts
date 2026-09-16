import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireAuth, optionalAuth, type AuthedRequest } from '../lib/auth.js';
import { requireVerified, requireCanSell } from '../lib/access.js';
import { isPlusActive } from '../lib/membership.js';
import { createPaymobCheckout } from '../lib/paymob.js';
import { maxAllowedPrice } from '../lib/pricing.js';

export const listingsRouter = Router();

const CATEGORIES = ['Skincare', 'Makeup', 'Clothes', 'Haircare'] as const;
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
    skinType: z.string().optional(),
    hairType: z.string().optional(),
    images: z.array(z.string().min(1)).min(1, 'At least one photo is required.'),
    area: z.string().min(1)
  })
  .refine((data) => data.price < data.originalPrice, {
    message: 'Your price must be strictly lower than the original price.',
    path: ['price']
  })
  .refine((data) => data.price <= maxAllowedPrice(data.originalPrice, data.condition), (data) => ({
    message: `For a "${data.condition === 'NeverUsed' ? 'Never used' : data.condition}" item, your price needs to be at most ${Math.floor(maxAllowedPrice(data.originalPrice, data.condition))} EGP — you're welcome to price it lower.`,
    path: ['price']
  }))
  .refine((data) => data.category !== 'Clothes' || Boolean(data.size), {
    message: 'Size is required for Clothes listings.',
    path: ['size']
  })
  .refine((data) => data.category !== 'Skincare' || Boolean(data.skinType), {
    message: 'Skin type is required for Skincare listings.',
    path: ['skinType']
  })
  .refine((data) => data.category !== 'Haircare' || Boolean(data.hairType), {
    message: 'Hair type is required for Haircare listings.',
    path: ['hairType']
  });

function withDiscount(listing: { originalPrice: number; price: number }) {
  const percentOff = Math.round(((listing.originalPrice - listing.price) / listing.originalPrice) * 100);
  return { ...listing, percentOff };
}

listingsRouter.get('/', optionalAuth, async (req: AuthedRequest, res) => {
  const { q, category, size, skinType, hairType, condition, area, allowOffers, sortBy, sortDir } = req.query as Record<string, string | undefined>;

  const where: any = { status: 'Active' };
  if (q) where.title = { contains: q, mode: 'insensitive' };
  if (category && category !== 'All') where.category = category;
  if (size) where.size = { in: [size, 'One Size'] };
  // "All" on a listing means suitable for everyone, so it should surface
  // under any specific skin/hair type filter too, not just an exact match.
  if (skinType) where.skinType = { in: [skinType, 'All'] };
  if (hairType) where.hairType = { in: [hairType, 'All'] };
  if (condition) where.condition = condition;
  if (area) where.area = area;
  if (allowOffers !== undefined) where.allowOffers = allowOffers === 'true';

  const orderBy: any[] = [
    { boosted: 'desc' },
    sortBy === 'price' ? { price: sortDir === 'desc' ? 'desc' : 'asc' } : { createdAt: 'desc' }
  ];

  const listings = await prisma.listing.findMany({ where, orderBy, include: { seller: { select: { id: true, fullName: true, username: true, area: true } } } });

  let savedIds = new Set<string>();
  // Personalized ordering: a logged-in buyer's own profile-quiz answers (skin
  // type, hair type, clothing size) bump matching listings toward the top of
  // "For you" — without ever hiding non-matching ones or bumping a boosted
  // listing down. A listing marked "All" always counts as a match.
  let personalized = listings;
  if (req.userId) {
    const [saved, me] = await Promise.all([
      prisma.savedListing.findMany({ where: { userId: req.userId, listingId: { in: listings.map((l) => l.id) } }, select: { listingId: true } }),
      prisma.user.findUnique({ where: { id: req.userId }, select: { skinType: true, hairType: true, clothingSize: true } })
    ]);
    savedIds = new Set(saved.map((s) => s.listingId));
    if (me && (me.skinType || me.hairType || me.clothingSize)) {
      const matches = (l: (typeof listings)[number]) => {
        if (l.category === 'Clothes') return Boolean(me.clothingSize) && l.size === me.clothingSize;
        if (l.category === 'Haircare') return Boolean(me.hairType) && (l.hairType === me.hairType || l.hairType === 'All');
        if (l.category === 'Skincare') return Boolean(me.skinType) && (l.skinType === me.skinType || l.skinType === 'All');
        return false;
      };
      personalized = [...listings].sort((a, b) => {
        const rank = (l: (typeof listings)[number]) => (l.boosted ? 0 : matches(l) ? 1 : 2);
        return rank(a) - rank(b);
      });
    }
  }

  return res.json({
    listings: personalized.map((l) => ({ ...withDiscount(l), savedByMe: savedIds.has(l.id) })),
    count: personalized.length
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
    include: { listing: { include: { seller: { select: { id: true, fullName: true, username: true, area: true } } } } }
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
    include: { seller: { select: { id: true, fullName: true, username: true, area: true } } }
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
  category: z.enum(CATEGORIES).optional(),
  price: z.number().positive().optional(),
  originalPrice: z.number().positive().optional(),
  reasonForSelling: z.string().min(1).optional(),
  condition: z.enum(CONDITIONS).optional(),
  size: z.string().optional(),
  skinType: z.string().optional(),
  hairType: z.string().optional(),
  area: z.string().min(1).optional(),
  images: z.array(z.string().min(1)).min(1).optional(),
  allowOffers: z.boolean().optional(),
  status: z.enum(['Active', 'Removed', 'Sold']).optional()
});

// A listing stays fully editable to its seller after posting (title, photos,
// description, condition, size, area, price) — only price/condition changes
// are re-checked against the discount-ceiling rule, since those are the only
// fields that rule depends on.
listingsRouter.patch('/:id', requireAuth, async (req: AuthedRequest, res) => {
  const listing = await prisma.listing.findUnique({ where: { id: req.params.id } });
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.sellerId !== req.userId) return res.status(403).json({ error: 'Not your listing' });

  const parsed = listingUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const nextPrice = parsed.data.price ?? listing.price;
  const nextOriginal = parsed.data.originalPrice ?? listing.originalPrice;
  const nextCondition = (parsed.data.condition ?? listing.condition) as (typeof CONDITIONS)[number];
  if (nextPrice >= nextOriginal) {
    return res.status(422).json({ error: 'Your price must be strictly lower than the original price.' });
  }
  const ceiling = maxAllowedPrice(nextOriginal, nextCondition);
  if (nextPrice > ceiling) {
    return res.status(422).json({
      error: `For a "${nextCondition === 'NeverUsed' ? 'Never used' : nextCondition}" item, your price needs to be at most ${Math.floor(ceiling)} EGP — you're welcome to price it lower.`
    });
  }
  const nextCategory = parsed.data.category ?? listing.category;
  if (nextCategory === 'Clothes' && !(parsed.data.size ?? listing.size)) {
    return res.status(422).json({ error: 'Size is required for Clothes listings.' });
  }
  if (nextCategory === 'Skincare' && !(parsed.data.skinType ?? listing.skinType)) {
    return res.status(422).json({ error: 'Skin type is required for Skincare listings.' });
  }
  if (nextCategory === 'Haircare' && !(parsed.data.hairType ?? listing.hairType)) {
    return res.status(422).json({ error: 'Hair type is required for Haircare listings.' });
  }

  const updated = await prisma.listing.update({ where: { id: listing.id }, data: parsed.data });
  return res.json({ listing: withDiscount(updated) });
});

// A hard cap per category keeps boosting a real scarce slot instead of a
// pay-to-win free-for-all that could bury the organic feed under paid ones.
const MAX_BOOSTED_PER_CATEGORY = 3;

// Boosting only actually flips `boosted: true` once Paymob confirms the charge
// (via the shared webhook in payments.routes.ts) — this just starts checkout,
// mirroring how order payments work. Second Look Plus members skip payment
// entirely since unlimited boosting is their membership perk.
listingsRouter.post('/:id/boost', requireAuth, async (req: AuthedRequest, res) => {
  const listing = await prisma.listing.findUnique({ where: { id: req.params.id } });
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.sellerId !== req.userId) return res.status(403).json({ error: 'Not your listing' });
  if (listing.boosted) return res.status(409).json({ error: 'This listing is already boosted.' });

  const activeBoostedCount = await prisma.listing.count({ where: { category: listing.category, boosted: true, status: 'Active' } });
  if (activeBoostedCount >= MAX_BOOSTED_PER_CATEGORY) {
    return res.status(409).json({ error: `Boost slots for ${listing.category} are full right now (${MAX_BOOSTED_PER_CATEGORY}/${MAX_BOOSTED_PER_CATEGORY}). Try again once one clears.` });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  const amount = isPlusActive(user) ? 0 : 25;

  if (amount === 0) {
    await prisma.boostPayment.create({ data: { userId: req.userId!, targetType: 'listing', targetId: listing.id, amount, paid: true } });
    const updated = await prisma.listing.update({ where: { id: listing.id }, data: { boosted: true } });
    return res.json({ listing: withDiscount(updated), wasFree: true });
  }

  const boostPayment = await prisma.boostPayment.create({ data: { userId: req.userId!, targetType: 'listing', targetId: listing.id, amount, paid: false } });

  try {
    const [firstName, ...rest] = user.fullName.split(' ');
    const { paymobOrderId, iframeUrl } = await createPaymobCheckout({
      amountEgp: amount,
      merchantOrderId: `boost_${boostPayment.id}`,
      billing: { firstName, lastName: rest.join(' '), email: user.email, phone: '' }
    });
    await prisma.boostPayment.update({ where: { id: boostPayment.id }, data: { paymobOrderId } });
    return res.json({ wasFree: false, boostPaymentId: boostPayment.id, iframeUrl });
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : 'Payment provider error' });
  }
});

// Polled by the client after opening the Paymob checkout tab, so the "Boosted"
// badge can appear as soon as the webhook confirms the charge.
listingsRouter.get('/boost-payments/:id', requireAuth, async (req: AuthedRequest, res) => {
  const boostPayment = await prisma.boostPayment.findUnique({ where: { id: req.params.id } });
  if (!boostPayment || boostPayment.userId !== req.userId) return res.status(404).json({ error: 'Not found' });
  return res.json({ paid: boostPayment.paid });
});
