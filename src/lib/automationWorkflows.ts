import { sql } from '@/lib/db';

type WorkflowModule = 'support' | 'health' | 'assistant';
type WorkflowSeverity = 'normal' | 'high' | 'urgent' | 'critical';

interface WorkflowDefinition {
  key: string;
  name: string;
  description: string;
  module: WorkflowModule;
  triggerEvent: string;
  automationType: string;
  defaultConfig: Record<string, unknown>;
}

interface WorkflowRow {
  id: string;
  workflow_key: string;
  name: string;
  description: string;
  module: WorkflowModule;
  trigger_event: string;
  automation_type: string;
  is_enabled: boolean;
  config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationWorkflowView {
  id: string;
  workflowKey: string;
  name: string;
  description: string;
  module: WorkflowModule;
  triggerEvent: string;
  automationType: string;
  isEnabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationLogView {
  id: string;
  workflowKey: string;
  entityType: string;
  entityId: string;
  userId: string | null;
  status: string;
  severity: WorkflowSeverity | string;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface SupportAutomationDraft {
  suggestedCategory: string | null;
  suggestedPriority: string | null;
  originalCategory: string | null;
  originalPriority: string | null;
  draftReply: string | null;
  summary: string;
  severity: string;
  createdAt: string;
}

const WORKFLOW_DEFINITIONS: WorkflowDefinition[] = [
  {
    key: 'support_ticket_triage',
    name: 'Support Ticket Triage',
    description:
      'Auto-classifies support tickets, upgrades priority when risk language appears, and drafts a first reply for the support desk.',
    module: 'support',
    triggerEvent: 'support.ticket.created',
    automationType: 'heuristic_ai',
    defaultConfig: {
      autoUpgradePriority: true,
      autoCategorizeGeneral: true,
      generateDraftReply: true,
    },
  },
  {
    key: 'health_reading_guardian',
    name: 'Health Reading Guardian',
    description:
      'Evaluates incoming health readings, summarizes risk, and records automation events for elevated or critical readings.',
    module: 'health',
    triggerEvent: 'health.reading.recorded',
    automationType: 'heuristic_ai',
    defaultConfig: {
      criticalRiskThreshold: 0.75,
      highRiskThreshold: 0.5,
      logNormalReadings: false,
    },
  },
  {
    key: 'assistant_urgent_triage',
    name: 'Assistant Urgent Triage',
    description:
      'Flags urgent care-center conversations so elevated symptom messages are visible in admin operations.',
    module: 'assistant',
    triggerEvent: 'assistant.message.created',
    automationType: 'heuristic_ai',
    defaultConfig: {
      logHighSeverityReplies: true,
    },
  },
];

function isMissingRelationError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '42P01';
}

function normalizeWorkflowRow(row: WorkflowRow): AutomationWorkflowView {
  const definition = WORKFLOW_DEFINITIONS.find((item) => item.key === row.workflow_key);
  return {
    id: row.id,
    workflowKey: row.workflow_key,
    name: row.name,
    description: row.description,
    module: row.module,
    triggerEvent: row.trigger_event,
    automationType: row.automation_type,
    isEnabled: row.is_enabled,
    config: {
      ...(definition?.defaultConfig ?? {}),
      ...((row.config as Record<string, unknown> | null) ?? {}),
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function ensureWorkflowRegistry() {
  try {
    for (const workflow of WORKFLOW_DEFINITIONS) {
      await sql`
        INSERT INTO ai_workflows (
          workflow_key,
          name,
          description,
          module,
          trigger_event,
          automation_type,
          is_enabled,
          config,
          updated_at
        ) VALUES (
          ${workflow.key},
          ${workflow.name},
          ${workflow.description},
          ${workflow.module},
          ${workflow.triggerEvent},
          ${workflow.automationType},
          true,
          ${JSON.stringify(workflow.defaultConfig)}::jsonb,
          NOW()
        )
        ON CONFLICT (workflow_key) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          module = EXCLUDED.module,
          trigger_event = EXCLUDED.trigger_event,
          automation_type = EXCLUDED.automation_type,
          config = COALESCE(ai_workflows.config, '{}'::jsonb) || EXCLUDED.config,
          updated_at = NOW()
      `;
    }
    return true;
  } catch (error) {
    if (isMissingRelationError(error)) {
      return false;
    }
    throw error;
  }
}

async function getWorkflowRow(key: string): Promise<WorkflowRow | null> {
  const ready = await ensureWorkflowRegistry();
  if (!ready) return null;

  const rows = await sql`
    SELECT *
    FROM ai_workflows
    WHERE workflow_key = ${key}
    LIMIT 1
  `;

  return (rows[0] as WorkflowRow | undefined) ?? null;
}

async function insertAutomationLog(input: {
  workflowId?: string | null;
  workflowKey: string;
  entityType: string;
  entityId: string;
  userId?: string | null;
  status?: string;
  severity?: WorkflowSeverity;
  title: string;
  summary: string;
  payload?: Record<string, unknown>;
}) {
  try {
    await sql`
      INSERT INTO automation_logs (
        workflow_id,
        workflow_key,
        entity_type,
        entity_id,
        user_id,
        status,
        severity,
        title,
        summary,
        payload
      ) VALUES (
        ${input.workflowId ?? null},
        ${input.workflowKey},
        ${input.entityType},
        ${input.entityId},
        ${input.userId ?? null},
        ${input.status ?? 'completed'},
        ${input.severity ?? 'normal'},
        ${input.title},
        ${input.summary},
        ${JSON.stringify(input.payload ?? {})}::jsonb
      )
    `;
  } catch (error) {
    if (!isMissingRelationError(error)) {
      console.error('[AUTOMATION LOG ERROR]', error);
    }
  }
}

function priorityRank(value: string) {
  switch (value) {
    case 'urgent':
      return 4;
    case 'high':
      return 3;
    case 'normal':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

function deriveSupportInsights(subject: string, description: string) {
  const text = `${subject}\n${description}`.toLowerCase();
  const hasUrgentLanguage =
    /(chest pain|fainted|unconscious|can't breathe|cant breathe|shortness of breath|device shocked|emergency)/.test(text);
  const hasBillingLanguage = /(refund|charge|billing|payment|invoice|subscription|card declined)/.test(text);
  const hasTechnicalLanguage = /(error|crash|bug|issue|not loading|failed|login|password|sync)/.test(text);
  const hasDeviceLanguage = /(device|battery|pair|bluetooth|sensor|firmware|offline|wearable)/.test(text);
  const hasMedicalLanguage = /(heart rate|spo2|oxygen|doctor|symptom|dizzy|palpitations|arrhythmia|ecg|bp|blood pressure)/.test(text);

  let suggestedCategory: 'technical' | 'billing' | 'device' | 'medical' | 'general' = 'general';
  if (hasUrgentLanguage || hasMedicalLanguage) {
    suggestedCategory = 'medical';
  } else if (hasBillingLanguage) {
    suggestedCategory = 'billing';
  } else if (hasDeviceLanguage) {
    suggestedCategory = 'device';
  } else if (hasTechnicalLanguage) {
    suggestedCategory = 'technical';
  }

  let suggestedPriority: 'low' | 'normal' | 'high' | 'urgent' = 'normal';
  if (hasUrgentLanguage) {
    suggestedPriority = 'urgent';
  } else if (/(cannot|can't|cant|blocked|broken|failed|not working|offline)/.test(text)) {
    suggestedPriority = 'high';
  } else if (hasBillingLanguage || hasDeviceLanguage || hasMedicalLanguage) {
    suggestedPriority = 'high';
  }

  let draftReply =
    'Thanks for reaching out. We have logged your request and a support specialist will review the details shortly.';

  switch (suggestedCategory) {
    case 'medical':
      draftReply =
        'Thanks for flagging this. We have marked your case for fast review. If you are having chest pain, severe shortness of breath, or fainting symptoms, contact local emergency services immediately.';
      break;
    case 'device':
      draftReply =
        'Thanks for reporting the device issue. We are checking pairing, sync, and battery-related causes first. Please keep the device charged and nearby while we review the ticket.';
      break;
    case 'billing':
      draftReply =
        'Thanks for reaching out about billing. We are reviewing your order and payment history now and will follow up with the next step or correction shortly.';
      break;
    case 'technical':
      draftReply =
        'Thanks for the report. We are reviewing the app and account details now. If this is blocking access, please avoid repeated retries while we check the failure path.';
      break;
  }

  return {
    suggestedCategory,
    suggestedPriority,
    draftReply,
    hasUrgentLanguage,
  };
}

export async function runSupportTicketAutomation(input: {
  ticketId: string;
  userId: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
}) {
  try {
    const workflow = await getWorkflowRow('support_ticket_triage');
    if (!workflow || !workflow.is_enabled) return null;

    const config = {
      autoUpgradePriority: true,
      autoCategorizeGeneral: true,
      generateDraftReply: true,
      ...((workflow.config as Record<string, unknown> | null) ?? {}),
    };

    const insights = deriveSupportInsights(input.subject, input.description);
    const updates: { category?: string; priority?: string } = {};

    if (config.autoCategorizeGeneral && input.category === 'general' && insights.suggestedCategory !== 'general') {
      updates.category = insights.suggestedCategory;
    }
    if (
      config.autoUpgradePriority &&
      priorityRank(insights.suggestedPriority) > priorityRank(input.priority)
    ) {
      updates.priority = insights.suggestedPriority;
    }

    if (updates.category || updates.priority) {
      await sql`
        UPDATE support_tickets
        SET
          category = COALESCE(${updates.category ?? null}, category),
          priority = COALESCE(${updates.priority ?? null}, priority),
          updated_at = NOW()
        WHERE id = ${input.ticketId}
      `;
    }

    const summary = [
      `Suggested category: ${updates.category ?? input.category}.`,
      `Suggested priority: ${updates.priority ?? input.priority}.`,
      insights.hasUrgentLanguage ? 'Urgent symptom language detected.' : 'No emergency symptom language detected.',
    ].join(' ');

    const payload = {
      originalCategory: input.category,
      originalPriority: input.priority,
      suggestedCategory: updates.category ?? input.category,
      suggestedPriority: updates.priority ?? input.priority,
      draftReply: config.generateDraftReply ? insights.draftReply : null,
    };

    await insertAutomationLog({
      workflowId: workflow.id,
      workflowKey: workflow.workflow_key,
      entityType: 'support_ticket',
      entityId: input.ticketId,
      userId: input.userId,
      severity: insights.hasUrgentLanguage ? 'urgent' : (payload.suggestedPriority as WorkflowSeverity),
      title: 'AI triaged support ticket',
      summary,
      payload,
    });

    return payload;
  } catch (error) {
    console.error('[SUPPORT AUTOMATION ERROR]', error);
    return null;
  }
}

export async function runHealthReadingAutomation(input: {
  readingId: string | number;
  userId: string;
  deviceId: string;
  heartRate: number | null;
  spo2: number | null;
  temperature: number | null;
  systolicBP: number | null;
  diastolicBP: number | null;
  aiRiskScore: number | null;
}) {
  try {
    const workflow = await getWorkflowRow('health_reading_guardian');
    if (!workflow || !workflow.is_enabled) return null;

    const config = {
      criticalRiskThreshold: 0.75,
      highRiskThreshold: 0.5,
      logNormalReadings: false,
      ...((workflow.config as Record<string, unknown> | null) ?? {}),
    };

    const aiRiskScore = input.aiRiskScore ?? 0;
    const criticalThreshold = Number(config.criticalRiskThreshold ?? 0.75);
    const highThreshold = Number(config.highRiskThreshold ?? 0.5);

    let severity: WorkflowSeverity = 'normal';
    const triggers: string[] = [];

    if (input.spo2 != null && input.spo2 < 90) {
      severity = 'critical';
      triggers.push(`SpO2 dropped to ${input.spo2}%`);
    }
    if (input.heartRate != null && (input.heartRate > 120 || input.heartRate < 40)) {
      severity = severity === 'critical' ? 'critical' : 'high';
      triggers.push(`Heart rate moved to ${input.heartRate} bpm`);
    }
    if (input.systolicBP != null && input.systolicBP > 180) {
      severity = 'critical';
      triggers.push(`Systolic BP reached ${input.systolicBP} mmHg`);
    }
    if (aiRiskScore >= criticalThreshold) {
      severity = 'critical';
      triggers.push(`AI risk score rose to ${(aiRiskScore * 100).toFixed(1)}%`);
    } else if (aiRiskScore >= highThreshold && severity === 'normal') {
      severity = 'high';
      triggers.push(`AI risk score rose to ${(aiRiskScore * 100).toFixed(1)}%`);
    }
    if (input.temperature != null && (input.temperature > 38.5 || input.temperature < 35)) {
      severity = severity === 'critical' ? 'critical' : 'high';
      triggers.push(`Temperature measured ${input.temperature}°C`);
    }

    if (!triggers.length && !config.logNormalReadings) {
      return {
        severity,
        triggers: [],
      };
    }

    const summary =
      triggers.length > 0
        ? `Guardian reviewed this reading and flagged: ${triggers.join('; ')}.`
        : 'Guardian reviewed this reading and found it within the normal operating window.';

    const payload = {
      deviceId: input.deviceId,
      triggers,
      heartRate: input.heartRate,
      spo2: input.spo2,
      temperature: input.temperature,
      systolicBP: input.systolicBP,
      diastolicBP: input.diastolicBP,
      aiRiskScore: input.aiRiskScore,
    };

    await insertAutomationLog({
      workflowId: workflow.id,
      workflowKey: workflow.workflow_key,
      entityType: 'health_reading',
      entityId: String(input.readingId),
      userId: input.userId,
      severity,
      title: severity === 'normal' ? 'Guardian reviewed health reading' : 'Guardian flagged elevated health reading',
      summary,
      payload,
    });

    return {
      severity,
      triggers,
    };
  } catch (error) {
    console.error('[HEALTH AUTOMATION ERROR]', error);
    return null;
  }
}

export async function runAssistantUrgentTriage(input: {
  userId: string;
  userMessage: string;
  assistantReply: string;
  assistantSeverity: string;
}) {
  try {
    const workflow = await getWorkflowRow('assistant_urgent_triage');
    if (!workflow || !workflow.is_enabled) return null;

    const isUrgent = ['urgent', 'high', 'critical'].includes(input.assistantSeverity);
    if (!isUrgent) return null;

    const summary = `Assistant triage flagged a ${input.assistantSeverity} conversation and logged it for admin follow-up.`;
    const payload = {
      userMessage: input.userMessage,
      assistantReply: input.assistantReply,
      assistantSeverity: input.assistantSeverity,
    };

    await insertAutomationLog({
      workflowId: workflow.id,
      workflowKey: workflow.workflow_key,
      entityType: 'assistant_message',
      entityId: `assistant-${Date.now()}`,
      userId: input.userId,
      severity: input.assistantSeverity as WorkflowSeverity,
      title: 'Assistant escalated conversation',
      summary,
      payload,
    });

    return payload;
  } catch (error) {
    console.error('[ASSISTANT AUTOMATION ERROR]', error);
    return null;
  }
}

export async function getAutomationAdminSnapshot() {
  const ready = await ensureWorkflowRegistry();
  if (!ready) {
    return {
      workflows: [],
      logs: [],
      stats: {
        totalWorkflows: 0,
        activeWorkflows: 0,
        automationRuns24h: 0,
        urgentRuns24h: 0,
      },
      warning: 'Automation tables are missing. Run latest DB migration/setup.sql.',
    };
  }

  const workflows = await sql`
    SELECT *
    FROM ai_workflows
    ORDER BY module ASC, workflow_key ASC
  `;

  const logs = await sql`
    SELECT id, workflow_key, entity_type, entity_id, user_id, status, severity, title, summary, payload, created_at
    FROM automation_logs
    ORDER BY created_at DESC
    LIMIT 25
  `;

  const counts = await sql`
    SELECT
      COUNT(*)::int AS total_workflows,
      COUNT(*) FILTER (WHERE is_enabled = true)::int AS active_workflows
    FROM ai_workflows
  `;

  const recentCounts = await sql`
    SELECT
      COUNT(*)::int AS runs_24h,
      COUNT(*) FILTER (WHERE severity IN ('urgent', 'critical'))::int AS urgent_runs_24h
    FROM automation_logs
    WHERE created_at >= NOW() - INTERVAL '24 hours'
  `;

  return {
    workflows: (workflows as WorkflowRow[]).map(normalizeWorkflowRow),
    logs: (logs as any[]).map((row) => ({
      id: row.id,
      workflowKey: row.workflow_key,
      entityType: row.entity_type,
      entityId: row.entity_id,
      userId: row.user_id,
      status: row.status,
      severity: row.severity,
      title: row.title,
      summary: row.summary,
      payload: row.payload ?? {},
      createdAt: row.created_at,
    })) as AutomationLogView[],
    stats: {
      totalWorkflows: (counts[0] as any)?.total_workflows ?? 0,
      activeWorkflows: (counts[0] as any)?.active_workflows ?? 0,
      automationRuns24h: (recentCounts[0] as any)?.runs_24h ?? 0,
      urgentRuns24h: (recentCounts[0] as any)?.urgent_runs_24h ?? 0,
    },
  };
}

export async function updateWorkflowEnabledState(workflowKey: string, isEnabled: boolean) {
  const ready = await ensureWorkflowRegistry();
  if (!ready) {
    return null;
  }

  const updated = await sql`
    UPDATE ai_workflows
    SET is_enabled = ${isEnabled}, updated_at = NOW()
    WHERE workflow_key = ${workflowKey}
    RETURNING *
  `;

  const row = updated[0] as WorkflowRow | undefined;
  return row ? normalizeWorkflowRow(row) : null;
}

export async function updateWorkflowSettings(input: {
  workflowKey: string;
  isEnabled?: boolean;
  config?: Record<string, unknown>;
}) {
  const current = await getWorkflowRow(input.workflowKey);
  if (!current) {
    return null;
  }

  const nextEnabled = typeof input.isEnabled === 'boolean' ? input.isEnabled : current.is_enabled;
  const nextConfig = {
    ...((current.config as Record<string, unknown> | null) ?? {}),
    ...(input.config ?? {}),
  };

  const updated = await sql`
    UPDATE ai_workflows
    SET
      is_enabled = ${nextEnabled},
      config = ${JSON.stringify(nextConfig)}::jsonb,
      updated_at = NOW()
    WHERE workflow_key = ${input.workflowKey}
    RETURNING *
  `;

  const row = updated[0] as WorkflowRow | undefined;
  return row ? normalizeWorkflowRow(row) : null;
}

export async function createWorkflowDraft(input: {
  workflowKey: string;
  name: string;
  description: string;
  module: WorkflowModule;
  triggerEvent: string;
  automationType?: string;
  config?: Record<string, unknown>;
}) {
  const ready = await ensureWorkflowRegistry();
  if (!ready) {
    return null;
  }

  const inserted = await sql`
    INSERT INTO ai_workflows (
      workflow_key,
      name,
      description,
      module,
      trigger_event,
      automation_type,
      is_enabled,
      config,
      updated_at
    ) VALUES (
      ${input.workflowKey},
      ${input.name},
      ${input.description},
      ${input.module},
      ${input.triggerEvent},
      ${input.automationType ?? 'workflow_builder'},
      false,
      ${JSON.stringify(input.config ?? {})}::jsonb,
      NOW()
    )
    RETURNING *
  `;

  const row = inserted[0] as WorkflowRow | undefined;
  return row ? normalizeWorkflowRow(row) : null;
}

export async function getSupportTicketAutomationDraft(ticketId: string): Promise<SupportAutomationDraft | null> {
  const ready = await ensureWorkflowRegistry();
  if (!ready) return null;

  try {
    const rows = await sql`
      SELECT summary, severity, payload, created_at
      FROM automation_logs
      WHERE workflow_key = 'support_ticket_triage'
        AND entity_type = 'support_ticket'
        AND entity_id = ${ticketId}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const row = rows[0] as any;
    if (!row) return null;

    const payload = (row.payload ?? {}) as Record<string, unknown>;

    return {
      suggestedCategory: typeof payload.suggestedCategory === 'string' ? payload.suggestedCategory : null,
      suggestedPriority: typeof payload.suggestedPriority === 'string' ? payload.suggestedPriority : null,
      originalCategory: typeof payload.originalCategory === 'string' ? payload.originalCategory : null,
      originalPriority: typeof payload.originalPriority === 'string' ? payload.originalPriority : null,
      draftReply: typeof payload.draftReply === 'string' ? payload.draftReply : null,
      summary: row.summary,
      severity: row.severity,
      createdAt: row.created_at,
    };
  } catch (error) {
    if (!isMissingRelationError(error)) {
      console.error('[SUPPORT AUTOMATION DRAFT ERROR]', error);
    }
    return null;
  }
}
