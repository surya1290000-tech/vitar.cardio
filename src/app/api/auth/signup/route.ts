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
  phone: z.string().max(20).nullable().optional(),
  dateOfBirth: z.string().date().nullable().optional(),
  bloodType: z.string().max(5).nullable().optional(),
  heightCm: z.number().positive().max(300).nullable().optional(),
  weightKg: z.number().positive().max(500).nullable().optional(),
  sex: z.string().max(20).nullable().optional(),
  medicalNotes: z.string().max(4000).nullable().optional(),
  familyHistory: z.string().max(4000).nullable().optional(),
  restingHeartRate: z.number().int().positive().max(250).nullable().optional(),
  allergies: z.array(z.string().min(1)).optional(),
  medications: z.array(z.string().min(1)).optional(),
  conditions: z.array(z.string().min(1)).optional(),
  physicianName: z.string().max(255).nullable().optional(),
  physicianPhone: z.string().max(20).nullable().optional(),
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
      INSERT INTO users (email, password_hash, first_name, last_name, phone, date_of_birth, role, is_verified)
      VALUES (
        ${data.email},
        ${passwordHash},
        ${data.firstName},
        ${data.lastName},
        ${data.phone ?? null},
        ${data.dateOfBirth ?? null},
        'user',
        false
      )
      RETURNING id, email, first_name
    `;
    const user = users[0] as { id: string; email: string; first_name: string };

    const hasMedicalProfile =
      Boolean(data.bloodType) ||
      data.heightCm != null ||
      data.weightKg != null ||
      Boolean(data.sex) ||
      Boolean(data.medicalNotes) ||
      Boolean(data.familyHistory) ||
      data.restingHeartRate != null ||
      Boolean(data.physicianName) ||
      Boolean(data.physicianPhone) ||
      (data.allergies?.length ?? 0) > 0 ||
      (data.medications?.length ?? 0) > 0 ||
      (data.conditions?.length ?? 0) > 0;

    if (hasMedicalProfile) {
      await sql`
        INSERT INTO medical_profiles (
          user_id,
          blood_type,
          height_cm,
          weight_kg,
          sex,
          medical_notes,
          family_history,
          resting_heart_rate,
          allergies,
          medications,
          conditions,
          physician_name,
          physician_phone
        ) VALUES (
          ${user.id},
          ${data.bloodType ?? null},
          ${data.heightCm ?? null},
          ${data.weightKg ?? null},
          ${data.sex ?? null},
          ${data.medicalNotes ?? null},
          ${data.familyHistory ?? null},
          ${data.restingHeartRate ?? null},
          ${data.allergies ?? []},
          ${data.medications ?? []},
          ${data.conditions ?? []},
          ${data.physicianName ?? null},
          ${data.physicianPhone ?? null}
        )
      `;
    }

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
