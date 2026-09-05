import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireAuth, type AuthedRequest } from '../lib/auth.js';
import {
  generateUniqueReferralCode,
  grantMembershipDays,
  isGrowthPromoUnlocked,
  isPlusActive,
  MEMBERSHIP_GRANT_DAYS,
  REFERRAL_BATCH_SIZE,
  VIDEO_PROMO_MAX_GRANTS
} from '../lib/membership.js';

export const growthRouter = Router();

growthRouter.get('/status', requireAuth, async (req: AuthedRequest, res) => {
  let user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });

  // Referral codes are lazily backfilled for accounts created before this feature existed.
  if (!user.referralCode) {
    const referralCode = await generateUniqueReferralCode();
    user = await prisma.user.update({ where: { id: user.id }, data: { referralCode } });
  }

  const unlocked = await isGrowthPromoUnlocked(user.id);
  const verifiedReferralCount = await prisma.user.count({ where: { referredByUserId: user.id, verifiedFemale: true } });
  const claimableReferralBatches = Math.max(0, Math.floor(verifiedReferralCount / REFERRAL_BATCH_SIZE) - user.referralRewardsGranted);
  const pendingVideo = await prisma.videoSubmission.findFirst({ where: { userId: user.id, status: 'pending' } });
  const lastVideo = await prisma.videoSubmission.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });

  return res.json({
    unlocked,
    referralCode: user.referralCode,
    verifiedReferralCount,
    referralBatchSize: REFERRAL_BATCH_SIZE,
    referralRewardsGranted: user.referralRewardsGranted,
    claimableReferralBatches,
    videoPromoGrantsUsed: user.videoPromoGrantsUsed,
    videoPromoMaxGrants: VIDEO_PROMO_MAX_GRANTS,
    videoPromoRemaining: Math.max(0, VIDEO_PROMO_MAX_GRANTS - user.videoPromoGrantsUsed),
    pendingVideoSubmission: pendingVideo,
    lastVideoSubmission: lastVideo,
    membershipExpiresAt: user.membershipExpiresAt,
    isPlusActive: isPlusActive(user)
  });
});

growthRouter.post('/submit-video', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = z.object({ videoUrl: z.string().url() }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  if (!(await isGrowthPromoUnlocked(user.id))) {
    return res.status(403).json({ error: 'Post 3 listings to unlock the growth rewards.' });
  }
  if (user.videoPromoGrantsUsed >= VIDEO_PROMO_MAX_GRANTS) {
    return res.status(422).json({ error: `The video reward is capped at ${VIDEO_PROMO_MAX_GRANTS} lifetime grants, and you've used them all.` });
  }
  const pending = await prisma.videoSubmission.findFirst({ where: { userId: user.id, status: 'pending' } });
  if (pending) return res.status(409).json({ error: 'You already have a video pending review.' });

  const submission = await prisma.videoSubmission.create({ data: { userId: user.id, videoUrl: parsed.data.videoUrl } });
  return res.status(201).json({ submission });
});

growthRouter.post('/claim-referral-reward', requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  if (!(await isGrowthPromoUnlocked(user.id))) {
    return res.status(403).json({ error: 'Post 3 listings to unlock the growth rewards.' });
  }

  const verifiedReferralCount = await prisma.user.count({ where: { referredByUserId: user.id, verifiedFemale: true } });
  const claimableBatches = Math.max(0, Math.floor(verifiedReferralCount / REFERRAL_BATCH_SIZE) - user.referralRewardsGranted);
  if (claimableBatches <= 0) {
    return res.status(422).json({ error: `You need ${REFERRAL_BATCH_SIZE} more verified referrals to earn a reward.` });
  }

  await prisma.user.update({ where: { id: user.id }, data: { referralRewardsGranted: { increment: claimableBatches } } });
  const updated = await grantMembershipDays(user.id, claimableBatches * MEMBERSHIP_GRANT_DAYS);

  return res.json({ grantedBatches: claimableBatches, membershipExpiresAt: updated.membershipExpiresAt });
});
