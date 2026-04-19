import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminLoginSecret, isAdminRequest } from '@/lib/adminAuth';
import { simulateWorkflowTemplate } from '@/lib/automationWorkflows';

const SimulationSchema = z.object({
  templateKey: z.enum(['support_ticket_triage', 'health_reading_guardian', 'assistant_urgent_triage']),
  payload: z.record(z.any()).default({}),
});

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
    const data = SimulationSchema.parse(body);
    const result = await simulateWorkflowTemplate(data);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid simulation input', details: error.errors }, { status: 400 });
    }
    console.error('[ADMIN AUTOMATION TEST ERROR]', error);
    return NextResponse.json({ error: 'Failed to simulate workflow.' }, { status: 500 });
  }
}
