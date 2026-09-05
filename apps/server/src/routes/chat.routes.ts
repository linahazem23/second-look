import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireAuth, type AuthedRequest } from '../lib/auth.js';
import { detectFlaggedKeyword } from '../lib/chatModeration.js';

export const chatRouter = Router();

const SUPPORT_QUICK_REPLIES: Record<string, string> = {
  paid_after_sale: "Payment releases to you as soon as the buyer confirms delivery in-app. It's held in escrow until then.",
  item_mismatch: "Second Look has no returns once delivery is confirmed and payment released. Your item review should reflect what happened, and you're welcome to relist an item yourself.",
  buy_only_restriction: 'A buy-only restriction means your active listings are removed and you cannot post new ones for the restriction period, but you can still browse and buy normally.',
  ship_without_meeting: 'You can arrange delivery via Uber Courier or inDrive Delivery directly, and share the tracking link in your order chat.',
  report_someone: "Use the report icon in chat, or report a listing/review directly — a moderator reviews every report."
};

// Registered before the generic '/:orderId/messages' routes below — otherwise
// Express matches "support" as an orderId and these never get reached.
chatRouter.get('/support/quick-replies', requireAuth, async (_req, res) => {
  return res.json({ quickReplies: SUPPORT_QUICK_REPLIES });
});

chatRouter.get('/support/messages', requireAuth, async (req: AuthedRequest, res) => {
  const messages = await prisma.supportMessage.findMany({ where: { userId: req.userId }, orderBy: { createdAt: 'asc' } });
  return res.json({ messages });
});

chatRouter.post('/support/messages', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = z.object({ body: z.string().min(1), quickReplyKey: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const message = await prisma.supportMessage.create({
    data: { userId: req.userId!, body: parsed.data.body, quickReplyKey: parsed.data.quickReplyKey }
  });

  if (parsed.data.quickReplyKey && SUPPORT_QUICK_REPLIES[parsed.data.quickReplyKey]) {
    const reply = await prisma.supportMessage.create({
      data: {
        userId: req.userId!,
        body: SUPPORT_QUICK_REPLIES[parsed.data.quickReplyKey],
        fromSupport: true,
        quickReplyKey: parsed.data.quickReplyKey
      }
    });
    return res.status(201).json({ message, autoReply: reply });
  }

  return res.status(201).json({ message, autoReply: null });
});

async function assertParticipant(orderId: string, userId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return null;
  if (order.buyerId !== userId && order.sellerId !== userId) return undefined;
  return order;
}

chatRouter.get('/:orderId/messages', requireAuth, async (req: AuthedRequest, res) => {
  const order = await assertParticipant(req.params.orderId, req.userId!);
  if (order === null) return res.status(404).json({ error: 'Order not found' });
  if (order === undefined) return res.status(403).json({ error: 'Not a participant in this order' });

  const messages = await prisma.chat.findMany({ where: { orderId: req.params.orderId }, orderBy: { createdAt: 'asc' } });
  // Persistent, always-visible notice: conversations may be reviewed by the moderation team.
  return res.json({ messages, moderationNotice: 'Conversations on Second Look may be reviewed for safety.' });
});

const messageSchema = z.object({ messageText: z.string().min(1).max(2000) });

chatRouter.post('/:orderId/messages', requireAuth, async (req: AuthedRequest, res) => {
  const order = await assertParticipant(req.params.orderId, req.userId!);
  if (order === null) return res.status(404).json({ error: 'Order not found' });
  if (order === undefined) return res.status(403).json({ error: 'Not a participant in this order' });

  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const flaggedKeyword = detectFlaggedKeyword(parsed.data.messageText);
  const message = await prisma.chat.create({
    data: {
      orderId: order.id,
      senderId: req.userId!,
      messageText: parsed.data.messageText,
      autoFlagged: Boolean(flaggedKeyword),
      flaggedKeyword
    }
  });

  return res.status(201).json({ message });
});

chatRouter.post('/messages/:id/report', requireAuth, async (req: AuthedRequest, res) => {
  const message = await prisma.chat.findUnique({ where: { id: req.params.id } });
  if (!message) return res.status(404).json({ error: 'Message not found' });

  const order = await assertParticipant(message.orderId, req.userId!);
  if (!order) return res.status(403).json({ error: 'Not a participant in this order' });

  await prisma.chat.update({ where: { id: message.id }, data: { reported: true } });
  // User-initiated report is tracked independently of automatic keyword flagging —
  // a thread can be auto-flagged without being reported, and vice versa.
  const otherPartyId = order.buyerId === message.senderId ? order.sellerId : order.buyerId;
  await prisma.moderationCase.create({
    data: {
      contextType: 'chat_report',
      contextId: message.id,
      reviewerId: req.userId,
      reviewedUserId: message.senderId === req.userId ? otherPartyId : message.senderId,
      reason: 'User-reported chat message'
    }
  });

  return res.json({ reported: true });
});
