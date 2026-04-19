import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyAccessToken, extractToken } from '@/lib/jwt';

// ── GET /api/devices/[id]/health-readings ──────────────────────
// Get health readings for a specific device
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify auth
    const token = extractToken(req.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    const user = verifyAccessToken(token);
    const userId = user.sub;
    const { id } = await params;

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
    const hours = parseInt(searchParams.get('hours') || '24');

    // Verify device belongs to user
    const device = await sql`
      SELECT id FROM devices 
      WHERE id = ${id} AND user_id = ${userId}
    `;

    if (device.length === 0) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      );
    }

    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const readings = await sql`
      SELECT
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
      FROM health_readings
      WHERE device_id = ${id} AND recorded_at >= ${startTime}
      ORDER BY recorded_at DESC
      LIMIT ${limit}
    `;

    // Calculate trends
    const stats = await sql`
      SELECT
        COUNT(*) as "count",
        ROUND(AVG(heart_rate)::numeric, 1) as "avgHeartRate",
        MAX(heart_rate) as "maxHeartRate",
        MIN(heart_rate) as "minHeartRate",
        ROUND(AVG(spo2)::numeric, 1) as "avgSpo2",
        ROUND(AVG(temperature)::numeric, 2) as "avgTemp",
        COUNT(CASE WHEN ai_risk_score > 0.75 THEN 1 END) as "alertCount"
      FROM health_readings
      WHERE device_id = ${id} AND recorded_at >= ${startTime}
    `;

    const statData = stats[0] as any;

    return NextResponse.json({
      success: true,
      deviceId: id,
      timeRange: {
        hours,
        startTime: startTime.toISOString(),
        endTime: new Date().toISOString(),
      },
      count: readings.length,
      stats: {
        totalReadings: parseInt(statData.count) || 0,
        avgHeartRate: statData.avgHeartRate || null,
        maxHeartRate: statData.maxHeartRate || null,
        minHeartRate: statData.minHeartRate || null,
        avgSpo2: statData.avgSpo2 || null,
        avgTemperature: statData.avgTemp || null,
        alertsTriggered: parseInt(statData.alertCount) || 0,
      },
      readings,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Token')) {
      return NextResponse.json(
        { error: 'Token expired or invalid. Please sign in again.' },
        { status: 401 }
      );
    }
    console.error('[HEALTH READINGS BY DEVICE]', error);
    return NextResponse.json(
      { error: 'Failed to fetch health readings' },
      { status: 500 }
    );
  }
}
