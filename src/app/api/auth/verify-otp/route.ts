import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { verifyOTPHash, hashToken } from '@/lib/crypto';
import { signAccessToken, signRefreshToken } from '@/lib/jwt';
import { sendWelcomeEmail } from '@/lib/email';

const VerifySchema = z.object({
  userId: z.string().uuid(),
  otp: z.string().length(6),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, otp } = VerifySchema.parse(body);

    const tokens = await sql`
      SELECT otp_hash, expires_at FROM otp_tokens
      WHERE user_id = ${userId}
    `;

    if (tokens.length === 0) {
      return NextResponse.json(
        { error: 'No verification code found. Please request a new one.' },
        { status: 400 }
      );
    }

    const record = tokens[0] as { otp_hash: string; expires_at: Date };

    if (new Date() > new Date(record.expires_at)) {
      return NextResponse.json(
        { error: 'Verification code expired. Please request a new one.', code: 'OTP_EXPIRED' },
        { status: 400 }
      );
    }

    if (!verifyOTPHash(otp, record.otp_hash)) {
      return NextResponse.json({ error: 'Incorrect verification code.' }, { status: 400 });
    }

    const users = await sql`
      UPDATE users SET is_verified = true, updated_at = NOW()
      WHERE id = ${userId}
      RETURNING id, email, first_name, last_name, role
    `;
    const user = users[0] as {
      id: string; email: string; first_name: string; last_name: string; role: string;
    };

    await sql`DELETE FROM otp_tokens WHERE user_id = ${userId}`;

    sendWelcomeEmail(users[0] ? (users[0] as any).email : '', (users[0] as any).first_name).catch(
      err => console.error('[WELCOME EMAIL]', err)
    );

    const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
    const refreshToken = signRefreshToken(user.id);
    const refreshTokenHash = hashToken(refreshToken);

    await sql`
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES (${user.id}, ${refreshTokenHash}, NOW() + INTERVAL '30 days')
      ON CONFLICT (user_id) DO UPDATE SET token_hash = ${refreshTokenHash}, expires_at = NOW() + INTERVAL '30 days'
    `;

    const response = NextResponse.json({
      success: true,
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
      },
    });

    response.cookies.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('[VERIFY OTP ERROR]', error);
    return NextResponse.json({ error: 'Verification failed.' }, { status: 500 });
  }
}
