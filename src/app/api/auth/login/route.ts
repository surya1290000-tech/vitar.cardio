import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { signAccessToken, signRefreshToken } from '@/lib/jwt';
import { hashToken } from '@/lib/crypto';

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = LoginSchema.parse(body);

    const users = await sql`
      SELECT id, email, password_hash, first_name, last_name, role, is_verified
      FROM users WHERE email = ${data.email}
    `;

    if (users.length === 0) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const user = users[0] as {
      id: string; email: string; password_hash: string;
      first_name: string; last_name: string; role: string; is_verified: boolean;
    };

    const validPassword = await bcrypt.compare(data.password, user.password_hash);
    if (!validPassword) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    if (!user.is_verified) {
      return NextResponse.json(
        { error: 'Please verify your email before signing in.', code: 'EMAIL_NOT_VERIFIED', userId: user.id },
        { status: 403 }
      );
    }

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
    console.error('[LOGIN ERROR]', error);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
