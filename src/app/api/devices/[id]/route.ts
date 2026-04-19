import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyAccessToken, extractToken } from '@/lib/jwt';

// ── GET /api/devices/[id] ──────────────────────────────────────
// Get a single device with its latest health metrics
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

    // Get device
    const devices = await sql`
      SELECT
        id, user_id, serial_number, model, firmware_version,
        status, battery_level, last_sync, activated_at, created_at, updated_at
      FROM devices
      WHERE id = ${id} AND user_id = ${userId}
    `;

    if (devices.length === 0) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      );
    }

    const device = devices[0] as any;

    // Get latest health reading
    const latestReading = await sql`
      SELECT
        id, heart_rate, spo2, temperature, respiratory_rate,
        systolic_bp, diastolic_bp, ai_risk_score, recorded_at
      FROM health_readings
      WHERE device_id = ${id}
      ORDER BY recorded_at DESC
      LIMIT 1
    `;

    // Get stats (last 24 hours)
    const stats = await sql`
      SELECT
        COUNT(*) as "readingCount",
        ROUND(AVG(heart_rate)::numeric, 1) as "avgHeartRate",
        ROUND(AVG(spo2)::numeric, 1) as "avgSpo2",
        MAX(heart_rate) as "maxHeartRate",
        MIN(heart_rate) as "minHeartRate",
        COUNT(CASE WHEN ai_risk_score > 0.75 THEN 1 END) as "criticalReadings"
      FROM health_readings
      WHERE device_id = ${id} AND recorded_at >= NOW() - INTERVAL '24 hours'
    `;

    const mappedDevice = mapDevice(device);
    const deviceStats = stats[0] as any;

    return NextResponse.json({
      success: true,
      device: mappedDevice,
      latestReading: latestReading.length > 0 ? latestReading[0] : null,
      stats: {
        readingCount: parseInt(deviceStats.readingCount),
        avgHeartRate: deviceStats.avgHeartRate,
        avgSpo2: deviceStats.avgSpo2,
        maxHeartRate: deviceStats.maxHeartRate,
        minHeartRate: deviceStats.minHeartRate,
        criticalReadings: parseInt(deviceStats.criticalReadings),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Token')) {
      return NextResponse.json(
        { error: 'Token expired or invalid. Please sign in again.' },
        { status: 401 }
      );
    }
    console.error('[DEVICE GET BY ID]', error);
    return NextResponse.json(
      { error: 'Failed to fetch device' },
      { status: 500 }
    );
  }
}

function mapDevice(d: any) {
  return {
    id: d.id,
    userId: d.user_id,
    serialNumber: d.serial_number,
    model: d.model,
    firmwareVersion: d.firmware_version,
    status: d.status,
    batteryLevel: d.battery_level,
    lastSync: d.last_sync,
    activatedAt: d.activated_at,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}
