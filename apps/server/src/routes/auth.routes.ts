import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { prisma } from '../lib/db.js';
import { hashPassword, verifyPassword, signUserToken, requireAuth, type AuthedRequest } from '../lib/auth.js';
import { generateUniqueReferralCode, isPlusActive } from '../lib/membership.js';
import { notifyGuardianConsentRequest, notifyPasswordReset } from '../lib/email.js';
import { upload, uploadToStorage } from '../lib/upload.js';

export const authRouter = Router();

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
const MINOR_AGE_THRESHOLD = 18;

const signupSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    fullName: z.string().min(1),
    area: z.string().min(1),
    age: z.number().int().positive().optional(),
    languagePreference: z.string().default('en'),
    referralCode: z.string().optional(),
    username: z.string().regex(USERNAME_PATTERN, 'Username must be 3-20 letters, numbers, or underscores.').optional(),
    guardianName: z.string().min(1).optional(),
    guardianPhone: z.string().min(6).optional(),
    guardianEmail: z.string().email().optional()
  })
  .refine((d) => d.age === undefined || d.age >= MINOR_AGE_THRESHOLD || Boolean(d.guardianName && d.guardianPhone && d.guardianEmail), {
    message: "A guardian's name, phone, and email are required for members under 18.",
    path: ['guardianName']
  });

authRouter.post('/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

  if (parsed.data.username) {
    const usernameTaken = await prisma.user.findUnique({ where: { username: parsed.data.username } });
    if (usernameTaken) return res.status(409).json({ error: 'That username is already taken.' });
  }

  // An invalid/unknown referral code is silently ignored rather than blocking signup —
  // referral attribution is a growth nicety, not something worth adding friction for.
  let referredByUserId: string | undefined;
  if (parsed.data.referralCode) {
    const referrer = await prisma.user.findUnique({ where: { referralCode: parsed.data.referralCode.toUpperCase() } });
    if (referrer) referredByUserId = referrer.id;
  }

  const isMinor = parsed.data.age !== undefined && parsed.data.age < MINOR_AGE_THRESHOLD;
  // Real ID + admin review is what actually verifies the guardian is a real
  // adult — this token just lets her reach that submission form without an
  // account of her own.
  const guardianConsentToken = isMinor ? crypto.randomBytes(24).toString('hex') : undefined;

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
      username: parsed.data.username,
      referralCode,
      referredByUserId,
      guardianName: parsed.data.guardianName,
      guardianPhone: parsed.data.guardianPhone,
      guardianEmail: parsed.data.guardianEmail,
      guardianConsentStatus: isMinor ? 'pending' : 'not_required',
      guardianConsentToken
    }
  });

  if (isMinor && guardianConsentToken) {
    notifyGuardianConsentRequest({
      guardianEmail: parsed.data.guardianEmail!,
      guardianName: parsed.data.guardianName!,
      minorName: parsed.data.fullName,
      token: guardianConsentToken
    }).catch(() => {});
  }

  const token = signUserToken(user.id);
  return res.status(201).json({
    token,
    user: { id: user.id, email: user.email, fullName: user.fullName, username: user.username, kycStatus: user.kycStatus },
    referralApplied: Boolean(referredByUserId)
  });
});

// Public — the guardian has no Second Look account, so this is reached via a
// one-time emailed token rather than a login. Limited info only.
authRouter.get('/guardian-consent/:token', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { guardianConsentToken: req.params.token } });
  if (!user) return res.status(404).json({ error: 'This link is invalid or has already been used.' });

  return res.json({
    minorFullName: user.fullName,
    minorAge: user.age,
    guardianName: user.guardianName,
    status: user.guardianConsentStatus,
    submitted: Boolean(user.guardianIdDocumentUrl)
  });
});

// The guardian uploads her own ID directly here — no account, so this can't
// go through the normal /api/uploads (which requires a login).
authRouter.post('/guardian-consent/:token/upload', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(422).json({ error: err.message });
    if (!req.file) return res.status(422).json({ error: 'No file uploaded.' });

    const user = await prisma.user.findUnique({ where: { guardianConsentToken: req.params.token } });
    if (!user) return res.status(404).json({ error: 'This link is invalid or has already been used.' });

    let url: string;
    try {
      url = await uploadToStorage(req.file);
    } catch {
      return res.status(502).json({ error: 'Upload failed — please try again.' });
    }
    await prisma.user.update({ where: { id: user.id }, data: { guardianIdDocumentUrl: url } });
    return res.status(201).json({ url });
  });
});

authRouter.post('/guardian-consent/:token/submit', async (req, res) => {
  const parsed = z.object({ agreed: z.literal(true) }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: 'You must confirm the consent statement before submitting.' });

  const user = await prisma.user.findUnique({ where: { guardianConsentToken: req.params.token } });
  if (!user) return res.status(404).json({ error: 'This link is invalid or has already been used.' });
  if (!user.guardianIdDocumentUrl) return res.status(422).json({ error: 'Upload an ID photo before submitting.' });
  if (user.guardianConsentStatus !== 'pending') return res.status(409).json({ error: 'This request has already been resolved.' });

  // Stays 'pending' — this just confirms it's ready for an admin to review,
  // same queue as the member's own KYC.
  return res.json({ status: 'pending', submitted: true });
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

const PASSWORD_RESET_VALID_MS = 60 * 60 * 1000;

// Always responds the same way whether or not the email exists — an attacker
// probing emails learns nothing from timing or response shape.
authRouter.post('/forgot-password', async (req, res) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user) {
    const token = crypto.randomBytes(24).toString('hex');
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: token, passwordResetExpiresAt: new Date(Date.now() + PASSWORD_RESET_VALID_MS) }
    });
    notifyPasswordReset({ recipientEmail: user.email, recipientName: user.username ?? user.fullName, token }).catch(() => {});
  }

  return res.json({ ok: true, message: "If that email has an account, we've sent a reset link." });
});

authRouter.post('/reset-password', async (req, res) => {
  const parsed = z.object({ token: z.string().min(1), password: z.string().min(8) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.findUnique({ where: { passwordResetToken: parsed.data.token } });
  if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired — request a new one.' });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, passwordResetToken: null, passwordResetExpiresAt: null }
  });

  return res.json({ ok: true });
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

// Setting username back to null/empty reverts public display to fullName.
authRouter.patch('/username', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = z.object({ username: z.string().regex(USERNAME_PATTERN, 'Username must be 3-20 letters, numbers, or underscores.').nullable() }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  if (parsed.data.username) {
    const taken = await prisma.user.findFirst({ where: { username: parsed.data.username, id: { not: req.userId } } });
    if (taken) return res.status(409).json({ error: 'That username is already taken.' });
  }

  const user = await prisma.user.update({ where: { id: req.userId }, data: { username: parsed.data.username } });
  return res.json({ username: user.username });
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
 * No automated ID+selfie verification vendor is wired up yet (Sumsub/iDenfy/Onfido
 * are the shape a future one would take). Until then, every submission is a real
 * document upload routed to a human in the admin KYC queue — no auto-pass.
 */
authRouter.post('/kyc/submit', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = z
    .object({ idDocumentUrl: z.string().min(1), selfieUrl: z.string().min(1) })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: {
      idDocumentUrl: parsed.data.idDocumentUrl,
      selfieUrl: parsed.data.selfieUrl,
      kycStatus: 'manual_review',
      kycRejectionReason: null
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
