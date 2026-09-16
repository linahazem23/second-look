import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireAuth, type AuthedRequest } from '../lib/auth.js';
import { detectFlaggedKeyword } from '../lib/chatModeration.js';
import { notifyNewMessage } from '../lib/email.js';
import { createOrderForListing } from './orders.routes.js';

export const inquiriesRouter = Router();

const startSchema = z.object({ listingId: z.string().min(1) });

// Find-or-create so tapping "Message seller" more than once on the same listing
// always lands back on the same thread instead of spawning duplicates.
inquiriesRouter.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const listing = await prisma.listing.findUnique({ where: { id: parsed.data.listingId } });
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.sellerId === req.userId) return res.status(422).json({ error: 'You cannot message yourself about your own listing' });

  const inquiry = await prisma.inquiry.upsert({
    where: { listingId_buyerId: { listingId: listing.id, buyerId: req.userId! } },
    update: {},
    create: { listingId: listing.id, buyerId: req.userId!, sellerId: listing.sellerId }
  });

  return res.status(201).json({ inquiry });
});

inquiriesRouter.get('/mine', requireAuth, async (req: AuthedRequest, res) => {
  const inquiries = await prisma.inquiry.findMany({
    where: { OR: [{ buyerId: req.userId }, { sellerId: req.userId }] },
    orderBy: { createdAt: 'desc' },
    include: {
      listing: { select: { title: true, images: true } },
      buyer: { select: { id: true, fullName: true, username: true } },
      seller: { select: { id: true, fullName: true, username: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 }
    }
  });

  const withUnread = inquiries.map((i) => {
    const isBuyer = i.buyerId === req.userId;
    const lastRead = isBuyer ? i.buyerLastReadAt : i.sellerLastReadAt;
    const latest = i.messages[0];
    const unread = Boolean(latest && latest.senderId !== req.userId && (!lastRead || latest.createdAt > lastRead));
    return { ...i, unread };
  });

  return res.json({ inquiries: withUnread });
});

async function assertParticipant(inquiryId: string, userId: string) {
  const inquiry = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    include: {
      listing: { select: { id: true, title: true, allowOffers: true, status: true, price: true, originalPrice: true, condition: true } },
      buyer: { select: { id: true, fullName: true, username: true, email: true, verifiedFemale: true } },
      seller: { select: { id: true, fullName: true, username: true, email: true } }
    }
  });
  if (!inquiry) return null;
  if (inquiry.buyerId !== userId && inquiry.sellerId !== userId) return undefined;
  return inquiry;
}

inquiriesRouter.get('/:id', requireAuth, async (req: AuthedRequest, res) => {
  const inquiry = await prisma.inquiry.findUnique({
    where: { id: req.params.id },
    include: {
      listing: { select: { title: true, images: true, price: true, originalPrice: true, allowOffers: true, status: true } },
      buyer: { select: { id: true, fullName: true, username: true } },
      seller: { select: { id: true, fullName: true, username: true } }
    }
  });
  if (!inquiry) return res.status(404).json({ error: 'Inquiry not found' });
  if (inquiry.buyerId !== req.userId && inquiry.sellerId !== req.userId) return res.status(403).json({ error: 'Not a participant' });
  return res.json({ inquiry });
});

inquiriesRouter.get('/:id/messages', requireAuth, async (req: AuthedRequest, res) => {
  const inquiry = await assertParticipant(req.params.id, req.userId!);
  if (inquiry === null) return res.status(404).json({ error: 'Inquiry not found' });
  if (inquiry === undefined) return res.status(403).json({ error: 'Not a participant' });

  const messages = await prisma.inquiryMessage.findMany({ where: { inquiryId: req.params.id }, orderBy: { createdAt: 'asc' } });
  return res.json({ messages });
});

const messageSchema = z
  .object({
    messageText: z.string().max(2000).optional(),
    attachmentUrl: z.string().min(1).optional(),
    attachmentType: z.enum(['image', 'video']).optional()
  })
  .refine((d) => Boolean(d.messageText?.trim()) || Boolean(d.attachmentUrl), {
    message: 'Message text or an attachment is required.'
  });

inquiriesRouter.post('/:id/messages', requireAuth, async (req: AuthedRequest, res) => {
  const inquiry = await assertParticipant(req.params.id, req.userId!);
  if (inquiry === null) return res.status(404).json({ error: 'Inquiry not found' });
  if (inquiry === undefined) return res.status(403).json({ error: 'Not a participant' });

  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const flaggedKeyword = parsed.data.messageText ? detectFlaggedKeyword(parsed.data.messageText) : null;
  const message = await prisma.inquiryMessage.create({
    data: {
      inquiryId: inquiry.id,
      senderId: req.userId!,
      messageText: parsed.data.messageText?.trim() ?? '',
      attachmentUrl: parsed.data.attachmentUrl,
      attachmentType: parsed.data.attachmentType,
      autoFlagged: Boolean(flaggedKeyword),
      flaggedKeyword
    }
  });

  const recipient = inquiry.buyerId === req.userId ? inquiry.seller : inquiry.buyer;
  const sender = inquiry.buyerId === req.userId ? inquiry.buyer : inquiry.seller;
  notifyNewMessage({
    threadType: 'inquiry',
    threadId: inquiry.id,
    recipientEmail: recipient.email,
    recipientName: recipient.fullName,
    senderName: sender.fullName,
    itemTitle: inquiry.listing.title,
    preview: message.messageText || (message.attachmentType === 'video' ? '[Video]' : '[Photo]')
  }).catch(() => {});

  return res.status(201).json({ message });
});

inquiriesRouter.post('/:id/mark-read', requireAuth, async (req: AuthedRequest, res) => {
  const inquiry = await assertParticipant(req.params.id, req.userId!);
  if (inquiry === null) return res.status(404).json({ error: 'Inquiry not found' });
  if (inquiry === undefined) return res.status(403).json({ error: 'Not a participant' });

  const field = inquiry.buyerId === req.userId ? 'buyerLastReadAt' : 'sellerLastReadAt';
  await prisma.inquiry.update({ where: { id: inquiry.id }, data: { [field]: new Date() } });
  return res.json({ ok: true });
});

const offerSchema = z.object({ amount: z.number().positive() });

// Either side can open or counter a negotiation — whoever didn't make the most
// recent offer is the one allowed to respond next (accept/decline) or counter
// by calling this again themselves.
inquiriesRouter.post('/:id/offer', requireAuth, async (req: AuthedRequest, res) => {
  const inquiry = await assertParticipant(req.params.id, req.userId!);
  if (inquiry === null) return res.status(404).json({ error: 'Inquiry not found' });
  if (inquiry === undefined) return res.status(403).json({ error: 'Not a participant' });

  if (!inquiry.listing.allowOffers) return res.status(422).json({ error: 'This seller isn\'t accepting offers on this item.' });
  if (inquiry.listing.status !== 'Active') return res.status(409).json({ error: 'This listing is no longer available.' });

  if (inquiry.offerStatus === 'pending' && inquiry.offerByUserId === req.userId) {
    return res.status(409).json({ error: 'Waiting on a response to your last offer.' });
  }
  if (inquiry.offerStatus === 'accepted') return res.status(409).json({ error: 'An offer on this item was already accepted.' });

  const parsed = offerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  if (parsed.data.amount >= inquiry.listing.price) {
    return res.status(422).json({ error: 'An offer should be below the listed price — otherwise just buy at the listed price.' });
  }

  const [message] = await prisma.$transaction([
    prisma.inquiryMessage.create({
      data: { inquiryId: inquiry.id, senderId: req.userId!, messageText: `Offered ${parsed.data.amount} EGP` }
    }),
    prisma.inquiry.update({
      where: { id: inquiry.id },
      data: { offerAmount: parsed.data.amount, offerStatus: 'pending', offerByUserId: req.userId }
    })
  ]);

  const recipient = inquiry.buyerId === req.userId ? inquiry.seller : inquiry.buyer;
  const sender = inquiry.buyerId === req.userId ? inquiry.buyer : inquiry.seller;
  notifyNewMessage({
    threadType: 'inquiry',
    threadId: inquiry.id,
    recipientEmail: recipient.email,
    recipientName: recipient.fullName,
    senderName: sender.fullName,
    itemTitle: inquiry.listing.title,
    preview: message.messageText
  }).catch(() => {});

  return res.status(201).json({ offerAmount: parsed.data.amount, offerStatus: 'pending', offerByUserId: req.userId });
});

const offerResponseSchema = z.object({ action: z.enum(['accept', 'decline']) });

inquiriesRouter.post('/:id/offer/respond', requireAuth, async (req: AuthedRequest, res) => {
  const inquiry = await assertParticipant(req.params.id, req.userId!);
  if (inquiry === null) return res.status(404).json({ error: 'Inquiry not found' });
  if (inquiry === undefined) return res.status(403).json({ error: 'Not a participant' });

  if (inquiry.offerStatus !== 'pending') return res.status(409).json({ error: 'There is no pending offer to respond to.' });
  if (inquiry.offerByUserId === req.userId) return res.status(403).json({ error: 'You made this offer — waiting on the other side to respond.' });

  const parsed = offerResponseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  if (parsed.data.action === 'decline') {
    await prisma.$transaction([
      prisma.inquiryMessage.create({ data: { inquiryId: inquiry.id, senderId: req.userId!, messageText: 'Declined the offer.' } }),
      prisma.inquiry.update({ where: { id: inquiry.id }, data: { offerStatus: 'declined' } })
    ]);
    return res.json({ offerStatus: 'declined' });
  }

  // Accept — the order's buyer is always inquiry.buyerId regardless of who
  // clicked accept, so their verification is what actually gates the charge.
  if (!inquiry.buyer.verifiedFemale) {
    return res.status(403).json({ error: 'The buyer needs to complete identity verification before this offer can be accepted.' });
  }

  let order;
  try {
    order = await createOrderForListing(inquiry.listing.id, inquiry.buyerId, inquiry.offerAmount!);
  } catch (err) {
    return res.status(409).json({ error: err instanceof Error ? err.message : 'Could not create order' });
  }

  await prisma.$transaction([
    prisma.inquiryMessage.create({ data: { inquiryId: inquiry.id, senderId: req.userId!, messageText: `Accepted the offer at ${inquiry.offerAmount} EGP` } }),
    prisma.inquiry.update({ where: { id: inquiry.id }, data: { offerStatus: 'accepted' } })
  ]);

  const recipient = inquiry.buyerId === req.userId ? inquiry.seller : inquiry.buyer;
  const sender = inquiry.buyerId === req.userId ? inquiry.buyer : inquiry.seller;
  notifyNewMessage({
    threadType: 'inquiry',
    threadId: inquiry.id,
    recipientEmail: recipient.email,
    recipientName: recipient.fullName,
    senderName: sender.fullName,
    itemTitle: inquiry.listing.title,
    preview: `Accepted the offer at ${inquiry.offerAmount} EGP`
  }).catch(() => {});

  return res.json({ offerStatus: 'accepted', orderId: order.id });
});

inquiriesRouter.post('/messages/:id/report', requireAuth, async (req: AuthedRequest, res) => {
  const message = await prisma.inquiryMessage.findUnique({ where: { id: req.params.id } });
  if (!message) return res.status(404).json({ error: 'Message not found' });

  const inquiry = await assertParticipant(message.inquiryId, req.userId!);
  if (!inquiry) return res.status(403).json({ error: 'Not a participant' });

  await prisma.inquiryMessage.update({ where: { id: message.id }, data: { reported: true } });
  return res.json({ reported: true });
});
