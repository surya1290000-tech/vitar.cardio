import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, extractToken, JWTPayload } from '@/lib/jwt';

export type AuthedRequest = NextRequest & { user: JWTPayload };

// ── PROTECT A ROUTE HANDLER ────────────────────────────────────
// Usage:
//   export const GET = withAuth(async (req) => {
//     const user = req.user;  // fully typed
//     ...
//   });

type AuthedHandler = (req: AuthedRequest) => Promise<NextResponse>;

export function withAuth(handler: AuthedHandler) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const token = extractToken(req.headers.get('authorization'));

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    try {
      const payload = verifyAccessToken(token);
      // Attach user to request
      (req as AuthedRequest).user = payload;
      return await handler(req as AuthedRequest);
    } catch {
      return NextResponse.json(
        { error: 'Token expired or invalid. Please sign in again.' },
        { status: 401 }
      );
    }
  };
}

// ── ROLE GUARD ─────────────────────────────────────────────────
export function withRole(role: string, handler: AuthedHandler) {
  return withAuth(async (req: AuthedRequest) => {
    if (req.user.role !== role && req.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }
    return handler(req);
  });
}
