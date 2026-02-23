import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { generateSecureToken, hashToken } from '@/lib/crypto';
import { sendPasswordResetEmail } from '@/lib/email';

const Schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = Schema.parse(body);

    const users = await sql`
      SELECT id, first_name FROM users WHERE email = ${email} AND is_verified = true
    `;

    // Always return success to prevent email enumeration
    if (users.length === 0) {
      return NextResponse.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
    }

    const user = users[0] as { id: string; first_name: string };
    const token = generateSecureToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await sql`
      INSERT INTO password_reset_tokens (user_id, token, expires_at)
      VALUES (${user.id}, ${tokenHash}, ${expiresAt})
      ON CONFLICT (user_id) DO UPDATE SET token = ${tokenHash}, expires_at = ${expiresAt}
    `;

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;
    await sendPasswordResetEmail(email, user.first_name, resetUrl);

    return NextResponse.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }
    console.error('[FORGOT PASSWORD ERROR]', error);
    return NextResponse.json({ error: 'Failed to process request.' }, { status: 500 });
  }
}
