import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { withAuth, AuthedRequest } from '@/lib/authMiddleware';

const AlertStatus = z.enum(['pending', 'acknowledged', 'resolved', 'dismissed']);
const AlertSeverity = z.enum(['low', 'medium', 'high', 'critical']);

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  beforeCreatedAt: z.string().datetime().optional(),
  status: AlertStatus.optional(),
});

const CreateSchema = z.object({
  deviceId: z.string().uuid().optional(),
  alertType: z.string().min(1).max(50),
  severity: AlertSeverity,
  locationLat: z.number().min(-90).max(90).optional(),
  locationLng: z.number().min(-180).max(180).optional(),
  healthSnapshot: z.any().optional(),
  dispatchedTo: z.array(z.string()).optional(),
});

const UpdateSchema = z.object({
  id: z.string().uuid(),
  status: AlertStatus,
  dismissedBy: z.string().max(50).optional(),
});

function mapAlert(a: any) {
  return {
    id: a.id,
    userId: a.user_id,
    deviceId: a.device_id,
    alertType: a.alert_type,
    severity: a.severity,
    status: a.status,
    locationLat: a.location_lat,
    locationLng: a.location_lng,
    healthSnapshot: a.health_snapshot,
    dispatchedTo: a.dispatched_to ?? [],
    dismissedBy: a.dismissed_by,
    createdAt: a.created_at,
    resolvedAt: a.resolved_at,
  };
}

// GET /api/alerts - list current user's alerts
export const GET = withAuth(async (req: AuthedRequest) => {
  try {
    const parsed = QuerySchema.parse({
      limit: req.nextUrl.searchParams.get('limit') ?? undefined,
      beforeCreatedAt: req.nextUrl.searchParams.get('beforeCreatedAt') ?? undefined,
      status: req.nextUrl.searchParams.get('status') ?? undefined,
    });

    let rows: any[] = [];
    const beforeDate = parsed.beforeCreatedAt ? new Date(parsed.beforeCreatedAt) : null;

    if (parsed.status && beforeDate) {
      rows = await sql`
        SELECT
          id, user_id, device_id, alert_type, severity, status,
          location_lat, location_lng, health_snapshot, dispatched_to,
          dismissed_by, created_at, resolved_at
        FROM alerts
        WHERE user_id = ${req.user.sub}
          AND status = ${parsed.status}
          AND created_at < ${beforeDate}
        ORDER BY created_at DESC
        LIMIT ${parsed.limit}
      `;
    } else if (parsed.status) {
      rows = await sql`
        SELECT
          id, user_id, device_id, alert_type, severity, status,
          location_lat, location_lng, health_snapshot, dispatched_to,
          dismissed_by, created_at, resolved_at
        FROM alerts
        WHERE user_id = ${req.user.sub}
          AND status = ${parsed.status}
        ORDER BY created_at DESC
        LIMIT ${parsed.limit}
      `;
    } else if (beforeDate) {
      rows = await sql`
        SELECT
          id, user_id, device_id, alert_type, severity, status,
          location_lat, location_lng, health_snapshot, dispatched_to,
          dismissed_by, created_at, resolved_at
        FROM alerts
        WHERE user_id = ${req.user.sub}
          AND created_at < ${beforeDate}
        ORDER BY created_at DESC
        LIMIT ${parsed.limit}
      `;
    } else {
      rows = await sql`
        SELECT
          id, user_id, device_id, alert_type, severity, status,
          location_lat, location_lng, health_snapshot, dispatched_to,
          dismissed_by, created_at, resolved_at
        FROM alerts
        WHERE user_id = ${req.user.sub}
        ORDER BY created_at DESC
        LIMIT ${parsed.limit}
      `;
    }

    const alerts = rows.map(mapAlert);
    const nextCursor =
      alerts.length === parsed.limit ? String(alerts[alerts.length - 1].createdAt) : null;

    return NextResponse.json({ alerts, nextCursor });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query params', details: error.errors }, { status: 400 });
    }
    console.error('[ALERTS GET ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch alerts.' }, { status: 500 });
  }
});

// POST /api/alerts - create a new alert for current user
export const POST = withAuth(async (req: AuthedRequest) => {
  try {
    const body = await req.json();
    const data = CreateSchema.parse(body);

    if (data.deviceId) {
      const ownsDevice = await sql`
        SELECT id FROM devices
        WHERE id = ${data.deviceId} AND user_id = ${req.user.sub}
        LIMIT 1
      `;
      if (ownsDevice.length === 0) {
        return NextResponse.json({ error: 'Device not found for this account.' }, { status: 404 });
      }
    }

    const inserted = await sql`
      INSERT INTO alerts (
        user_id, device_id, alert_type, severity, status,
        location_lat, location_lng, health_snapshot, dispatched_to
      ) VALUES (
        ${req.user.sub},
        ${data.deviceId ?? null},
        ${data.alertType},
        ${data.severity},
        'pending',
        ${data.locationLat ?? null},
        ${data.locationLng ?? null},
        ${data.healthSnapshot ?? null},
        ${data.dispatchedTo ?? null}
      )
      RETURNING
        id, user_id, device_id, alert_type, severity, status,
        location_lat, location_lng, health_snapshot, dispatched_to,
        dismissed_by, created_at, resolved_at
    `;

    return NextResponse.json({ success: true, alert: mapAlert(inserted[0]) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('[ALERTS POST ERROR]', error);
    return NextResponse.json({ error: 'Failed to create alert.' }, { status: 500 });
  }
});

// PATCH /api/alerts - update alert status (acknowledge/resolve/dismiss)
export const PATCH = withAuth(async (req: AuthedRequest) => {
  try {
    const body = await req.json();
    const data = UpdateSchema.parse(body);
    const isResolvedState = data.status === 'resolved' || data.status === 'dismissed';

    const updated = await sql`
      UPDATE alerts SET
        status = ${data.status},
        dismissed_by = COALESCE(${data.dismissedBy ?? null}, dismissed_by),
        resolved_at = CASE WHEN ${isResolvedState} THEN NOW() ELSE resolved_at END
      WHERE id = ${data.id} AND user_id = ${req.user.sub}
      RETURNING
        id, user_id, device_id, alert_type, severity, status,
        location_lat, location_lng, health_snapshot, dispatched_to,
        dismissed_by, created_at, resolved_at
    `;

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Alert not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, alert: mapAlert(updated[0]) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('[ALERTS PATCH ERROR]', error);
    return NextResponse.json({ error: 'Failed to update alert.' }, { status: 500 });
  }
});

