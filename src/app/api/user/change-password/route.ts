import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { withAuth, AuthedRequest } from '@/lib/authMiddleware';

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters.'),
});

export const PATCH = withAuth(async (req: AuthedRequest) => {
  try {
    const body = await req.json();
    const data = ChangePasswordSchema.parse(body);

    if (data.currentPassword === data.newPassword) {
      return NextResponse.json({ error: 'New password must be different from current password.' }, { status: 400 });
    }

    const users = await sql`
      SELECT id, password_hash
      FROM users
      WHERE id = ${req.user.sub}
      LIMIT 1
    `;

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const u = users[0] as { id: string; password_hash: string | null };
    if (!u.password_hash) {
      return NextResponse.json(
        { error: 'Password login is not enabled for this account. Use password reset to set one.' },
        { status: 400 }
      );
    }

    const isCurrentValid = await bcrypt.compare(data.currentPassword, u.password_hash);
    if (!isCurrentValid) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
    }

    const nextHash = await bcrypt.hash(data.newPassword, 12);
    await sql`
      UPDATE users
      SET password_hash = ${nextHash}, updated_at = NOW()
      WHERE id = ${req.user.sub}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to change password.' }, { status: 500 });
  }
});
