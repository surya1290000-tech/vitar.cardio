import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

export const ADMIN_SESSION_COOKIE = 'vitar_admin_session';

type AdminSessionPayload = {
  role: 'admin';
  iat?: number;
  exp?: number;
};

function getAdminSessionSecret(): string | null {
  return process.env.ADMIN_SESSION_SECRET || process.env.JWT_SECRET || null;
}

export function getAdminLoginSecret(): string | null {
  return process.env.ADMIN_API_KEY || process.env.ADMIN_PASSWORD || process.env.NEXT_PUBLIC_ADMIN_PASSWORD || null;
}

export function signAdminSession(): string {
  const secret = getAdminSessionSecret();
  if (!secret) {
    throw new Error('Missing ADMIN_SESSION_SECRET (or JWT_SECRET) for admin session signing.');
  }
  return jwt.sign({ role: 'admin' }, secret, { expiresIn: '12h' });
}

export function verifyAdminSession(token: string): AdminSessionPayload | null {
  const secret = getAdminSessionSecret();
  if (!secret) return null;
  try {
    return jwt.verify(token, secret) as AdminSessionPayload;
  } catch {
    return null;
  }
}

export function isAdminRequest(req: NextRequest): boolean {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return false;
  const payload = verifyAdminSession(token);
  return payload?.role === 'admin';
}
