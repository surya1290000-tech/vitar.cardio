import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { withAuth, AuthedRequest } from '@/lib/authMiddleware';

const CreateSchema = z.object({
  name: z.string().min(1).max(255),
  relationship: z.string().max(100).nullable().optional(),
  phone: z.string().min(5).max(20),
  email: z.string().email().nullable().optional(),
  notifySms: z.boolean().optional(),
  notifyPush: z.boolean().optional(),
  priority: z.number().int().min(1).max(10).optional(),
});

const UpdateSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).max(255).optional(),
    relationship: z.string().max(100).nullable().optional(),
    phone: z.string().min(5).max(20).optional(),
    email: z.string().email().nullable().optional(),
    notifySms: z.boolean().optional(),
    notifyPush: z.boolean().optional(),
    priority: z.number().int().min(1).max(10).optional(),
  })
  .partial()
  .refine((data) => !!data.id, { message: 'id is required' });

const DeleteSchema = z.object({
  id: z.string().uuid(),
});

// GET /api/emergency-contacts - list current user's contacts
export const GET = withAuth(async (req: AuthedRequest) => {
  const contacts = await sql`
    SELECT
      id,
      user_id,
      name,
      relationship,
      phone,
      email,
      notify_sms,
      notify_push,
      priority,
      created_at
    FROM emergency_contacts
    WHERE user_id = ${req.user.sub}
    ORDER BY priority ASC, created_at DESC
  `;

  return NextResponse.json({
    contacts: contacts.map((c: any) => ({
      id: c.id,
      userId: c.user_id,
      name: c.name,
      relationship: c.relationship,
      phone: c.phone,
      email: c.email,
      notifySms: c.notify_sms,
      notifyPush: c.notify_push,
      priority: c.priority,
      createdAt: c.created_at,
    })),
  });
});

// POST /api/emergency-contacts - create a new contact
export const POST = withAuth(async (req: AuthedRequest) => {
  try {
    const body = await req.json();
    const data = CreateSchema.parse(body);

    const inserted = await sql`
      INSERT INTO emergency_contacts (
        user_id, name, relationship, phone, email, notify_sms, notify_push, priority
      ) VALUES (
        ${req.user.sub},
        ${data.name},
        ${data.relationship ?? null},
        ${data.phone},
        ${data.email ?? null},
        ${data.notifySms ?? true},
        ${data.notifyPush ?? true},
        ${data.priority ?? 1}
      )
      RETURNING
        id, user_id, name, relationship, phone, email, notify_sms, notify_push, priority, created_at
    `;

    const c = inserted[0] as any;

    return NextResponse.json(
      {
        success: true,
        contact: {
          id: c.id,
          userId: c.user_id,
          name: c.name,
          relationship: c.relationship,
          phone: c.phone,
          email: c.email,
          notifySms: c.notify_sms,
          notifyPush: c.notify_push,
          priority: c.priority,
          createdAt: c.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('[EMERGENCY CONTACTS POST ERROR]', error);
    return NextResponse.json({ error: 'Failed to create contact.' }, { status: 500 });
  }
});

// PATCH /api/emergency-contacts - update an existing contact
export const PATCH = withAuth(async (req: AuthedRequest) => {
  try {
    const body = await req.json();
    const data = UpdateSchema.parse(body);

    const patchFields = { ...data };
    delete (patchFields as any).id;

    if (Object.keys(patchFields).length === 0) {
      return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
    }

    const updated = await sql`
      UPDATE emergency_contacts SET
        name = COALESCE(${data.name ?? null}, name),
        relationship = COALESCE(${data.relationship ?? null}, relationship),
        phone = COALESCE(${data.phone ?? null}, phone),
        email = COALESCE(${data.email ?? null}, email),
        notify_sms = COALESCE(${data.notifySms ?? null}, notify_sms),
        notify_push = COALESCE(${data.notifyPush ?? null}, notify_push),
        priority = COALESCE(${data.priority ?? null}, priority)
      WHERE id = ${data.id} AND user_id = ${req.user.sub}
      RETURNING
        id, user_id, name, relationship, phone, email, notify_sms, notify_push, priority, created_at
    `;

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });
    }

    const c = updated[0] as any;

    return NextResponse.json({
      success: true,
      contact: {
        id: c.id,
        userId: c.user_id,
        name: c.name,
        relationship: c.relationship,
        phone: c.phone,
        email: c.email,
        notifySms: c.notify_sms,
        notifyPush: c.notify_push,
        priority: c.priority,
        createdAt: c.created_at,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('[EMERGENCY CONTACTS PATCH ERROR]', error);
    return NextResponse.json({ error: 'Failed to update contact.' }, { status: 500 });
  }
});

// DELETE /api/emergency-contacts - delete a contact
export const DELETE = withAuth(async (req: AuthedRequest) => {
  try {
    const body = await req.json();
    const { id } = DeleteSchema.parse(body);

    const deleted = await sql`
      DELETE FROM emergency_contacts
      WHERE id = ${id} AND user_id = ${req.user.sub}
      RETURNING id
    `;

    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('[EMERGENCY CONTACTS DELETE ERROR]', error);
    return NextResponse.json({ error: 'Failed to delete contact.' }, { status: 500 });
  }
});

