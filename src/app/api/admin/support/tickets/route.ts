import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { getAdminLoginSecret, isAdminRequest } from '@/lib/adminAuth';

const QuerySchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

const UpdateSchema = z.object({
  ticketId: z.string().uuid(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
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
      status: req.nextUrl.searchParams.get('status') ?? undefined,
      priority: req.nextUrl.searchParams.get('priority') ?? undefined,
      search: req.nextUrl.searchParams.get('search') ?? undefined,
      page: req.nextUrl.searchParams.get('page') ?? undefined,
      limit: req.nextUrl.searchParams.get('limit') ?? undefined,
    });

    const offset = (parsed.page - 1) * parsed.limit;
    const like = parsed.search ? `%${parsed.search}%` : null;

    const countRows = await sql`
      SELECT COUNT(*)::int AS total
      FROM support_tickets t
      JOIN users u ON u.id = t.user_id
      WHERE
        (${parsed.status ?? null}::text IS NULL OR t.status = ${parsed.status ?? null})
        AND (${parsed.priority ?? null}::text IS NULL OR t.priority = ${parsed.priority ?? null})
        AND (
          ${like}::text IS NULL
          OR t.subject ILIKE ${like}
          OR t.description ILIKE ${like}
          OR u.email ILIKE ${like}
          OR COALESCE(u.first_name, '') ILIKE ${like}
          OR COALESCE(u.last_name, '') ILIKE ${like}
        )
    `;
    const total = (countRows[0] as any)?.total ?? 0;

    const rows = await sql`
      SELECT
        t.id,
        t.user_id,
        u.email,
        u.first_name,
        u.last_name,
        t.subject,
        t.category,
        t.priority,
        t.description,
        t.status,
        t.created_at,
        t.updated_at,
        COALESCE(msg_counts.message_count, 0)::int AS message_count,
        msg_counts.last_message_at
      FROM support_tickets t
      JOIN users u ON u.id = t.user_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS message_count, MAX(created_at) AS last_message_at
        FROM support_messages m
        WHERE m.ticket_id = t.id
      ) AS msg_counts ON true
      WHERE
        (${parsed.status ?? null}::text IS NULL OR t.status = ${parsed.status ?? null})
        AND (${parsed.priority ?? null}::text IS NULL OR t.priority = ${parsed.priority ?? null})
        AND (
          ${like}::text IS NULL
          OR t.subject ILIKE ${like}
          OR t.description ILIKE ${like}
          OR u.email ILIKE ${like}
          OR COALESCE(u.first_name, '') ILIKE ${like}
          OR COALESCE(u.last_name, '') ILIKE ${like}
        )
      ORDER BY COALESCE(msg_counts.last_message_at, t.updated_at, t.created_at) DESC
      LIMIT ${parsed.limit}
      OFFSET ${offset}
    `;

    const totalPages = Math.max(1, Math.ceil(total / parsed.limit));

    return NextResponse.json({
      tickets: rows.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        userEmail: r.email,
        userName: [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || null,
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
      pagination: {
        page: parsed.page,
        limit: parsed.limit,
        total,
        totalPages,
        hasNextPage: parsed.page < totalPages,
        hasPrevPage: parsed.page > 1,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query params', details: error.errors }, { status: 400 });
    }
    console.error('[ADMIN SUPPORT TICKETS GET ERROR]', error);
    return NextResponse.json({ error: 'Failed to load support tickets.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const adminLoginSecret = getAdminLoginSecret();
  if (!adminLoginSecret) {
    return NextResponse.json({ error: 'Admin key is not configured on server.' }, { status: 500 });
  }
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = UpdateSchema.parse(body);

    if (!data.status && !data.priority) {
      return NextResponse.json({ error: 'Provide at least one field to update.' }, { status: 400 });
    }

    const updated = await sql`
      UPDATE support_tickets
      SET
        status = COALESCE(${data.status ?? null}, status),
        priority = COALESCE(${data.priority ?? null}, priority),
        updated_at = NOW()
      WHERE id = ${data.ticketId}
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
    console.error('[ADMIN SUPPORT TICKETS PATCH ERROR]', error);
    return NextResponse.json({ error: 'Failed to update support ticket.' }, { status: 500 });
  }
}

