import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { getAdminLoginSecret, isAdminRequest } from '@/lib/adminAuth';
import { getSupportTicketAutomationDraft } from '@/lib/automationWorkflows';

const QuerySchema = z.object({
  ticketId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

const PostSchema = z.object({
  ticketId: z.string().uuid(),
  message: z.string().min(1).max(4000),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
});

export async function GET(req: NextRequest) {
  const adminLoginSecret = getAdminLoginSecret();
  if (!adminLoginSecret) {
    return NextResponse.json({ error: 'Admin key is not configured on server.' }, { status: 500 });
  }
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const parsed = QuerySchema.parse({
      ticketId: req.nextUrl.searchParams.get('ticketId') ?? undefined,
      limit: req.nextUrl.searchParams.get('limit') ?? undefined,
    });

    const ticket = await sql`
      SELECT
        t.id,
        t.user_id,
        t.subject,
        t.category,
        t.priority,
        t.description,
        t.status,
        t.created_at,
        t.updated_at,
        u.email,
        u.first_name,
        u.last_name
      FROM support_tickets t
      JOIN users u ON u.id = t.user_id
      WHERE t.id = ${parsed.ticketId}
      LIMIT 1
    `;
    if (ticket.length === 0) {
      return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
    }

    const messages = await sql`
      SELECT id, ticket_id, sender_type, message, created_at
      FROM support_messages
      WHERE ticket_id = ${parsed.ticketId}
      ORDER BY created_at ASC
      LIMIT ${parsed.limit}
    `;

    const automation = await getSupportTicketAutomationDraft(parsed.ticketId);

    const row = ticket[0] as any;
    return NextResponse.json({
      ticket: {
        id: row.id,
        userId: row.user_id,
        userEmail: row.email,
        userName: [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || null,
        subject: row.subject,
        category: row.category,
        priority: row.priority,
        description: row.description,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
      automation,
      messages: messages.map((m: any) => ({
        id: m.id,
        ticketId: m.ticket_id,
        senderType: m.sender_type,
        message: m.message,
        createdAt: m.created_at,
      })),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query params', details: error.errors }, { status: 400 });
    }
    console.error('[ADMIN SUPPORT MESSAGES GET ERROR]', error);
    return NextResponse.json({ error: 'Failed to load support messages.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const adminLoginSecret = getAdminLoginSecret();
  if (!adminLoginSecret) {
    return NextResponse.json({ error: 'Admin key is not configured on server.' }, { status: 500 });
  }
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = PostSchema.parse(body);

    const ticket = await sql`
      SELECT id
      FROM support_tickets
      WHERE id = ${data.ticketId}
      LIMIT 1
    `;
    if (ticket.length === 0) {
      return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
    }

    const inserted = await sql`
      INSERT INTO support_messages (ticket_id, sender_type, message)
      VALUES (${data.ticketId}, 'support', ${data.message})
      RETURNING id, ticket_id, sender_type, message, created_at
    `;

    await sql`
      UPDATE support_tickets
      SET
        status = COALESCE(${data.status ?? null}, CASE WHEN status = 'closed' THEN 'in_progress' ELSE status END),
        updated_at = NOW()
      WHERE id = ${data.ticketId}
    `;

    const message = inserted[0] as any;
    return NextResponse.json(
      {
        success: true,
        message: {
          id: message.id,
          ticketId: message.ticket_id,
          senderType: message.sender_type,
          message: message.message,
          createdAt: message.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('[ADMIN SUPPORT MESSAGES POST ERROR]', error);
    return NextResponse.json({ error: 'Failed to send support reply.' }, { status: 500 });
  }
}
