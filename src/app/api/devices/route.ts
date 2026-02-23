import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { withAuth, AuthedRequest } from '@/lib/authMiddleware';

const PairSchema = z.object({
  serialNumber: z.string().min(3).max(100),
  model: z.string().min(1).max(50).optional(),
});

const UpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.string().max(30).optional(),
  firmwareVersion: z.string().max(20).optional(),
  batteryLevel: z.number().int().min(0).max(100).optional(),
  lastSync: z.string().datetime().optional(),
});

const UnpairSchema = z.object({
  id: z.string().uuid(),
});

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

// GET /api/devices - list current user's paired devices
export const GET = withAuth(async (req: AuthedRequest) => {
  const devices = await sql`
    SELECT
      id, user_id, serial_number, model, firmware_version,
      status, battery_level, last_sync, activated_at, created_at, updated_at
    FROM devices
    WHERE user_id = ${req.user.sub}
    ORDER BY created_at DESC
  `;

  return NextResponse.json({ devices: devices.map(mapDevice) });
});

// POST /api/devices - pair a device by serial number
export const POST = withAuth(async (req: AuthedRequest) => {
  try {
    const body = await req.json();
    const { serialNumber, model } = PairSchema.parse(body);

    const existing = await sql`
      SELECT
        id, user_id, serial_number, model, firmware_version,
        status, battery_level, last_sync, activated_at, created_at, updated_at
      FROM devices
      WHERE serial_number = ${serialNumber}
      LIMIT 1
    `;

    if (existing.length === 0) {
      if (!model) {
        return NextResponse.json(
          { error: 'Device not found. Provide model to register and pair a new device.' },
          { status: 404 }
        );
      }

      const inserted = await sql`
        INSERT INTO devices (user_id, serial_number, model, status, activated_at)
        VALUES (${req.user.sub}, ${serialNumber}, ${model}, 'offline', NOW())
        RETURNING
          id, user_id, serial_number, model, firmware_version,
          status, battery_level, last_sync, activated_at, created_at, updated_at
      `;

      return NextResponse.json({ success: true, device: mapDevice(inserted[0]) }, { status: 201 });
    }

    const device = existing[0] as any;

    if (device.user_id && device.user_id !== req.user.sub) {
      return NextResponse.json(
        { error: 'This device is already paired to another account.' },
        { status: 409 }
      );
    }

    if (device.user_id === req.user.sub) {
      return NextResponse.json({ success: true, device: mapDevice(device) });
    }

    const paired = await sql`
      UPDATE devices
      SET user_id = ${req.user.sub},
          activated_at = COALESCE(activated_at, NOW()),
          updated_at = NOW()
      WHERE id = ${device.id}
      RETURNING
        id, user_id, serial_number, model, firmware_version,
        status, battery_level, last_sync, activated_at, created_at, updated_at
    `;

    return NextResponse.json({ success: true, device: mapDevice(paired[0]) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('[DEVICES POST ERROR]', error);
    return NextResponse.json({ error: 'Failed to pair device.' }, { status: 500 });
  }
});

// PATCH /api/devices - update status/telemetry for a paired device
export const PATCH = withAuth(async (req: AuthedRequest) => {
  try {
    const body = await req.json();
    const data = UpdateSchema.parse(body);

    const hasFields =
      data.status !== undefined ||
      data.firmwareVersion !== undefined ||
      data.batteryLevel !== undefined ||
      data.lastSync !== undefined;

    if (!hasFields) {
      return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
    }

    const lastSyncDate = data.lastSync ? new Date(data.lastSync) : null;

    const updated = await sql`
      UPDATE devices SET
        status = COALESCE(${data.status ?? null}, status),
        firmware_version = COALESCE(${data.firmwareVersion ?? null}, firmware_version),
        battery_level = COALESCE(${data.batteryLevel ?? null}, battery_level),
        last_sync = COALESCE(${lastSyncDate}, last_sync),
        updated_at = NOW()
      WHERE id = ${data.id} AND user_id = ${req.user.sub}
      RETURNING
        id, user_id, serial_number, model, firmware_version,
        status, battery_level, last_sync, activated_at, created_at, updated_at
    `;

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Device not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, device: mapDevice(updated[0]) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('[DEVICES PATCH ERROR]', error);
    return NextResponse.json({ error: 'Failed to update device.' }, { status: 500 });
  }
});

// DELETE /api/devices - unpair device from current user
export const DELETE = withAuth(async (req: AuthedRequest) => {
  try {
    const body = await req.json();
    const { id } = UnpairSchema.parse(body);

    const updated = await sql`
      UPDATE devices
      SET user_id = NULL,
          status = 'offline',
          updated_at = NOW()
      WHERE id = ${id} AND user_id = ${req.user.sub}
      RETURNING
        id, user_id, serial_number, model, firmware_version,
        status, battery_level, last_sync, activated_at, created_at, updated_at
    `;

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Device not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, device: mapDevice(updated[0]) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('[DEVICES DELETE ERROR]', error);
    return NextResponse.json({ error: 'Failed to unpair device.' }, { status: 500 });
  }
});

