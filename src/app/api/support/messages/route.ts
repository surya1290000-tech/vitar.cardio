import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { withAuth, AuthedRequest } from '@/lib/authMiddleware';

const QuerySchema = z.object({
  ticketId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(300).default(120),
});

const PostSchema = z.object({
  ticketId: z.string().uuid(),
  message: z.string().min(1).max(4000),
});

function isMissingRelationError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '42P01';
}

// GET /api/support/messages?ticketId=...
export const GET = withAuth(async (req: AuthedRequest) => {
  try {
    const parsed = QuerySchema.parse({
      ticketId: req.nextUrl.searchParams.get('ticketId') ?? undefined,
      limit: req.nextUrl.searchParams.get('limit') ?? undefined,
    });

    const ticket = await sql`
      SELECT id
      FROM support_tickets
      WHERE id = ${parsed.ticketId} AND user_id = ${req.user.sub}
      LIMIT 1
    `;
    if (ticket.length === 0) {
      return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
    }

    const rows = await sql`
      SELECT id, ticket_id, sender_type, message, created_at
      FROM support_messages
      WHERE ticket_id = ${parsed.ticketId}
      ORDER BY created_at ASC
      LIMIT ${parsed.limit}
    `;

    return NextResponse.json({
      messages: rows.map((r: any) => ({
        id: r.id,
        ticketId: r.ticket_id,
        senderType: r.sender_type,
        message: r.message,
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    if (isMissingRelationError(error)) {
      return NextResponse.json({
        messages: [],
        warning: 'support_tickets/support_messages tables are missing. Run latest DB migration/setup.sql.',
      });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query params', details: error.errors }, { status: 400 });
    }
    console.error('[SUPPORT MESSAGES GET]', error);
    return NextResponse.json({ error: 'Failed to load ticket messages.' }, { status: 500 });
  }
});

// POST /api/support/messages
export const POST = withAuth(async (req: AuthedRequest) => {
  try {
    const body = await req.json();
    const data = PostSchema.parse(body);

    const ticket = await sql`
      SELECT id
      FROM support_tickets
      WHERE id = ${data.ticketId} AND user_id = ${req.user.sub}
      LIMIT 1
    `;
    if (ticket.length === 0) {
      return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
    }

    const inserted = await sql`
      INSERT INTO support_messages (
        ticket_id, sender_type, message
      ) VALUES (
        ${data.ticketId},
        'user',
        ${data.message}
      )
      RETURNING id, ticket_id, sender_type, message, created_at
    `;

    await sql`
      UPDATE support_tickets
      SET
        status = CASE WHEN status = 'closed' THEN 'open' ELSE status END,
        updated_at = NOW()
      WHERE id = ${data.ticketId}
    `;

    const row = inserted[0] as any;

    return NextResponse.json(
      {
        success: true,
        message: {
          id: row.id,
          ticketId: row.ticket_id,
          senderType: row.sender_type,
          message: row.message,
          createdAt: row.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('[SUPPORT MESSAGES POST]', error);
    return NextResponse.json({ error: 'Failed to send message.' }, { status: 500 });
  }
});
