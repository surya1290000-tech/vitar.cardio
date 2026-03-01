import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { withAuth, AuthedRequest } from '@/lib/authMiddleware';

const CreateTicketSchema = z.object({
  subject: z.string().min(3).max(200),
  category: z.enum(['technical', 'billing', 'device', 'medical', 'general']).default('general'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  description: z.string().min(10).max(4000),
});

const UpdateTicketSchema = z.object({
  ticketId: z.string().uuid(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']),
});

const QuerySchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /api/support/tickets - list current user's tickets
export const GET = withAuth(async (req: AuthedRequest) => {
  try {
    const parsed = QuerySchema.parse({
      status: req.nextUrl.searchParams.get('status') ?? undefined,
      limit: req.nextUrl.searchParams.get('limit') ?? undefined,
    });

    const rows = await sql`
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
        COALESCE(COUNT(m.id), 0)::int AS message_count,
        MAX(m.created_at) AS last_message_at
      FROM support_tickets t
      LEFT JOIN support_messages m ON m.ticket_id = t.id
      WHERE
        t.user_id = ${req.user.sub}
        AND (${parsed.status ?? null}::text IS NULL OR t.status = ${parsed.status ?? null})
      GROUP BY t.id
      ORDER BY COALESCE(MAX(m.created_at), t.created_at) DESC
      LIMIT ${parsed.limit}
    `;

    return NextResponse.json({
      tickets: rows.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        subject: r.subject,
        category: r.category,
        priority: r.priority,
        description: r.description,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        messageCount: r.message_count,
        lastMessageAt: r.last_message_at,
      })),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query params', details: error.errors }, { status: 400 });
    }
    console.error('[SUPPORT TICKETS GET]', error);
    return NextResponse.json({ error: 'Failed to load support tickets.' }, { status: 500 });
  }
});

// POST /api/support/tickets - create a ticket and seed first message
export const POST = withAuth(async (req: AuthedRequest) => {
  try {
    const body = await req.json();
    const data = CreateTicketSchema.parse(body);

    const inserted = await sql`
      INSERT INTO support_tickets (
        user_id, subject, category, priority, description, status
      ) VALUES (
        ${req.user.sub},
        ${data.subject},
        ${data.category},
        ${data.priority},
        ${data.description},
        'open'
      )
      RETURNING
        id, user_id, subject, category, priority, description, status, created_at, updated_at
    `;

    const ticket = inserted[0] as any;

    await sql`
      INSERT INTO support_messages (
        ticket_id, sender_type, message
      ) VALUES (
        ${ticket.id},
        'user',
        ${data.description}
      )
    `;

    await sql`
      INSERT INTO support_messages (
        ticket_id, sender_type, message
      ) VALUES (
        ${ticket.id},
        'support',
        ${'Ticket received. Our care team will review this and reply soon. For urgent symptoms, contact emergency services immediately.'}
      )
    `;

    return NextResponse.json(
      {
        success: true,
        ticket: {
          id: ticket.id,
          userId: ticket.user_id,
          subject: ticket.subject,
          category: ticket.category,
          priority: ticket.priority,
          description: ticket.description,
          status: ticket.status,
          createdAt: ticket.created_at,
          updatedAt: ticket.updated_at,
          messageCount: 2,
          lastMessageAt: ticket.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('[SUPPORT TICKETS POST]', error);
    return NextResponse.json({ error: 'Failed to create support ticket.' }, { status: 500 });
  }
});

// PATCH /api/support/tickets - update ticket status
export const PATCH = withAuth(async (req: AuthedRequest) => {
  try {
    const body = await req.json();
    const data = UpdateTicketSchema.parse(body);

    const updated = await sql`
      UPDATE support_tickets
      SET status = ${data.status}, updated_at = NOW()
      WHERE id = ${data.ticketId} AND user_id = ${req.user.sub}
      RETURNING
        id, user_id, subject, category, priority, description, status, created_at, updated_at
    `;

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
    }

    const row = updated[0] as any;

    return NextResponse.json({
      success: true,
      ticket: {
        id: row.id,
        userId: row.user_id,
        subject: row.subject,
        category: row.category,
        priority: row.priority,
        description: row.description,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('[SUPPORT TICKETS PATCH]', error);
    return NextResponse.json({ error: 'Failed to update ticket.' }, { status: 500 });
  }
});
