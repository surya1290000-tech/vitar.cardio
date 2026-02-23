import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { hashToken } from '@/lib/crypto';

const Schema = z.object({
  token:    z.string().min(64),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, password } = Schema.parse(body);
    const tokenHash = hashToken(token);

    // Find valid token (hashed format, with legacy plaintext fallback during migration).
    const tokens = await sql`
      SELECT user_id FROM password_reset_tokens
      WHERE (token = ${tokenHash} OR token = ${token}) AND expires_at > NOW()
    `;

    if (tokens.length === 0) {
      return NextResponse.json(
        { error: 'Reset link is invalid or has expired.' },
        { status: 400 }
      );
    }

    const { user_id } = tokens[0] as { user_id: string };
    const passwordHash = await bcrypt.hash(password, 12);

    // Update password + delete all reset tokens for this user (single-use + rotation).
    await sql`UPDATE users SET password_hash = ${passwordHash}, updated_at = NOW() WHERE id = ${user_id}`;
    await sql`DELETE FROM password_reset_tokens WHERE user_id = ${user_id}`;

    // Invalidate all refresh tokens for security
    await sql`DELETE FROM refresh_tokens WHERE user_id = ${user_id}`;

    return NextResponse.json({ success: true, message: 'Password updated. Please sign in.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('[RESET PASSWORD ERROR]', error);
    return NextResponse.json({ error: 'Failed to reset password.' }, { status: 500 });
  }
}
