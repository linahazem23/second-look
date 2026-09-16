import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireAuth, type AuthedRequest } from '../lib/auth.js';
import { requireVerified } from '../lib/access.js';
import { detectFlaggedKeyword } from '../lib/chatModeration.js';
import { isPlusActive } from '../lib/membership.js';
import { createPaymobCheckout } from '../lib/paymob.js';

export const demandRouter = Router();

const CATEGORIES = ['Skincare', 'Makeup', 'Clothes'] as const;

// Comments must not become a back-channel to move the deal off-platform.
const CONTACT_INFO_PATTERN = /(\+?20|0)?1[0125]\d{8}|whatsapp|instagram|\bfb\.com\b|@[a-z0-9_]{3,}/i;

demandRouter.get('/', async (_req, res) => {
  const requests = await prisma.demandRequest.findMany({
    where: { status: 'open' },
    orderBy: [{ boosted: 'desc' }, { createdAt: 'desc' }],
    include: { comments: true, requester: { select: { id: true, fullName: true, username: true } } }
  });
  return res.json({ requests, count: requests.length });
});

const createSchema = z.object({
  itemName: z.string().min(1),
  category: z.enum(CATEGORIES),
  area: z.string().min(1),
  note: z.string().optional()
});

demandRouter.post('/', requireAuth, requireVerified, async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const request = await prisma.demandRequest.create({ data: { ...parsed.data, requesterId: req.userId! } });

  // Notify sellers who've previously listed in this category in this area — not
  // a blast to everyone, and only triggered by a posted request (never per-search).
  const candidateSellers = await prisma.listing.findMany({
    where: { category: parsed.data.category, area: parsed.data.area, sellerId: { not: req.userId } },
    select: { sellerId: true },
    distinct: ['sellerId']
  });

  if (candidateSellers.length > 0) {
    await prisma.demandNotification.createMany({
      data: candidateSellers.map((s) => ({ requestId: request.id, recipientId: s.sellerId, status: 'pending' }))
    });
  }

  return res.status(201).json({ request, notifiedSellerCount: candidateSellers.length });
});

demandRouter.post('/:id/i-have-it', requireAuth, requireVerified, async (req: AuthedRequest, res) => {
  const notification = await prisma.demandNotification.findFirst({
    where: { requestId: req.params.id, recipientId: req.userId }
  });
  if (!notification) return res.status(404).json({ error: 'No matching notification for this user' });

  await prisma.demandNotification.update({ where: { id: notification.id }, data: { status: 'have_it' } });
  return res.json({ status: 'have_it' });
});

demandRouter.post('/:id/not-now', requireAuth, async (req: AuthedRequest, res) => {
  const notification = await prisma.demandNotification.findFirst({
    where: { requestId: req.params.id, recipientId: req.userId }
  });
  if (!notification) return res.status(404).json({ error: 'No matching notification for this user' });

  // Suppresses future re-notification for this request/recipient pair.
  await prisma.demandNotification.update({ where: { id: notification.id }, data: { status: 'not_now' } });
  return res.json({ status: 'not_now' });
});

const commentSchema = z.object({ body: z.string().min(1).max(500) });

demandRouter.post('/:id/comments', requireAuth, requireVerified, async (req: AuthedRequest, res) => {
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  if (CONTACT_INFO_PATTERN.test(parsed.data.body)) {
    return res.status(422).json({ error: 'Comments may not include phone numbers or external contact info. Use in-app chat instead.' });
  }
  if (detectFlaggedKeyword(parsed.data.body)) {
    return res.status(422).json({ error: 'This comment was blocked for review. Please keep comments respectful.' });
  }

  const comment = await prisma.demandComment.create({
    data: { requestId: req.params.id, authorId: req.userId!, body: parsed.data.body }
  });
  return res.status(201).json({ comment });
});

// Same hard per-category scarcity cap as listings.routes.ts.
const MAX_BOOSTED_PER_CATEGORY = 3;

// Mirrors listings.routes.ts's boost flow — a real Paymob charge, only
// flipping `boosted: true` once the shared webhook confirms payment.
demandRouter.post('/:id/boost', requireAuth, async (req: AuthedRequest, res) => {
  const request = await prisma.demandRequest.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.requesterId !== req.userId) return res.status(403).json({ error: 'Not your request' });
  if (request.boosted) return res.status(409).json({ error: 'This want post is already boosted.' });

  const activeBoostedCount = await prisma.demandRequest.count({ where: { category: request.category, boosted: true, status: 'open' } });
  if (activeBoostedCount >= MAX_BOOSTED_PER_CATEGORY) {
    return res.status(409).json({ error: `Boost slots for ${request.category} are full right now (${MAX_BOOSTED_PER_CATEGORY}/${MAX_BOOSTED_PER_CATEGORY}). Try again once one clears.` });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  const amount = isPlusActive(user) ? 0 : 25;

  if (amount === 0) {
    await prisma.boostPayment.create({ data: { userId: req.userId!, targetType: 'demand', targetId: request.id, amount, paid: true } });
    const updated = await prisma.demandRequest.update({ where: { id: request.id }, data: { boosted: true } });
    return res.json({ request: updated, wasFree: true });
  }

  const boostPayment = await prisma.boostPayment.create({ data: { userId: req.userId!, targetType: 'demand', targetId: request.id, amount, paid: false } });

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

// Polled by the client after opening the Paymob checkout tab.
demandRouter.get('/boost-payments/:id', requireAuth, async (req: AuthedRequest, res) => {
  const boostPayment = await prisma.boostPayment.findUnique({ where: { id: req.params.id } });
  if (!boostPayment || boostPayment.userId !== req.userId) return res.status(404).json({ error: 'Not found' });
  return res.json({ paid: boostPayment.paid });
});
