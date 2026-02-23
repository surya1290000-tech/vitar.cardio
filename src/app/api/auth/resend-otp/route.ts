import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { generateOTP, hashOTP } from '@/lib/crypto';
import { sendOTPEmail } from '@/lib/email';

const ResendSchema = z.object({
  userId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId } = ResendSchema.parse(body);

    // Get user
    const users = await sql`
      SELECT id, email, first_name, is_verified FROM users WHERE id = ${userId}
    `;
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }
    const user = users[0] as { id: string; email: string; first_name: string; is_verified: boolean };

    if (user.is_verified) {
      return NextResponse.json({ error: 'Email already verified.' }, { status: 400 });
    }

    // Rate limit: check last OTP was sent > 60s ago
    const recent = await sql`
      SELECT created_at FROM otp_tokens
      WHERE user_id = ${userId} AND created_at > NOW() - INTERVAL '60 seconds'
    `;
    if (recent.length > 0) {
      return NextResponse.json(
        { error: 'Please wait 60 seconds before requesting a new code.' },
        { status: 429 }
      );
    }

    // Generate + store new OTP
    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await sql`
      INSERT INTO otp_tokens (user_id, otp_hash, expires_at)
      VALUES (${userId}, ${otpHash}, ${expiresAt})
      ON CONFLICT (user_id) DO UPDATE SET otp_hash = ${otpHash}, expires_at = ${expiresAt}, created_at = NOW()
    `;

    await sendOTPEmail(user.email, user.first_name, otp);

    return NextResponse.json({ success: true, message: 'New verification code sent.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    console.error('[RESEND OTP ERROR]', error);
    return NextResponse.json({ error: 'Failed to resend code.' }, { status: 500 });
  }
}
