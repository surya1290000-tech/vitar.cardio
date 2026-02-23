import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { generateOTP, hashOTP } from '@/lib/crypto';
import { sendOTPEmail } from '@/lib/email';

const SignupSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName:  z.string().min(1, 'Last name is required'),
  email:     z.string().email('Invalid email address'),
  password:  z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = SignupSchema.parse(body);

    // Check if email already exists
    const existing = await sql`SELECT id FROM users WHERE email = ${data.email}`;
    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 }
      );
    }

    // Hash password with bcrypt (cost 12)
    const passwordHash = await bcrypt.hash(data.password, 12);

    // Insert user
    const users = await sql`
      INSERT INTO users (email, password_hash, first_name, last_name, role, is_verified)
      VALUES (${data.email}, ${passwordHash}, ${data.firstName}, ${data.lastName}, 'user', false)
      RETURNING id, email, first_name
    `;
    const user = users[0] as { id: string; email: string; first_name: string };

    // Generate OTP + store hashed version with 10-min expiry
    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await sql`
      INSERT INTO otp_tokens (user_id, otp_hash, expires_at)
      VALUES (${user.id}, ${otpHash}, ${expiresAt})
      ON CONFLICT (user_id) DO UPDATE
        SET otp_hash = ${otpHash}, expires_at = ${expiresAt}, created_at = NOW()
    `;

    // Send verification email
    await sendOTPEmail(data.email, data.firstName, otp);

    return NextResponse.json(
      { success: true, userId: user.id, message: 'Check your email for your verification code.' },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }
    console.error('[SIGNUP ERROR]', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
