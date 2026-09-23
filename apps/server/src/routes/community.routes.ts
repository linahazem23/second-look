import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireAuth, optionalAuth, type AuthedRequest } from '../lib/auth.js';
import { requireVerified } from '../lib/access.js';
import { detectFlaggedKeyword } from '../lib/chatModeration.js';
import { notifyThreadReply } from '../lib/email.js';
import { awardPoints, maybeAwardCommunityHelperCharm, POINTS } from '../lib/points.js';

export const communityRouter = Router();

const CATEGORIES = ['Skincare', 'Haircare', 'Makeup', 'Clothes', 'MomBaby', 'General'] as const;

const AUTHOR_SELECT = { id: true, fullName: true, username: true, avatarUrl: true, avatarPreset: true } as const;

// Public — reading consultations doesn't require an account, same as browsing listings.
// Mom Talk is a fully separate space (see CommunityHub client-side) — the
// general/unfiltered feed excludes MomBaby threads even for a mother; she
// only sees them via an explicit ?category=MomBaby request.
communityRouter.get('/', optionalAuth, async (req: AuthedRequest, res) => {
  const { category } = req.query as { category?: string };
  const me = req.userId ? await prisma.user.findUnique({ where: { id: req.userId }, select: { isMother: true } }) : null;

  if (category === 'MomBaby' && !me?.isMother) {
    return res.json({ threads: [] });
  }

  const threads = await prisma.communityThread.findMany({
    where: category ? { category } : { category: { not: 'MomBaby' } },
    orderBy: { createdAt: 'desc' },
    include: {
      author: { select: AUTHOR_SELECT },
      _count: { select: { replies: true, watchers: true } },
      watchers: req.userId ? { where: { userId: req.userId }, select: { id: true } } : false
    }
  });

  return res.json({
    threads: threads.map((t) => ({
      id: t.id,
      title: t.title,
      body: t.body,
      category: t.category,
      createdAt: t.createdAt,
      author: t.author,
      replyCount: t._count.replies,
      watcherCount: t._count.watchers,
      iAmWatching: Array.isArray(t.watchers) && t.watchers.length > 0
    }))
  });
});

const createThreadSchema = z.object({
  title: z.string().min(1).max(140),
  body: z.string().min(1).max(4000),
  category: z.enum(CATEGORIES).optional()
});

// Same trust bar as buying/selling — a real verified member, even if her display
// name on the thread is a pseudonym.
communityRouter.post('/', requireAuth, requireVerified, async (req: AuthedRequest, res) => {
  const parsed = createThreadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  if (detectFlaggedKeyword(parsed.data.title) || detectFlaggedKeyword(parsed.data.body)) {
    return res.status(422).json({ error: 'This post was blocked for review. Please keep posts respectful.' });
  }

  if (parsed.data.category === 'MomBaby') {
    const me = await prisma.user.findUnique({ where: { id: req.userId }, select: { isMother: true } });
    if (!me?.isMother) return res.status(403).json({ error: 'Mom & Baby is only available to members who opted in as a mother.' });
  }

  const thread = await prisma.communityThread.create({
    data: { authorId: req.userId!, title: parsed.data.title, body: parsed.data.body, category: parsed.data.category },
    include: { author: { select: AUTHOR_SELECT } }
  });

  // Posting a thread implicitly watches it — you'll want to know if anyone replies.
  await prisma.communityThreadWatcher.create({ data: { threadId: thread.id, userId: req.userId! } });

  await awardPoints(req.userId!, POINTS.COMMUNITY_POST, 'community_post', thread.id);
  await maybeAwardCommunityHelperCharm(req.userId!);

  return res.status(201).json({ thread });
});

communityRouter.get('/:id', optionalAuth, async (req: AuthedRequest, res) => {
  const thread = await prisma.communityThread.findUnique({
    where: { id: req.params.id },
    include: {
      author: { select: AUTHOR_SELECT },
      replies: { orderBy: { createdAt: 'asc' }, include: { author: { select: AUTHOR_SELECT } } },
      _count: { select: { watchers: true } },
      watchers: req.userId ? { where: { userId: req.userId }, select: { id: true } } : false
    }
  });
  if (!thread) return res.status(404).json({ error: 'Thread not found' });

  if (thread.category === 'MomBaby') {
    const me = req.userId ? await prisma.user.findUnique({ where: { id: req.userId }, select: { isMother: true } }) : null;
    if (!me?.isMother) return res.status(404).json({ error: 'Thread not found' });
  }

  return res.json({
    thread: {
      id: thread.id,
      title: thread.title,
      body: thread.body,
      category: thread.category,
      createdAt: thread.createdAt,
      author: thread.author,
      replies: thread.replies,
      watcherCount: thread._count.watchers,
      iAmWatching: Array.isArray(thread.watchers) && thread.watchers.length > 0
    }
  });
});

const replySchema = z.object({ body: z.string().min(1).max(2000) });

communityRouter.post('/:id/replies', requireAuth, async (req: AuthedRequest, res) => {
  const thread = await prisma.communityThread.findUnique({ where: { id: req.params.id } });
  if (!thread) return res.status(404).json({ error: 'Thread not found' });

  if (thread.category === 'MomBaby') {
    const me = await prisma.user.findUnique({ where: { id: req.userId }, select: { isMother: true } });
    if (!me?.isMother) return res.status(404).json({ error: 'Thread not found' });
  }

  const parsed = replySchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  if (detectFlaggedKeyword(parsed.data.body)) {
    return res.status(422).json({ error: 'This reply was blocked for review. Please keep replies respectful.' });
  }

  const [reply] = await prisma.$transaction([
    prisma.communityReply.create({
      data: { threadId: thread.id, authorId: req.userId!, body: parsed.data.body },
      include: { author: { select: AUTHOR_SELECT } }
    }),
    // Replying implicitly watches the thread too.
    prisma.communityThreadWatcher.upsert({
      where: { threadId_userId: { threadId: thread.id, userId: req.userId! } },
      update: {},
      create: { threadId: thread.id, userId: req.userId! }
    })
  ]);

  await awardPoints(req.userId!, POINTS.COMMUNITY_POST, 'community_post', reply.id);
  await maybeAwardCommunityHelperCharm(req.userId!);

  const watchers = await prisma.communityThreadWatcher.findMany({
    where: { threadId: thread.id, userId: { not: req.userId } },
    include: { user: { select: { email: true, fullName: true, username: true } } }
  });

  for (const watcher of watchers) {
    notifyThreadReply({
      threadId: thread.id,
      recipientEmail: watcher.user.email,
      recipientName: watcher.user.username ?? watcher.user.fullName,
      replierName: reply.author.username ?? reply.author.fullName,
      threadTitle: thread.title,
      preview: reply.body
    }).catch(() => {});
  }

  return res.status(201).json({ reply });
});

// The round "notify me" button — toggles the caller's watch row on this thread.
communityRouter.post('/:id/watch', requireAuth, async (req: AuthedRequest, res) => {
  const thread = await prisma.communityThread.findUnique({ where: { id: req.params.id } });
  if (!thread) return res.status(404).json({ error: 'Thread not found' });

  const existing = await prisma.communityThreadWatcher.findUnique({
    where: { threadId_userId: { threadId: thread.id, userId: req.userId! } }
  });

  if (existing) {
    await prisma.communityThreadWatcher.delete({ where: { id: existing.id } });
  } else {
    await prisma.communityThreadWatcher.create({ data: { threadId: thread.id, userId: req.userId! } });
  }

  const watcherCount = await prisma.communityThreadWatcher.count({ where: { threadId: thread.id } });
  return res.json({ watching: !existing, watcherCount });
});
