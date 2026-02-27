import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { signAccessToken, signRefreshToken } from '@/lib/jwt';
import { hashToken } from '@/lib/crypto';

const GoogleOAuthSchema = z.object({
  credential: z.string().min(1),
});

type GoogleTokenInfo = {
  sub: string;
  email: string;
  email_verified: 'true' | 'false';
  aud: string;
  given_name?: string;
  family_name?: string;
  name?: string;
};

function splitName(fullName: string | undefined) {
  const safe = (fullName || '').trim();
  if (!safe) return { firstName: 'User', lastName: 'Account' };
  const parts = safe.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: 'Account' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

export async function POST(req: NextRequest) {
  try {
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      return NextResponse.json({ error: 'Google auth is not configured.' }, { status: 500 });
    }

    const body = await req.json();
    const { credential } = GoogleOAuthSchema.parse(body);

    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    const tokenInfo = (await verifyRes.json()) as Partial<GoogleTokenInfo> & { error_description?: string };

    if (!verifyRes.ok || !tokenInfo?.sub || !tokenInfo?.email) {
      return NextResponse.json({ error: tokenInfo?.error_description || 'Invalid Google credential.' }, { status: 401 });
    }

    if (tokenInfo.aud !== googleClientId) {
      return NextResponse.json({ error: 'Invalid Google client audience.' }, { status: 401 });
    }

    if (tokenInfo.email_verified !== 'true') {
      return NextResponse.json({ error: 'Google email is not verified.' }, { status: 403 });
    }

    const derivedName = splitName(tokenInfo.name);
    const firstName = tokenInfo.given_name || derivedName.firstName;
    const lastName = tokenInfo.family_name || derivedName.lastName;

    const existingUsers = await sql`
      SELECT id, email, first_name, last_name, role
      FROM users
      WHERE email = ${tokenInfo.email}
      LIMIT 1
    `;

    let userId = '';
    let role = 'user';
    let userFirstName = firstName;
    let userLastName = lastName;

    if (existingUsers.length > 0) {
      const u = existingUsers[0] as { id: string; email: string; first_name: string; last_name: string; role: string };
      userId = u.id;
      role = u.role;
      userFirstName = u.first_name || firstName;
      userLastName = u.last_name || lastName;

      await sql`
        UPDATE users
        SET
          oauth_provider = 'google',
          oauth_id = ${tokenInfo.sub},
          is_verified = true,
          first_name = COALESCE(NULLIF(first_name, ''), ${firstName}),
          last_name = COALESCE(NULLIF(last_name, ''), ${lastName}),
          updated_at = NOW()
        WHERE id = ${userId}
      `;
    } else {
      const inserted = await sql`
        INSERT INTO users (
          email, first_name, last_name, role, is_verified, oauth_provider, oauth_id
        ) VALUES (
          ${tokenInfo.email}, ${firstName}, ${lastName}, 'user', true, 'google', ${tokenInfo.sub}
        )
        RETURNING id, role
      `;
      userId = (inserted[0] as { id: string }).id;
      role = (inserted[0] as { role: string }).role || 'user';
    }

    const accessToken = signAccessToken({
      sub: userId,
      email: tokenInfo.email,
      role,
    });
    const refreshToken = signRefreshToken(userId);
    const refreshTokenHash = hashToken(refreshToken);

    await sql`
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES (${userId}, ${refreshTokenHash}, NOW() + INTERVAL '30 days')
      ON CONFLICT (user_id) DO UPDATE
        SET token_hash = ${refreshTokenHash}, expires_at = NOW() + INTERVAL '30 days'
    `;

    const response = NextResponse.json({
      success: true,
      accessToken,
      user: {
        id: userId,
        email: tokenInfo.email,
        firstName: userFirstName,
        lastName: userLastName,
        role,
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
    console.error('[GOOGLE OAUTH ERROR]', error);
    return NextResponse.json({ error: 'Google sign-in failed.' }, { status: 500 });
  }
}
