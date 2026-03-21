import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyRefreshToken, signAccessToken } from '@/lib/jwt';
import { hashToken } from '@/lib/crypto';

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get('refreshToken')?.value;

    if (!refreshToken) {
      return NextResponse.json({ error: 'No refresh token.' }, { status: 401 });
    }

    const payload = verifyRefreshToken(refreshToken);
    const refreshTokenHash = hashToken(refreshToken);

    // Migration-safe check: supports new hashed tokens and legacy raw tokens.
    const stored = await sql`
      SELECT user_id FROM refresh_tokens
      WHERE user_id = ${payload.sub}
        AND expires_at > NOW()
        AND (token_hash = ${refreshTokenHash} OR token_hash = ${refreshToken})
    `;

    if (stored.length === 0) {
      return NextResponse.json({ error: 'Session expired. Please sign in again.' }, { status: 401 });
    }

    // Self-heal legacy rows to hashed format after a successful refresh.
    await sql`
      UPDATE refresh_tokens SET token_hash = ${refreshTokenHash}
      WHERE user_id = ${payload.sub} AND token_hash = ${refreshToken}
    `;

    const users = await sql`
      SELECT id, email, first_name, last_name, role
      FROM users
      WHERE id = ${payload.sub} AND is_verified = true
    `;
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found.' }, { status: 401 });
    }

    const user = users[0] as {
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      role: string;
    };
    const newAccessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });

    return NextResponse.json({
      success: true,
      accessToken: newAccessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Invalid session.' }, { status: 401 });
  }
}
