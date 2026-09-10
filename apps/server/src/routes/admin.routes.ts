import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { hashPassword, verifyPassword, signAdminToken, requireAdmin, requireRole, type AuthedRequest } from '../lib/auth.js';
import { applyStrike, applyImmediateBlock, hasActiveEscrowOrder } from '../lib/strikes.js';
import { grantMembershipDays, MEMBERSHIP_GRANT_DAYS, VIDEO_PROMO_MAX_GRANTS } from '../lib/membership.js';

export const adminRouter = Router();

adminRouter.post('/auth/login', async (req, res) => {
  const parsed = z.object({ email: z.string().email(), password: z.string() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const admin = await prisma.adminUser.findUnique({ where: { email: parsed.data.email } });
  if (!admin || !(await verifyPassword(parsed.data.password, admin.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = signAdminToken(admin.id, admin.role);
  return res.json({ token, admin: { id: admin.id, fullName: admin.fullName, role: admin.role } });
});

adminRouter.use(requireAdmin);

adminRouter.post('/me/change-password', async (req: AuthedRequest, res) => {
  const parsed = z.object({ currentPassword: z.string(), newPassword: z.string().min(8) }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const admin = await prisma.adminUser.findUniqueOrThrow({ where: { id: req.adminId } });
  if (!(await verifyPassword(parsed.data.currentPassword, admin.passwordHash))) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.adminUser.update({ where: { id: admin.id }, data: { passwordHash } });
  return res.json({ ok: true });
});

// ---- Overview ----
adminRouter.get('/overview', async (_req, res) => {
  const [activeUsers, liveListings, ordersThisWeek, openCases, pendingAppeals, pendingReports, pendingKyc, pendingVideoSubmissions, recentOrders, ageBuckets] =
    await Promise.all([
      prisma.user.count({ where: { status: { not: 'Blocked' } } }),
      prisma.listing.count({ where: { status: 'Active' } }),
      prisma.order.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
      prisma.moderationCase.count({ where: { status: 'open' } }),
      prisma.appeal.count({ where: { status: 'pending' } }),
      prisma.listingReport.count({ where: { status: 'under_review' } }),
      prisma.user.count({ where: { kycStatus: 'manual_review' } }),
      prisma.videoSubmission.count({ where: { status: 'pending' } }),
      prisma.order.findMany({ take: 10, orderBy: { createdAt: 'desc' }, include: { buyer: true, seller: true, listing: true } }),
      prisma.user.findMany({ select: { age: true } })
    ]);

  const ageDistribution: Record<string, number> = {};
  for (const { age } of ageBuckets) {
    if (age == null) continue;
    const bucket = `${Math.floor(age / 10) * 10}s`;
    ageDistribution[bucket] = (ageDistribution[bucket] ?? 0) + 1;
  }

  return res.json({
    stats: { activeUsers, liveListings, ordersThisWeek, openCases, pendingAppeals, pendingReports, pendingKyc, pendingVideoSubmissions },
    ageDistribution,
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      buyer: o.buyer.fullName,
      seller: o.seller.fullName,
      item: o.listing.title,
      amount: o.amount,
      escrowStatus: o.escrowStatus,
      createdAt: o.createdAt
    }))
  });
});

// ---- Users ----
adminRouter.get('/users', async (req, res) => {
  const q = req.query.q as string | undefined;
  const users = await prisma.user.findMany({
    where: q ? { fullName: { contains: q, mode: 'insensitive' } } : undefined,
    orderBy: { createdAt: 'desc' }
  });
  return res.json({
    users: users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      status: u.status,
      kycStatus: u.kycStatus,
      buyOnlyUntil: u.buyOnlyUntil,
      blockedUntil: u.blockedUntil,
      completedSalesCount: u.completedSalesCount,
      flagCount: u.flagCount,
      createdAt: u.createdAt
    }))
  });
});

// ---- KYC manual review queue ----
adminRouter.get('/kyc-pending', async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { kycStatus: 'manual_review' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, fullName: true, email: true, area: true, age: true, createdAt: true, idDocumentUrl: true, selfieUrl: true }
  });
  return res.json({ users });
});

adminRouter.post('/kyc-pending/:id/approve', async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { kycStatus: 'approved', verifiedFemale: true, kycRejectionReason: null }
  });
  return res.json({ user: { id: user.id, kycStatus: user.kycStatus, verifiedFemale: user.verifiedFemale } });
});

adminRouter.post('/kyc-pending/:id/reject', async (req, res) => {
  const parsed = z.object({ reason: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { kycStatus: 'rejected', verifiedFemale: false, kycRejectionReason: parsed.data.reason }
  });
  return res.json({ user: { id: user.id, kycStatus: user.kycStatus }, reason: parsed.data.reason });
});

adminRouter.post('/users/:id/immediate-block', requireRole('super_admin'), async (req: AuthedRequest, res) => {
  const parsed = z.object({ permanent: z.boolean().default(false), reason: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  // Severe/unambiguous violations skip the strike ladder entirely, at moderator discretion.
  const user = await applyImmediateBlock(req.params.id, parsed.data.permanent);
  await prisma.moderationCase.create({
    data: {
      contextType: 'immediate_action',
      contextId: req.params.id,
      reviewedUserId: req.params.id,
      status: 'resolved',
      reason: parsed.data.reason,
      resolvedByAdminId: req.adminId,
      resolvedAt: new Date()
    }
  });
  return res.json({ user });
});

// ---- Listings ----
adminRouter.get('/listings', async (req, res) => {
  const status = req.query.status as string | undefined;
  const listings = await prisma.listing.findMany({
    where: status ? { status: status as any } : undefined,
    orderBy: { createdAt: 'desc' },
    include: { seller: { select: { fullName: true } } }
  });
  return res.json({ listings });
});

adminRouter.post('/listings/:id/remove', async (req, res) => {
  const listing = await prisma.listing.update({ where: { id: req.params.id }, data: { status: 'Removed' } });
  return res.json({ listing });
});

// ---- Orders ----
adminRouter.get('/orders', async (_req, res) => {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    include: { buyer: { select: { fullName: true } }, seller: { select: { fullName: true } }, listing: true, trackingLinks: true }
  });
  return res.json({ orders });
});

// ---- Moderation queue ----
adminRouter.get('/moderation-cases', async (req, res) => {
  const status = (req.query.status as string) ?? 'open';
  // Side-by-side detail (reviewer's story vs reviewed party's history) lives in
  // reviewerNotes/reviewedNotes on the case itself — no relation include needed.
  const cases = await prisma.moderationCase.findMany({
    where: { status },
    orderBy: { createdAt: 'desc' }
  });
  return res.json({ cases });
});

adminRouter.post('/moderation-cases/:id/coach', async (req: AuthedRequest, res) => {
  const modCase = await prisma.moderationCase.findUnique({ where: { id: req.params.id } });
  if (!modCase) return res.status(404).json({ error: 'Case not found' });
  const targetUserId = modCase.flagTarget === 'reviewer' ? modCase.reviewerId : modCase.reviewedUserId;
  if (!targetUserId) return res.status(422).json({ error: 'Case has no target user' });

  // Coaching is a private message with no visible mark or restriction — not a strike.
  await prisma.moderationCase.update({
    where: { id: modCase.id },
    data: { status: 'resolved', resolvedAt: new Date(), resolvedByAdminId: req.adminId, notes: 'Coached privately' }
  });
  return res.json({ outcome: 'coached', targetUserId });
});

adminRouter.post('/moderation-cases/:id/escalate', async (req: AuthedRequest, res) => {
  const modCase = await prisma.moderationCase.findUnique({ where: { id: req.params.id } });
  if (!modCase) return res.status(404).json({ error: 'Case not found' });
  const targetUserId = modCase.flagTarget === 'reviewer' ? modCase.reviewerId : modCase.reviewedUserId;
  if (!targetUserId) return res.status(422).json({ error: 'Case has no target user' });

  // Enforcement never interrupts an order already in escrow — actually enforced in
  // requireAuth (lib/auth.ts), which still lets a blocked/restricted user finish
  // any order they were already a participant in. This just reports it for visibility.
  const hasOrderInFlight = await hasActiveEscrowOrder(targetUserId);
  const result = await applyStrike(targetUserId);

  await prisma.moderationCase.update({
    where: { id: modCase.id },
    data: { status: 'resolved', resolvedAt: new Date(), resolvedByAdminId: req.adminId, notes: `Escalated: ${result.tier}` }
  });

  return res.json({ outcome: result.tier, targetUserId, hasOrderInFlight });
});

adminRouter.post('/moderation-cases/:id/flag-reviewer-instead', async (req: AuthedRequest, res) => {
  // The symmetric fork: if the reviewed person's account holds up, the case flips
  // and the reviewer becomes the target — an equally first-class action.
  const modCase = await prisma.moderationCase.update({
    where: { id: req.params.id },
    data: { flagTarget: 'reviewer' }
  });
  return res.json({ case: modCase });
});

adminRouter.post('/moderation-cases/:id/dismiss', async (req: AuthedRequest, res) => {
  const modCase = await prisma.moderationCase.update({
    where: { id: req.params.id },
    data: { status: 'resolved', resolvedAt: new Date(), resolvedByAdminId: req.adminId, notes: 'Dismissed' }
  });
  return res.json({ case: modCase });
});

// ---- Appeals queue ----
adminRouter.get('/appeals', async (req, res) => {
  const status = (req.query.status as string) ?? 'pending';
  const appeals = await prisma.appeal.findMany({ where: { status }, orderBy: { createdAt: 'asc' } });
  return res.json({ appeals });
});

const appealDecisionSchema = z.object({ outcome: z.enum(['overturn', 'uphold']), reason: z.string().min(1) });

adminRouter.post('/appeals/:id/decide', async (req: AuthedRequest, res) => {
  const appeal = await prisma.appeal.findUnique({ where: { id: req.params.id } });
  if (!appeal) return res.status(404).json({ error: 'Appeal not found' });

  // A different moderator must review the appeal than made the original decision.
  if (appeal.originalModeratorId && appeal.originalModeratorId === req.adminId) {
    return res.status(403).json({ error: 'You made the original decision — a different moderator must review this appeal.' });
  }

  const parsed = appealDecisionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const updated = await prisma.appeal.update({
    where: { id: appeal.id },
    data: { status: parsed.data.outcome, decisionReason: parsed.data.reason, moderatorId: req.adminId, reviewedAt: new Date() }
  });

  if (parsed.data.outcome === 'overturn') {
    await prisma.user.update({ where: { id: appeal.userId }, data: { status: 'Good', buyOnlyUntil: null, blockedUntil: null } });
  }

  return res.json({ appeal: updated });
});

// ---- Reported listings queue ----
adminRouter.get('/reported-listings', async (req, res) => {
  const status = (req.query.status as string) ?? 'under_review';
  const reports = await prisma.listingReport.findMany({
    where: { status },
    orderBy: { createdAt: 'desc' },
    include: { listing: { include: { seller: { select: { fullName: true } } } } }
  });
  return res.json({ reports });
});

adminRouter.post('/reported-listings/:id/restore', async (req, res) => {
  const report = await prisma.listingReport.findUnique({ where: { id: req.params.id } });
  if (!report) return res.status(404).json({ error: 'Report not found' });

  await prisma.$transaction([
    prisma.listingReport.update({ where: { id: report.id }, data: { status: 'restored' } }),
    prisma.listing.update({ where: { id: report.listingId }, data: { status: 'Active' } })
  ]);
  return res.json({ outcome: 'restored' });
});

adminRouter.post('/reported-listings/:id/remove', async (req, res) => {
  const report = await prisma.listingReport.findUnique({ where: { id: req.params.id } });
  if (!report) return res.status(404).json({ error: 'Report not found' });

  await prisma.$transaction([
    prisma.listingReport.update({ where: { id: report.id }, data: { status: 'removed' } }),
    prisma.listing.update({ where: { id: report.listingId }, data: { status: 'Removed' } })
  ]);
  return res.json({ outcome: 'removed' });
});

adminRouter.post('/reported-listings/:id/coaching-tip', async (req: AuthedRequest, res) => {
  const report = await prisma.listingReport.findUnique({ where: { id: req.params.id }, include: { listing: true } });
  if (!report) return res.status(404).json({ error: 'Report not found' });

  // Explicitly separate from the review-flag strike system: this never counts as a flag or strike.
  await prisma.listingReport.update({ where: { id: report.id }, data: { status: 'coached' } });
  return res.json({
    outcome: 'coaching_tip_sent',
    countsAsStrike: false,
    sellerId: report.listing.sellerId,
    message: "Buyers found your price high relative to the item's condition — consider adjusting it."
  });
});

// ---- Reviews ----
adminRouter.get('/reviews', async (_req, res) => {
  const reviews = await prisma.review.findMany({ orderBy: [{ flagged: 'desc' }, { createdAt: 'desc' }] });
  return res.json({ reviews });
});

// ---- Chats ----
adminRouter.get('/chats', async (_req, res) => {
  const orders = await prisma.order.findMany({
    include: {
      chats: { orderBy: { createdAt: 'desc' }, take: 1 },
      trackingLinks: true,
      buyer: { select: { fullName: true } },
      seller: { select: { fullName: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  return res.json({
    threads: orders.map((o) => ({
      orderId: o.id,
      buyer: o.buyer.fullName,
      seller: o.seller.fullName,
      deliveryMethod: o.deliveryMethod,
      hasTrackingLink: o.trackingLinks.length > 0,
      lastMessage: o.chats[0] ?? null
    }))
  });
});

adminRouter.get('/chats/:orderId', async (req, res) => {
  const [messages, trackingLinks] = await Promise.all([
    prisma.chat.findMany({ where: { orderId: req.params.orderId }, orderBy: { createdAt: 'asc' } }),
    prisma.trackingLink.findMany({ where: { orderId: req.params.orderId } })
  ]);
  // Delivery-link record is shown regardless of report status — visible to ops at any time.
  return res.json({ messages, trackingLinks });
});

adminRouter.post('/chats/:orderId/open-case', async (req: AuthedRequest, res) => {
  const parsed = z.object({ reviewedUserId: z.string().min(1), reason: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const modCase = await prisma.moderationCase.create({
    data: {
      contextType: 'chat_escalation',
      contextId: req.params.orderId,
      reviewedUserId: parsed.data.reviewedUserId,
      reason: parsed.data.reason
    }
  });
  return res.status(201).json({ case: modCase });
});

// ---- Ads ----
adminRouter.get('/ads', async (_req, res) => {
  const ads = await prisma.ad.findMany({ orderBy: { startDate: 'desc' } });
  return res.json({ ads });
});

const adSchema = z.object({
  slotType: z.enum(['top_banner', 'in_feed_sponsored_card']),
  brand: z.string().min(1),
  creativeUrl: z.string().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date()
});

adminRouter.post('/ads', requireRole('super_admin'), async (req, res) => {
  const parsed = adSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const ad = await prisma.ad.create({ data: parsed.data });
  return res.status(201).json({ ad });
});

// ---- Global search ----
adminRouter.get('/search', async (req, res) => {
  const q = (req.query.q as string) ?? '';
  if (!q) return res.json({ orders: [], users: [], moderationCases: [], reportedListings: [] });

  const [orders, users, moderationCases, reportedListings] = await Promise.all([
    prisma.order.findMany({
      where: { id: { contains: q } },
      take: 5,
      include: { buyer: { select: { fullName: true } }, seller: { select: { fullName: true } } }
    }),
    prisma.user.findMany({ where: { fullName: { contains: q, mode: 'insensitive' } }, take: 5 }),
    prisma.moderationCase.findMany({ where: { reason: { contains: q, mode: 'insensitive' } }, take: 5 }),
    prisma.listingReport.findMany({
      where: { detailText: { contains: q, mode: 'insensitive' } },
      take: 5,
      include: { listing: true }
    })
  ]);

  return res.json({ orders, users, moderationCases, reportedListings });
});

// ---- Admin account management (super_admin only) ----
adminRouter.get('/admins', requireRole('super_admin'), async (_req, res) => {
  const admins = await prisma.adminUser.findMany({ orderBy: { createdAt: 'asc' } });
  return res.json({ admins: admins.map(({ passwordHash, ...safe }) => safe) });
});

const createAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  role: z.enum(['super_admin', 'moderator'])
});

adminRouter.post('/admins', requireRole('super_admin'), async (req, res) => {
  const parsed = createAdminSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const existing = await prisma.adminUser.findUnique({ where: { email: parsed.data.email } });
  if (existing) return res.status(409).json({ error: 'An admin with this email already exists.' });

  const passwordHash = await hashPassword(parsed.data.password);
  const admin = await prisma.adminUser.create({
    data: { email: parsed.data.email, passwordHash, fullName: parsed.data.fullName, role: parsed.data.role }
  });
  const { passwordHash: _drop, ...safe } = admin;
  return res.status(201).json({ admin: safe });
});

// ---- Growth promo: TikTok video review queue ----
adminRouter.get('/video-submissions', async (req, res) => {
  const status = (req.query.status as string) ?? 'pending';
  const submissions = await prisma.videoSubmission.findMany({
    where: { status },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { id: true, fullName: true, email: true, videoPromoGrantsUsed: true } } }
  });
  return res.json({ submissions });
});

adminRouter.post('/video-submissions/:id/approve', async (req: AuthedRequest, res) => {
  const submission = await prisma.videoSubmission.findUnique({ where: { id: req.params.id } });
  if (!submission) return res.status(404).json({ error: 'Submission not found' });
  if (submission.status !== 'pending') return res.status(409).json({ error: 'Already reviewed' });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: submission.userId } });
  // Authoritative cap check happens here, at grant time — not just at submission time.
  if (user.videoPromoGrantsUsed >= VIDEO_PROMO_MAX_GRANTS) {
    return res.status(422).json({ error: `This member has already used all ${VIDEO_PROMO_MAX_GRANTS} lifetime video grants.` });
  }

  await prisma.$transaction([
    prisma.videoSubmission.update({
      where: { id: submission.id },
      data: { status: 'approved', reviewedByAdminId: req.adminId, reviewedAt: new Date() }
    }),
    prisma.user.update({ where: { id: user.id }, data: { videoPromoGrantsUsed: { increment: 1 } } })
  ]);
  const updatedUser = await grantMembershipDays(user.id, MEMBERSHIP_GRANT_DAYS);

  return res.json({ outcome: 'approved', membershipExpiresAt: updatedUser.membershipExpiresAt });
});

adminRouter.post('/video-submissions/:id/reject', async (req: AuthedRequest, res) => {
  const parsed = z.object({ reason: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const submission = await prisma.videoSubmission.findUnique({ where: { id: req.params.id } });
  if (!submission) return res.status(404).json({ error: 'Submission not found' });
  if (submission.status !== 'pending') return res.status(409).json({ error: 'Already reviewed' });

  const updated = await prisma.videoSubmission.update({
    where: { id: submission.id },
    data: { status: 'rejected', rejectionReason: parsed.data.reason, reviewedByAdminId: req.adminId, reviewedAt: new Date() }
  });
  return res.json({ submission: updated });
});
