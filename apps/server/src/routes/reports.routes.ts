import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireAuth, type AuthedRequest } from '../lib/auth.js';

export const reportsRouter = Router();

const REPORT_REASONS = [
  'price_unreasonable', // default-selected in the UI
  'photo_mismatch',
  'authenticity_concern',
  'something_else'
] as const;

const listingReportSchema = z.object({
  listingId: z.string().min(1),
  reason: z.enum(REPORT_REASONS).default('price_unreasonable'),
  detailText: z.string().optional()
});

reportsRouter.post('/listings', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = listingReportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const listing = await prisma.listing.findUnique({ where: { id: parsed.data.listingId } });
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  // A single report is sufficient — hide immediately, no multi-report threshold.
  const [report] = await prisma.$transaction([
    prisma.listingReport.create({
      data: {
        listingId: listing.id,
        reporterId: req.userId!,
        reason: parsed.data.reason,
        detailText: parsed.data.detailText,
        originalPrice: listing.originalPrice,
        listedPrice: listing.price
      }
    }),
    prisma.listing.update({ where: { id: listing.id }, data: { status: 'UnderReview' } })
  ]);

  return res.status(201).json({ report });
});
