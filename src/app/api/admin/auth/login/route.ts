import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_SESSION_COOKIE, getAdminLoginSecret, signAdminSession } from '@/lib/adminAuth';
import { checkRateLimit, registerFailure, registerSuccess } from '@/lib/rateLimit';
import { writeAdminAuditLog } from '@/lib/adminAudit';

const LoginSchema = z.object({
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const loginSecret = getAdminLoginSecret();
    if (!loginSecret) {
      return NextResponse.json({ error: 'Admin password is not configured on server.' }, { status: 500 });
    }

    const forwardedFor = req.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
    const userAgent = req.headers.get('user-agent');
    const rateKey = `admin-login:${ipAddress ?? 'unknown'}`;
    const rate = checkRateLimit(rateKey);
    if (!rate.allowed) {
      await writeAdminAuditLog({
        action: 'login_blocked',
        ipAddress,
        userAgent,
        details: `retry_after_seconds=${rate.retryAfterSeconds}`,
      });
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${rate.retryAfterSeconds} seconds.` },
        { status: 429 }
      );
    }

    const body = await req.json();
    const data = LoginSchema.parse(body);

    if (data.password !== loginSecret) {
      registerFailure(rateKey);
      await writeAdminAuditLog({
        action: 'login_failed',
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ error: 'Incorrect admin password.' }, { status: 401 });
    }

    registerSuccess(rateKey);
    const token = signAdminSession();
    const response = NextResponse.json({ success: true });

    response.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 12 * 60 * 60,
      path: '/',
    });

    await writeAdminAuditLog({
      action: 'login_success',
      ipAddress,
      userAgent,
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('[ADMIN LOGIN ERROR]', error);
    return NextResponse.json({ error: 'Failed to sign in to admin.' }, { status: 500 });
  }
}
