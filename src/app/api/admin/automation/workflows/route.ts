import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminLoginSecret, isAdminRequest } from '@/lib/adminAuth';
import { createWorkflowDraft, getAutomationAdminSnapshot, updateWorkflowEnabledState, updateWorkflowSettings } from '@/lib/automationWorkflows';

const CreateSchema = z.object({
  workflowKey: z.string().min(3).max(80).regex(/^[a-z0-9_]+$/),
  name: z.string().min(3).max(160),
  description: z.string().min(8).max(500),
  module: z.enum(['support', 'health', 'assistant']),
  triggerEvent: z.string().min(3).max(80),
  config: z.record(z.any()).optional(),
});

const UpdateSchema = z.object({
  workflowKey: z.string().min(3).max(80),
  isEnabled: z.boolean().optional(),
  config: z.record(z.any()).optional(),
}).refine((value) => typeof value.isEnabled === 'boolean' || !!value.config, {
  message: 'Provide isEnabled or config to update.',
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
    const snapshot = await getAutomationAdminSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error('[ADMIN AUTOMATION WORKFLOWS GET ERROR]', error);
    return NextResponse.json({ error: 'Failed to load automation workflows.' }, { status: 500 });
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

    const workflow =
      data.config
        ? await updateWorkflowSettings({
            workflowKey: data.workflowKey,
            isEnabled: data.isEnabled,
            config: data.config,
          })
        : await updateWorkflowEnabledState(data.workflowKey, data.isEnabled as boolean);

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found or automation tables are missing.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, workflow });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('[ADMIN AUTOMATION WORKFLOWS PATCH ERROR]', error);
    return NextResponse.json({ error: 'Failed to update automation workflow.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const adminLoginSecret = getAdminLoginSecret();
  if (!adminLoginSecret) {
    return NextResponse.json({ error: 'Admin key is not configured on server.' }, { status: 500 });
  }
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = CreateSchema.parse(body);

    const workflow = await createWorkflowDraft({
      workflowKey: data.workflowKey,
      name: data.name,
      description: data.description,
      module: data.module,
      triggerEvent: data.triggerEvent,
      config: data.config,
    });

    if (!workflow) {
      return NextResponse.json({ error: 'Automation tables are missing.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, workflow }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'Workflow key already exists.' }, { status: 409 });
    }
    console.error('[ADMIN AUTOMATION WORKFLOWS POST ERROR]', error);
    return NextResponse.json({ error: 'Failed to create automation workflow.' }, { status: 500 });
  }
}
