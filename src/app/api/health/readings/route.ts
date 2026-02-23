import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { withAuth, AuthedRequest } from '@/lib/authMiddleware';

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  beforeId: z.coerce.number().int().positive().optional(),
  deviceId: z.string().uuid().optional(),
});

const ReadingSchema = z.object({
  deviceId: z.string().uuid(),
  recordedAt: z.string().datetime().optional(),
  heartRate: z.number().int().min(20).max(260).optional(),
  spo2: z.number().min(50).max(100).optional(),
  hrvMs: z.number().min(0).max(1000).optional(),
  ecgData: z.any().optional(),
  motionX: z.number().optional(),
  motionY: z.number().optional(),
  motionZ: z.number().optional(),
  aiRiskScore: z.number().min(0).max(1).optional(),
  anomalyFlags: z.array(z.string()).optional(),
});

function mapReading(r: any) {
  return {
    id: r.id,
    deviceId: r.device_id,
    userId: r.user_id,
    recordedAt: r.recorded_at,
    heartRate: r.heart_rate,
    spo2: r.spo2,
    hrvMs: r.hrv_ms,
    ecgData: r.ecg_data,
    motionX: r.motion_x,
    motionY: r.motion_y,
    motionZ: r.motion_z,
    aiRiskScore: r.ai_risk_score,
    anomalyFlags: r.anomaly_flags ?? [],
  };
}

// GET /api/health/readings - paginated history for current user
export const GET = withAuth(async (req: AuthedRequest) => {
  try {
    const parsed = QuerySchema.parse({
      limit: req.nextUrl.searchParams.get('limit') ?? undefined,
      beforeId: req.nextUrl.searchParams.get('beforeId') ?? undefined,
      deviceId: req.nextUrl.searchParams.get('deviceId') ?? undefined,
    });

    let rows: any[] = [];

    if (parsed.deviceId && parsed.beforeId) {
      rows = await sql`
        SELECT
          id, device_id, user_id, recorded_at, heart_rate, spo2, hrv_ms, ecg_data,
          motion_x, motion_y, motion_z, ai_risk_score, anomaly_flags
        FROM health_readings
        WHERE user_id = ${req.user.sub}
          AND device_id = ${parsed.deviceId}
          AND id < ${parsed.beforeId}
        ORDER BY id DESC
        LIMIT ${parsed.limit}
      `;
    } else if (parsed.deviceId) {
      rows = await sql`
        SELECT
          id, device_id, user_id, recorded_at, heart_rate, spo2, hrv_ms, ecg_data,
          motion_x, motion_y, motion_z, ai_risk_score, anomaly_flags
        FROM health_readings
        WHERE user_id = ${req.user.sub}
          AND device_id = ${parsed.deviceId}
        ORDER BY id DESC
        LIMIT ${parsed.limit}
      `;
    } else if (parsed.beforeId) {
      rows = await sql`
        SELECT
          id, device_id, user_id, recorded_at, heart_rate, spo2, hrv_ms, ecg_data,
          motion_x, motion_y, motion_z, ai_risk_score, anomaly_flags
        FROM health_readings
        WHERE user_id = ${req.user.sub}
          AND id < ${parsed.beforeId}
        ORDER BY id DESC
        LIMIT ${parsed.limit}
      `;
    } else {
      rows = await sql`
        SELECT
          id, device_id, user_id, recorded_at, heart_rate, spo2, hrv_ms, ecg_data,
          motion_x, motion_y, motion_z, ai_risk_score, anomaly_flags
        FROM health_readings
        WHERE user_id = ${req.user.sub}
        ORDER BY id DESC
        LIMIT ${parsed.limit}
      `;
    }

    const readings = rows.map(mapReading);
    const nextCursor = readings.length === parsed.limit ? String(readings[readings.length - 1].id) : null;

    return NextResponse.json({ readings, nextCursor });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query params', details: error.errors }, { status: 400 });
    }
    console.error('[HEALTH READINGS GET ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch readings.' }, { status: 500 });
  }
});

// POST /api/health/readings - ingest a reading for current user and paired device
export const POST = withAuth(async (req: AuthedRequest) => {
  try {
    const body = await req.json();
    const data = ReadingSchema.parse(body);

    const ownsDevice = await sql`
      SELECT id FROM devices
      WHERE id = ${data.deviceId} AND user_id = ${req.user.sub}
      LIMIT 1
    `;

    if (ownsDevice.length === 0) {
      return NextResponse.json({ error: 'Device not found for this account.' }, { status: 404 });
    }

    const recordedAt = data.recordedAt ? new Date(data.recordedAt) : null;

    const inserted = await sql`
      INSERT INTO health_readings (
        device_id, user_id, recorded_at, heart_rate, spo2, hrv_ms, ecg_data,
        motion_x, motion_y, motion_z, ai_risk_score, anomaly_flags
      ) VALUES (
        ${data.deviceId},
        ${req.user.sub},
        COALESCE(${recordedAt}, NOW()),
        ${data.heartRate ?? null},
        ${data.spo2 ?? null},
        ${data.hrvMs ?? null},
        ${data.ecgData ?? null},
        ${data.motionX ?? null},
        ${data.motionY ?? null},
        ${data.motionZ ?? null},
        ${data.aiRiskScore ?? null},
        ${data.anomalyFlags ?? null}
      )
      RETURNING
        id, device_id, user_id, recorded_at, heart_rate, spo2, hrv_ms, ecg_data,
        motion_x, motion_y, motion_z, ai_risk_score, anomaly_flags
    `;

    return NextResponse.json(
      {
        success: true,
        reading: mapReading(inserted[0]),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('[HEALTH READINGS POST ERROR]', error);
    return NextResponse.json({ error: 'Failed to store health reading.' }, { status: 500 });
  }
});

