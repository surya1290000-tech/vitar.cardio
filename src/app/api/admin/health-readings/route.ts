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
    const parsedHours = Number(searchParams.get('hours'));
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(500, Math.floor(parsedLimit)) : 100;
    const offset = (page - 1) * limit;
    const hours = Number.isFinite(parsedHours) && parsedHours > 0 ? Math.min(24 * 30, Math.floor(parsedHours)) : 72;
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const rawDeviceId = (searchParams.get('deviceId') || '').trim();
    const rawUserId = (searchParams.get('userId') || '').trim();
    const rawMinRisk = (searchParams.get('minRisk') || '').trim();

    const uuidRegex = /^[0-9a-fA-F-]{36}$/;
    if (rawDeviceId && !uuidRegex.test(rawDeviceId)) {
      return NextResponse.json({ error: 'Invalid deviceId.' }, { status: 400 });
    }
    if (rawUserId && !uuidRegex.test(rawUserId)) {
      return NextResponse.json({ error: 'Invalid userId.' }, { status: 400 });
    }

    let minRisk: number | null = null;
    if (rawMinRisk) {
      const parsed = Number(rawMinRisk);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 1) {
        return NextResponse.json({ error: 'minRisk must be between 0 and 1.' }, { status: 400 });
      }
      minRisk = parsed;
    }

    const deviceId = rawDeviceId || null;
    const userId = rawUserId || null;

    const readings = await sql`
      SELECT 
        id,
        device_id,
        user_id,
        heart_rate,
        spo2,
        temperature,
        respiratory_rate,
        systolic_bp,
        diastolic_bp,
        ai_risk_score,
        recorded_at,
        notes,
        created_at
      FROM health_readings
      WHERE
        recorded_at >= ${startTime}
        AND (${deviceId}::text IS NULL OR CAST(device_id AS text) = ${deviceId})
        AND (${userId}::text IS NULL OR CAST(user_id AS text) = ${userId})
        AND (${minRisk}::numeric IS NULL OR ai_risk_score >= ${minRisk})
      ORDER BY recorded_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const totalRows = await sql`
      SELECT COUNT(*)::int AS total
      FROM health_readings
      WHERE
        recorded_at >= ${startTime}
        AND (${deviceId}::text IS NULL OR CAST(device_id AS text) = ${deviceId})
        AND (${userId}::text IS NULL OR CAST(user_id AS text) = ${userId})
        AND (${minRisk}::numeric IS NULL OR ai_risk_score >= ${minRisk})
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
      filters: {
        hours,
        deviceId,
        userId,
        minRisk,
      },
      readings: readings.map((r: any) => ({
        id: r.id,
        device_id: r.device_id,
        user_id: r.user_id,
        heart_rate: r.heart_rate,
        spo2: r.spo2,
        temperature: r.temperature,
        respiratory_rate: r.respiratory_rate,
        systolic_bp: r.systolic_bp,
        diastolic_bp: r.diastolic_bp,
        ai_risk_score: r.ai_risk_score,
        recorded_at: r.recorded_at,
        notes: r.notes,
        created_at: r.created_at,
      })),
    });
  } catch (error) {
    console.error('[ADMIN HEALTH READINGS]', error);
    return NextResponse.json(
      { error: 'Failed to fetch health readings' },
      { status: 500 }
    );
  }
}
