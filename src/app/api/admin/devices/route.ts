import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isAdminRequest } from '@/lib/adminAuth';

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const parsedPage = Number(searchParams.get('page'));
    const parsedLimit = Number(searchParams.get('limit'));
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(200, Math.floor(parsedLimit)) : 50;
    const offset = (page - 1) * limit;
    const rawStatus = (searchParams.get('status') || '').trim();
    const rawSearch = (searchParams.get('search') || '').trim();

    const status = rawStatus || null;
    const searchTerm = rawSearch ? `%${rawSearch}%` : null;

    const devices = await sql`
      SELECT 
        id, 
        user_id, 
        serial_number, 
        model, 
        status, 
        battery_level, 
        last_sync, 
        activated_at, 
        created_at, 
        updated_at
      FROM devices
      WHERE
        (${status}::text IS NULL OR status = ${status})
        AND (
          ${searchTerm}::text IS NULL
          OR serial_number ILIKE ${searchTerm}
          OR model ILIKE ${searchTerm}
          OR status ILIKE ${searchTerm}
          OR CAST(user_id AS text) ILIKE ${searchTerm}
        )
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const totalRows = await sql`
      SELECT COUNT(*)::int AS total
      FROM devices
      WHERE
        (${status}::text IS NULL OR status = ${status})
        AND (
          ${searchTerm}::text IS NULL
          OR serial_number ILIKE ${searchTerm}
          OR model ILIKE ${searchTerm}
          OR status ILIKE ${searchTerm}
          OR CAST(user_id AS text) ILIKE ${searchTerm}
        )
    `;
    const total = Number((totalRows[0] as any)?.total ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      success: true,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      devices: devices.map((d: any) => ({
        id: d.id,
        user_id: d.user_id,
        serial_number: d.serial_number,
        model: d.model,
        status: d.status,
        battery_level: d.battery_level,
        last_sync: d.last_sync,
        activated_at: d.activated_at,
        created_at: d.created_at,
        updated_at: d.updated_at,
      })),
    });
  } catch (error) {
    console.error('[ADMIN DEVICES]', error);
    return NextResponse.json(
      { error: 'Failed to fetch devices' },
      { status: 500 }
    );
  }
}
