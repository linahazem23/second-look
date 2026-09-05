import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { hashPassword, verifyPassword, signUserToken, requireAuth, type AuthedRequest } from '../lib/auth.js';
import { generateUniqueReferralCode, isPlusActive } from '../lib/membership.js';

export const authRouter = Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  area: z.string().min(1),
  age: z.number().int().positive().optional(),
  languagePreference: z.string().default('en'),
  referralCode: z.string().optional()
});

authRouter.post('/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

  // Under-18 is an explicitly unresolved policy area (legal/child-safety review pending) —
  // block signup rather than silently deciding a minors pathway.
  if (parsed.data.age !== undefined && parsed.data.age < 18) {
    return res.status(422).json({
      error: 'Second Look is not yet able to support accounts under 18. This is a pending policy decision, not a bug.'
    });
  }

  // An invalid/unknown referral code is silently ignored rather than blocking signup —
  // referral attribution is a growth nicety, not something worth adding friction for.
  let referredByUserId: string | undefined;
  if (parsed.data.referralCode) {
    const referrer = await prisma.user.findUnique({ where: { referralCode: parsed.data.referralCode.toUpperCase() } });
    if (referrer) referredByUserId = referrer.id;
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const referralCode = await generateUniqueReferralCode();
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      passwordHash,
      fullName: parsed.data.fullName,
      area: parsed.data.area,
      age: parsed.data.age,
      languagePreference: parsed.data.languagePreference,
      referralCode,
      referredByUserId
    }
  });

  const token = signUserToken(user.id);
  return res.status(201).json({
    token,
    user: { id: user.id, email: user.email, fullName: user.fullName, kycStatus: user.kycStatus },
    referralApplied: Boolean(referredByUserId)
  });
});

authRouter.post('/login', async (req, res) => {
  const parsed = z.object({ email: z.string().email(), password: z.string() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = signUserToken(user.id);
  return res.json({ token, user: { id: user.id, email: user.email, fullName: user.fullName, status: user.status } });
});

authRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  const acceptedSlideCount = await prisma.guidelineAcceptance.count({ where: { userId: user.id } });
  const { passwordHash, ...safe } = user;
  return res.json({
    user: {
      ...safe,
      guidelinesComplete: acceptedSlideCount === 4,
      profileQuizComplete: Boolean(user.skinType && user.hairType),
      isPlusActive: isPlusActive(user)
    }
  });
});

const profileQuizSchema = z.object({
  skinType: z.enum(['Oily', 'Dry', 'Combination', 'Normal', 'Sensitive']),
  hairType: z.enum(['Straight', 'Wavy', 'Curly', 'Coily']),
  clothingSize: z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL']).optional()
});

authRouter.post('/profile-quiz', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = profileQuizSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const user = await prisma.user.update({ where: { id: req.userId }, data: parsed.data });
  return res.json({ skinType: user.skinType, hairType: user.hairType, clothingSize: user.clothingSize });
});

/**
 * KYC is modeled as a call out to an external ID+selfie verification provider
 * (Sumsub/iDenfy/Onfido-shaped). No real vendor is wired up here — this simulates
 * the ~90% auto-pass rate and routes the rest to manual admin review, which is the
 * actual integration boundary a real provider webhook would replace.
 */
authRouter.post('/kyc/submit', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = z
    .object({ idDocumentUrl: z.string().min(1), selfieUrl: z.string().min(1) })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const autoPass = Math.random() < 0.9;
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: {
      kycStatus: autoPass ? 'approved' : 'manual_review',
      verifiedFemale: autoPass
    }
  });

  return res.json({ kycStatus: user.kycStatus, verifiedFemale: user.verifiedFemale });
});

const guidelineSlideSchema = z.object({ slideIndex: z.number().int().min(0).max(3) });

authRouter.post('/guidelines/accept-slide', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = guidelineSlideSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Each of the 4 slides is logged individually with its own timestamp — this is
  // the evidence trail referenced in the chat-monitoring disclosure requirement.
  const acceptance = await prisma.guidelineAcceptance.upsert({
    where: { userId_slideIndex: { userId: req.userId!, slideIndex: parsed.data.slideIndex } },
    update: {},
    create: { userId: req.userId!, slideIndex: parsed.data.slideIndex }
  });

  const totalAccepted = await prisma.guidelineAcceptance.count({ where: { userId: req.userId } });
  return res.status(201).json({ acceptance, allFourSlidesComplete: totalAccepted === 4 });
});
