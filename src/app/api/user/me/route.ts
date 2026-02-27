import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { withAuth, AuthedRequest } from '@/lib/authMiddleware';

const UpdateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  emailNotifications: z.boolean().optional(),
}).partial();

async function ensureUserColumns() {
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN NOT NULL DEFAULT true
  `;
}

// GET /api/user/me - get current user profile
export const GET = withAuth(async (req: AuthedRequest) => {
  await ensureUserColumns();

  const users = await sql`
    SELECT
      u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.created_at, u.email_notifications,
      d.id as device_id, d.model as device_model, d.status as device_status, d.battery_level,
      s.plan as subscription_plan, s.status as subscription_status, s.current_period_end
    FROM users u
    LEFT JOIN devices d ON d.user_id = u.id
    LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
    WHERE u.id = ${req.user.sub}
    LIMIT 1
  `;

  if (users.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const u = users[0] as Record<string, unknown>;

  return NextResponse.json({
    user: {
      id: u.id,
      email: u.email,
      firstName: u.first_name,
      lastName: u.last_name,
      phone: u.phone,
      role: u.role,
      createdAt: u.created_at,
      emailNotifications: u.email_notifications,
      device: u.device_id
        ? {
            id: u.device_id,
            model: u.device_model,
            status: u.device_status,
            batteryLevel: u.battery_level,
          }
        : null,
      subscription: u.subscription_plan
        ? {
            plan: u.subscription_plan,
            status: u.subscription_status,
            currentPeriodEnd: u.current_period_end,
          }
        : null,
    },
  });
});

// PATCH /api/user/me - update profile/settings
export const PATCH = withAuth(async (req: AuthedRequest) => {
  try {
    await ensureUserColumns();

    const body = await req.json();
    const data = UpdateSchema.parse(body);

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
    }

    const updated = await sql`
      UPDATE users SET
        first_name = COALESCE(${data.firstName ?? null}, first_name),
        last_name  = COALESCE(${data.lastName ?? null}, last_name),
        phone      = COALESCE(${data.phone ?? null}, phone),
        email_notifications = COALESCE(${data.emailNotifications ?? null}, email_notifications),
        updated_at = NOW()
      WHERE id = ${req.user.sub}
      RETURNING id, email, first_name, last_name, phone, email_notifications
    `;

    return NextResponse.json({ success: true, user: updated[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Update failed.' }, { status: 500 });
  }
});
