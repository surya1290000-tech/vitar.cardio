import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { withAuth, AuthedRequest } from '@/lib/authMiddleware';
import { runHealthReadingAutomation } from '@/lib/automationWorkflows';

// ── SCHEMAS ────────────────────────────────────────────────────

const SubmitReadingSchema = z.object({
  deviceId: z.string().uuid('Invalid device ID'),
  heartRate: z.number().int().min(0).max(300).optional(),
  spo2: z.number().min(0).max(100).optional(), // Oxygen saturation percentage
  temperature: z.number().min(30).max(45).optional(), // Celsius
  respiratoryRate: z.number().int().min(0).max(100).optional(),
  systolicBP: z.number().int().min(50).max(250).optional(), // Blood pressure
  diastolicBP: z.number().int().min(30).max(150).optional(),
  aiRiskScore: z.number().min(0).max(100).optional(), // AI-calculated risk (0-100)
  recordedAt: z.string().datetime().optional(), // Custom timestamp or now()
  notes: z.string().max(500).optional(),
});

// ── POST /api/devices/health-readings ────────────────────────────
// Submit a new health reading from device or manual entry
export const POST = withAuth(async (req: AuthedRequest) => {
  try {
    const body = await req.json();
    const data = SubmitReadingSchema.parse(body);

    // Verify device belongs to this user
    const device = await sql`
      SELECT id FROM devices 
      WHERE id = ${data.deviceId} AND user_id = ${req.user.sub}
    `;

    if (device.length === 0) {
      return NextResponse.json(
        { error: 'Device not found or not authorized' },
        { status: 404 }
      );
    }

    const recordedAt = data.recordedAt ? new Date(data.recordedAt) : new Date();

    // Insert health reading
    const reading = await sql`
      INSERT INTO health_readings (
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
      ) VALUES (
        ${data.deviceId},
        ${req.user.sub},
        ${data.heartRate ?? null},
        ${data.spo2 ?? null},
        ${data.temperature ?? null},
        ${data.respiratoryRate ?? null},
        ${data.systolicBP ?? null},
        ${data.diastolicBP ?? null},
        ${data.aiRiskScore ? data.aiRiskScore / 100 : null},
        ${recordedAt},
        ${data.notes ?? null},
        NOW()
      )
      RETURNING 
        id,
        device_id as "deviceId",
        heart_rate as "heartRate",
        spo2,
        temperature,
        respiratory_rate as "respiratoryRate",
        systolic_bp as "systolicBP",
        diastolic_bp as "diastolicBP",
        ai_risk_score as "aiRiskScore",
        recorded_at as "recordedAt",
        notes,
        created_at as "createdAt"
    `;

    // Check if reading creates critical alert
    await checkAndCreateAlert(data.deviceId, req.user.sub, reading[0] as any);
    const automation = await runHealthReadingAutomation({
      readingId: (reading[0] as any).id,
      userId: req.user.sub,
      deviceId: data.deviceId,
      heartRate: (reading[0] as any).heartRate ?? null,
      spo2: (reading[0] as any).spo2 ?? null,
      temperature: (reading[0] as any).temperature ?? null,
      systolicBP: (reading[0] as any).systolicBP ?? null,
      diastolicBP: (reading[0] as any).diastolicBP ?? null,
      aiRiskScore: (reading[0] as any).aiRiskScore ?? null,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Health reading recorded successfully',
        reading: reading[0],
        automation,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error('[HEALTH READINGS POST]', error);
    return NextResponse.json(
      { error: 'Failed to record health reading' },
      { status: 500 }
    );
  }
});

// ── GET /api/devices/health-readings ─────────────────────────────
// Get health readings (optionally filtered by device and time range)
export const GET = withAuth(async (req: AuthedRequest) => {
  try {
    const QuerySchema = z.object({
      deviceId: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(1000).default(100),
      hours: z.coerce.number().int().min(1).max(24 * 30).default(24),
    });
    const parsed = QuerySchema.parse({
      deviceId: req.nextUrl.searchParams.get('deviceId') ?? undefined,
      limit: req.nextUrl.searchParams.get('limit') ?? undefined,
      hours: req.nextUrl.searchParams.get('hours') ?? undefined,
    });

    const { deviceId, limit, hours } = parsed;
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    let readings: any[] = [];
    if (deviceId) {
      readings = await sql`
        SELECT
          hr.id,
          hr.device_id as "deviceId",
          d.serial_number as "deviceSerialNumber",
          hr.heart_rate as "heartRate",
          hr.spo2,
          hr.temperature,
          hr.respiratory_rate as "respiratoryRate",
          hr.systolic_bp as "systolicBP",
          hr.diastolic_bp as "diastolicBP",
          hr.ai_risk_score as "aiRiskScore",
          hr.recorded_at as "recordedAt",
          hr.notes,
          hr.created_at as "createdAt"
        FROM health_readings hr
        JOIN devices d ON hr.device_id = d.id
        WHERE d.user_id = ${req.user.sub}
          AND hr.recorded_at >= ${startTime}
          AND hr.device_id = ${deviceId}
        ORDER BY hr.recorded_at DESC
        LIMIT ${limit}
      `;
    } else {
      readings = await sql`
        SELECT
          hr.id,
          hr.device_id as "deviceId",
          d.serial_number as "deviceSerialNumber",
          hr.heart_rate as "heartRate",
          hr.spo2,
          hr.temperature,
          hr.respiratory_rate as "respiratoryRate",
          hr.systolic_bp as "systolicBP",
          hr.diastolic_bp as "diastolicBP",
          hr.ai_risk_score as "aiRiskScore",
          hr.recorded_at as "recordedAt",
          hr.notes,
          hr.created_at as "createdAt"
        FROM health_readings hr
        JOIN devices d ON hr.device_id = d.id
        WHERE d.user_id = ${req.user.sub}
          AND hr.recorded_at >= ${startTime}
        ORDER BY hr.recorded_at DESC
        LIMIT ${limit}
      `;
    }

    return NextResponse.json({
      success: true,
      count: readings.length,
      timeRange: { hours, startTime },
      readings,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query params', details: error.errors }, { status: 400 });
    }
    console.error('[HEALTH READINGS GET]', error);
    return NextResponse.json(
      { error: 'Failed to fetch health readings' },
      { status: 500 }
    );
  }
});

// ── HELPER FUNCTION: Check health thresholds and create alerts ────
async function checkAndCreateAlert(
  deviceId: string,
  userId: string,
  reading: any
) {
  const alerts: Array<{ condition: string; severity: string }> = [];

  // Define alert thresholds
  if (reading.heartRate !== null && reading.heartRate > 120) {
    alerts.push({ condition: 'High Heart Rate (>120 bpm)', severity: 'warning' });
  }
  if (reading.heartRate !== null && reading.heartRate < 40) {
    alerts.push({ condition: 'Low Heart Rate (<40 bpm)', severity: 'warning' });
  }
  if (reading.spo2 !== null && reading.spo2 < 90) {
    alerts.push({ condition: 'Low Oxygen Saturation (<90%)', severity: 'critical' });
  }
  if (reading.aiRiskScore !== null && reading.aiRiskScore > 0.75) {
    alerts.push({ condition: 'High AI Risk Score (>75%)', severity: 'critical' });
  }
  if (reading.systolicBP !== null && reading.systolicBP > 180) {
    alerts.push({ condition: 'High Blood Pressure (>180 mmHg)', severity: 'critical' });
  }
  if (reading.systolicBP !== null && reading.systolicBP < 90) {
    alerts.push({ condition: 'Low Blood Pressure (<90 mmHg)', severity: 'warning' });
  }
  if (reading.temperature !== null && reading.temperature > 38.5) {
    alerts.push({ condition: 'High Temperature (>38.5°C)', severity: 'warning' });
  }
  if (reading.temperature !== null && reading.temperature < 35) {
    alerts.push({ condition: 'Low Temperature (<35°C)', severity: 'warning' });
  }

  // Create alerts in database
  for (const alert of alerts) {
    try {
      await sql`
        INSERT INTO alerts (
          device_id,
          user_id,
          alert_type,
          severity,
          message,
          status,
          created_at
        ) VALUES (
          ${deviceId},
          ${userId},
          ${alert.condition},
          ${alert.severity},
          ${`Health alert: ${alert.condition}`},
          'pending',
          NOW()
        )
      `;
      console.log(`[ALERT] Created ${alert.severity} alert: ${alert.condition}`);
    } catch (err) {
      console.error('[ALERT CREATION ERROR]', err);
    }
  }
}
