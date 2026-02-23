import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { withAuth, AuthedRequest } from '@/lib/authMiddleware';

const UpdateSchema = z
  .object({
    bloodType: z.string().max(5).nullable().optional(),
    allergies: z.array(z.string().min(1)).optional(),
    medications: z.array(z.string().min(1)).optional(),
    conditions: z.array(z.string().min(1)).optional(),
    physicianName: z.string().max(255).nullable().optional(),
    physicianPhone: z.string().max(20).nullable().optional(),
  })
  .partial();

// GET /api/medical-profile - get current user's medical profile
export const GET = withAuth(async (req: AuthedRequest) => {
  const rows = await sql`
    SELECT
      id,
      user_id,
      blood_type,
      allergies,
      medications,
      conditions,
      physician_name,
      physician_phone,
      created_at,
      updated_at
    FROM medical_profiles
    WHERE user_id = ${req.user.sub}
    LIMIT 1
  `;

  if (rows.length === 0) {
    return NextResponse.json({ profile: null });
  }

  const p = rows[0] as Record<string, unknown>;

  return NextResponse.json({
    profile: {
      id: p.id,
      userId: p.user_id,
      bloodType: p.blood_type,
      allergies: p.allergies ?? [],
      medications: p.medications ?? [],
      conditions: p.conditions ?? [],
      physicianName: p.physician_name,
      physicianPhone: p.physician_phone,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    },
  });
});

// PATCH /api/medical-profile - upsert current user's medical profile
export const PATCH = withAuth(async (req: AuthedRequest) => {
  try {
    const body = await req.json();
    const data = UpdateSchema.parse(body);

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
    }

    const updated = await sql`
      INSERT INTO medical_profiles (
        user_id, blood_type, allergies, medications, conditions, physician_name, physician_phone
      ) VALUES (
        ${req.user.sub},
        ${data.bloodType ?? null},
        ${data.allergies ?? null},
        ${data.medications ?? null},
        ${data.conditions ?? null},
        ${data.physicianName ?? null},
        ${data.physicianPhone ?? null}
      )
      ON CONFLICT (user_id) DO UPDATE SET
        blood_type = COALESCE(EXCLUDED.blood_type, medical_profiles.blood_type),
        allergies = COALESCE(EXCLUDED.allergies, medical_profiles.allergies),
        medications = COALESCE(EXCLUDED.medications, medical_profiles.medications),
        conditions = COALESCE(EXCLUDED.conditions, medical_profiles.conditions),
        physician_name = COALESCE(EXCLUDED.physician_name, medical_profiles.physician_name),
        physician_phone = COALESCE(EXCLUDED.physician_phone, medical_profiles.physician_phone),
        updated_at = NOW()
      RETURNING
        id,
        user_id,
        blood_type,
        allergies,
        medications,
        conditions,
        physician_name,
        physician_phone,
        created_at,
        updated_at
    `;

    const p = updated[0] as Record<string, unknown>;

    return NextResponse.json({
      success: true,
      profile: {
        id: p.id,
        userId: p.user_id,
        bloodType: p.blood_type,
        allergies: p.allergies ?? [],
        medications: p.medications ?? [],
        conditions: p.conditions ?? [],
        physicianName: p.physician_name,
        physicianPhone: p.physician_phone,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('[MEDICAL PROFILE PATCH ERROR]', error);
    return NextResponse.json({ error: 'Failed to update medical profile.' }, { status: 500 });
  }
});

