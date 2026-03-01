import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { withAuth, AuthedRequest } from '@/lib/authMiddleware';

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(40),
});

const PostSchema = z.object({
  message: z.string().min(2).max(3000),
});

function formatRiskPercent(raw: number | null): number | null {
  if (raw == null) return null;
  if (raw <= 1) return Number((raw * 100).toFixed(1));
  return Number(raw.toFixed(1));
}

function buildAssistantReply(message: string, latest: any | null) {
  const content = message.toLowerCase();
  const heartRate = latest?.heart_rate as number | null;
  const spo2 = latest?.spo2 as number | null;
  const riskPercent = formatRiskPercent((latest?.ai_risk_score ?? null) as number | null);

  const metricLineParts: string[] = [];
  if (heartRate != null) metricLineParts.push(`heart rate ${heartRate} bpm`);
  if (spo2 != null) metricLineParts.push(`SpO2 ${spo2}%`);
  if (riskPercent != null) metricLineParts.push(`risk ${riskPercent}%`);

  const metricsLine =
    metricLineParts.length > 0
      ? `Latest wearable snapshot: ${metricLineParts.join(', ')}.`
      : 'I do not see a recent wearable reading yet.';

  const emergencyKeywords = ['chest pain', 'severe pain', 'fainted', 'faint', 'unconscious', 'can not breathe', 'cant breathe', 'shortness of breath'];
  if (emergencyKeywords.some((k) => content.includes(k))) {
    return {
      severity: 'urgent',
      message:
        'This sounds urgent. Please call local emergency services now. If available, alert your emergency contacts immediately and do not stay alone. ' +
        metricsLine +
        ' I am not a substitute for emergency medical care.',
    };
  }

  if (content.includes('report') || content.includes('summary')) {
    return {
      severity: 'normal',
      message:
        `${metricsLine} I can help summarize trends if you share time range (24h/7d) and symptoms. ` +
        'For diagnosis or treatment decisions, consult your clinician.',
    };
  }

  if (content.includes('exercise') || content.includes('workout') || content.includes('run')) {
    return {
      severity: 'normal',
      message:
        `${metricsLine} For safer training: warm up 8-10 min, keep hydration consistent, and stop if chest discomfort, dizziness, or unusual breathlessness appears. ` +
        'If your risk stays elevated repeatedly, schedule a clinician review.',
    };
  }

  if (content.includes('sleep') || content.includes('stress') || content.includes('anxiety')) {
    return {
      severity: 'normal',
      message:
        `${metricsLine} A practical plan tonight: no caffeine late evening, 10 minutes slow breathing, stable sleep window, and track morning symptoms. ` +
        'If symptoms worsen, seek medical evaluation.',
    };
  }

  if (riskPercent != null && riskPercent >= 70) {
    return {
      severity: 'high',
      message:
        `${metricsLine} Your recent risk appears elevated. Limit exertion for now, monitor for symptoms (chest pain, faintness, severe shortness of breath), and contact a healthcare professional today.`,
    };
  }

  return {
    severity: 'normal',
    message:
      `${metricsLine} I can help with symptom triage, lifestyle guidance, medication reminders, and preparation questions for your doctor visit. ` +
      'Tell me what you are feeling right now.',
  };
}

// GET /api/health-assistant/chat - latest chat history
export const GET = withAuth(async (req: AuthedRequest) => {
  try {
    const parsed = QuerySchema.parse({
      limit: req.nextUrl.searchParams.get('limit') ?? undefined,
    });

    const rows = await sql`
      SELECT id, role, message, created_at
      FROM health_assistant_chats
      WHERE user_id = ${req.user.sub}
      ORDER BY created_at DESC
      LIMIT ${parsed.limit}
    `;

    return NextResponse.json({
      messages: rows
        .map((r: any) => ({
          id: r.id,
          role: r.role,
          message: r.message,
          createdAt: r.created_at,
        }))
        .reverse(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query params', details: error.errors }, { status: 400 });
    }
    console.error('[HEALTH ASSISTANT GET]', error);
    return NextResponse.json({ error: 'Failed to load assistant messages.' }, { status: 500 });
  }
});

// POST /api/health-assistant/chat - post user message and generate assistant response
export const POST = withAuth(async (req: AuthedRequest) => {
  try {
    const body = await req.json();
    const data = PostSchema.parse(body);

    await sql`
      INSERT INTO health_assistant_chats (user_id, role, message)
      VALUES (${req.user.sub}, 'user', ${data.message})
    `;

    const latest = await sql`
      SELECT heart_rate, spo2, ai_risk_score, recorded_at
      FROM health_readings
      WHERE user_id = ${req.user.sub}
      ORDER BY recorded_at DESC
      LIMIT 1
    `;

    const answer = buildAssistantReply(data.message, latest[0] ?? null);

    const inserted = await sql`
      INSERT INTO health_assistant_chats (user_id, role, message, context)
      VALUES (
        ${req.user.sub},
        'assistant',
        ${answer.message},
        jsonb_build_object('severity', ${answer.severity})
      )
      RETURNING id, role, message, created_at
    `;

    const row = inserted[0] as any;

    return NextResponse.json({
      success: true,
      reply: {
        id: row.id,
        role: row.role,
        message: row.message,
        createdAt: row.created_at,
        severity: answer.severity,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('[HEALTH ASSISTANT POST]', error);
    return NextResponse.json({ error: 'Failed to process assistant message.' }, { status: 500 });
  }
});
