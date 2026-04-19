import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminLoginSecret, isAdminRequest } from '@/lib/adminAuth';
import {
  createAssistantTrainingEntry,
  deleteAssistantTrainingEntry,
  isMissingTrainingTableError,
  listAssistantTrainingEntries,
  updateAssistantTrainingEntry,
} from '@/lib/assistantTraining';

const ModeSchema = z.enum([
  'all',
  'urgent_triage',
  'health_guidance',
  'device_support',
  'billing_support',
  'care_planning',
]);

const CreateSchema = z.object({
  title: z.string().min(3).max(160),
  mode: ModeSchema,
  priority: z.number().int().min(0).max(100).optional(),
  instructions: z.string().min(10).max(4000),
  examples: z.array(z.string().min(2).max(500)).max(5).optional(),
  isEnabled: z.boolean().optional(),
});

const UpdateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(3).max(160).optional(),
  mode: ModeSchema.optional(),
  priority: z.number().int().min(0).max(100).optional(),
  instructions: z.string().min(10).max(4000).optional(),
  examples: z.array(z.string().min(2).max(500)).max(5).optional(),
  isEnabled: z.boolean().optional(),
});

const DeleteSchema = z.object({
  id: z.string().uuid(),
});

function assertAdmin(req: NextRequest): NextResponse | null {
  const adminLoginSecret = getAdminLoginSecret();
  if (!adminLoginSecret) {
    return NextResponse.json({ error: 'Admin key is not configured on server.' }, { status: 500 });
  }
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const authError = assertAdmin(req);
  if (authError) return authError;

  try {
    const entries = await listAssistantTrainingEntries();
    return NextResponse.json({ entries });
  } catch (error) {
    if (isMissingTrainingTableError(error)) {
      return NextResponse.json({
        entries: [],
        warning: 'assistant_training_entries table is missing. Run latest database/setup.sql.',
      });
    }
    console.error('[ADMIN ASSISTANT TRAINING GET ERROR]', error);
    return NextResponse.json({ error: 'Failed to load assistant training entries.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authError = assertAdmin(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const data = CreateSchema.parse(body);
    const created = await createAssistantTrainingEntry(data);
    if (!created) {
      return NextResponse.json({ error: 'Failed to create training entry.' }, { status: 500 });
    }
    return NextResponse.json({ success: true, entry: created }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    if (isMissingTrainingTableError(error)) {
      return NextResponse.json({ error: 'Training table is missing. Run latest database/setup.sql.' }, { status: 500 });
    }
    console.error('[ADMIN ASSISTANT TRAINING POST ERROR]', error);
    return NextResponse.json({ error: 'Failed to create assistant training entry.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const authError = assertAdmin(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const data = UpdateSchema.parse(body);
    const updated = await updateAssistantTrainingEntry(data);
    if (!updated) {
      return NextResponse.json({ error: 'Training entry not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, entry: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    if (isMissingTrainingTableError(error)) {
      return NextResponse.json({ error: 'Training table is missing. Run latest database/setup.sql.' }, { status: 500 });
    }
    console.error('[ADMIN ASSISTANT TRAINING PATCH ERROR]', error);
    return NextResponse.json({ error: 'Failed to update assistant training entry.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authError = assertAdmin(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const data = DeleteSchema.parse(body);
    const deleted = await deleteAssistantTrainingEntry(data.id);
    if (!deleted) {
      return NextResponse.json({ error: 'Training entry not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    if (isMissingTrainingTableError(error)) {
      return NextResponse.json({ error: 'Training table is missing. Run latest database/setup.sql.' }, { status: 500 });
    }
    console.error('[ADMIN ASSISTANT TRAINING DELETE ERROR]', error);
    return NextResponse.json({ error: 'Failed to delete assistant training entry.' }, { status: 500 });
  }
}

