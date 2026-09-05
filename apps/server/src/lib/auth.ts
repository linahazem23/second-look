import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signUserToken(userId: string) {
  return jwt.sign({ sub: userId, kind: 'user' }, JWT_SECRET, { expiresIn: '30d' });
}

export function signAdminToken(adminId: string, role: string) {
  return jwt.sign({ sub: adminId, kind: 'admin', role }, JWT_SECRET, { expiresIn: '12h' });
}

interface AuthedRequest<P = Record<string, string>, ResBody = any, ReqBody = any, ReqQuery = any>
  extends Request<P, ResBody, ReqBody, ReqQuery> {
  userId?: string;
  adminId?: string;
  adminRole?: string;
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length);
}

/**
 * A blocked user still needs two things to work: reading their own account status
 * (so the client can show *why* they're blocked instead of just failing) and
 * finishing whatever orders were already placed before the block — enforcement
 * must not interrupt an active mid-sale order. Everything else (browsing, new
 * listings, new orders, new chats) stays denied for a blocked user.
 */
async function isExemptFromBlock(userId: string, req: Request): Promise<boolean> {
  const path = req.originalUrl.split('?')[0];
  if (path === '/api/auth/me' && req.method === 'GET') return true;
  if (path === '/api/orders/mine' && req.method === 'GET') return true;

  const params = req.params as Record<string, string | undefined>;
  const orderId = params.id ?? params.orderId ?? (req.body as any)?.orderId;
  if (!orderId) return false;

  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { buyerId: true, sellerId: true } });
  return Boolean(order && (order.buyerId === userId || order.sellerId === userId));
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; kind: string };
    if (payload.kind !== 'user') return res.status(401).json({ error: 'Invalid token type' });
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (user.status === 'Blocked' && !(await isExemptFromBlock(user.id, req))) {
      return res.status(403).json({ error: 'Account is blocked', blockedUntil: user.blockedUntil });
    }
    req.userId = user.id;
    (req as any).currentUser = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** For public routes that behave slightly differently when a valid session exists (e.g. "saved" state) without requiring one. */
export async function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; kind: string };
    if (payload.kind === 'user') req.userId = payload.sub;
  } catch {
    // Invalid/expired token on an optional-auth route just means "treat as anonymous".
  }
  next();
}

export async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; kind: string; role: string };
    if (payload.kind !== 'admin') return res.status(401).json({ error: 'Invalid token type' });
    const admin = await prisma.adminUser.findUnique({ where: { id: payload.sub } });
    if (!admin) return res.status(401).json({ error: 'Admin not found' });
    req.adminId = admin.id;
    req.adminRole = admin.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Gate on admin role. Call after requireAdmin so req.adminRole is populated. */
export function requireRole(...allowedRoles: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.adminRole || !allowedRoles.includes(req.adminRole)) {
      return res.status(403).json({ error: `This action requires one of these roles: ${allowedRoles.join(', ')}` });
    }
    next();
  };
}

export type { AuthedRequest };
