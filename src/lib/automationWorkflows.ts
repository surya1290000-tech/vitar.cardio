import { sql } from '@/lib/db';

type WorkflowModule = 'support' | 'health' | 'assistant';
type WorkflowSeverity = 'normal' | 'high' | 'urgent' | 'critical';
type RuntimeTemplateKey = 'support_ticket_triage' | 'health_reading_guardian' | 'assistant_urgent_triage';

interface WorkflowDefinition {
  key: RuntimeTemplateKey;
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

interface RunnableWorkflow {
  id: string;
  workflowKey: string;
  name: string;
  description: string;
  module: WorkflowModule;
  triggerEvent: string;
  automationType: string;
  isEnabled: boolean;
  runtimeTemplate: RuntimeTemplateKey;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
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

export interface WorkflowSimulationResult {
  templateKey: RuntimeTemplateKey;
  templateName: string;
  summary: string;
  severity: WorkflowSeverity | 'normal';
  result: Record<string, unknown>;
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

const RUNTIME_TEMPLATE_KEYS = WORKFLOW_DEFINITIONS.map((workflow) => workflow.key) as RuntimeTemplateKey[];

function isMissingRelationError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '42P01';
}

function isRuntimeTemplateKey(value: unknown): value is RuntimeTemplateKey {
  return typeof value === 'string' && RUNTIME_TEMPLATE_KEYS.includes(value as RuntimeTemplateKey);
}

function getRuntimeTemplateKey(row: { workflow_key: string; config?: Record<string, unknown> | null }): RuntimeTemplateKey | null {
  if (isRuntimeTemplateKey(row.workflow_key)) {
    return row.workflow_key;
  }

  const runtimeTemplate = row.config && typeof row.config === 'object' ? row.config.runtimeTemplate : null;
  return isRuntimeTemplateKey(runtimeTemplate) ? runtimeTemplate : null;
}

function getWorkflowDefinition(key: RuntimeTemplateKey | null) {
  return key ? WORKFLOW_DEFINITIONS.find((item) => item.key === key) ?? null : null;
}

function normalizeWorkflowRow(row: WorkflowRow): AutomationWorkflowView {
  const runtimeTemplate = getRuntimeTemplateKey(row);
  const definition = getWorkflowDefinition(runtimeTemplate);

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

function normalizeRunnableWorkflow(row: WorkflowRow): RunnableWorkflow | null {
  const runtimeTemplate = getRuntimeTemplateKey(row);
  const definition = getWorkflowDefinition(runtimeTemplate);
  if (!runtimeTemplate || !definition) return null;

  return {
    id: row.id,
    workflowKey: row.workflow_key,
    name: row.name,
    description: row.description,
    module: row.module,
    triggerEvent: row.trigger_event,
    automationType: row.automation_type,
    isEnabled: row.is_enabled,
    runtimeTemplate,
    config: {
      ...definition.defaultConfig,
      ...((row.config as Record<string, unknown> | null) ?? {}),
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getRuntimeTemplateOptions() {
  return WORKFLOW_DEFINITIONS.map((workflow) => ({
    key: workflow.key,
    module: workflow.module,
    name: workflow.name,
    triggerEvent: workflow.triggerEvent,
    description: workflow.description,
  }));
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

async function getRunnableWorkflows(triggerEvent: string, runtimeTemplate: RuntimeTemplateKey): Promise<RunnableWorkflow[]> {
  const ready = await ensureWorkflowRegistry();
  if (!ready) return [];

  const rows = await sql`
    SELECT *
    FROM ai_workflows
    WHERE trigger_event = ${triggerEvent}
      AND is_enabled = true
      AND (
        workflow_key = ${runtimeTemplate}
        OR config->>'runtimeTemplate' = ${runtimeTemplate}
      )
    ORDER BY
      CASE WHEN workflow_key = ${runtimeTemplate} THEN 0 ELSE 1 END ASC,
      created_at ASC
  `;

  return (rows as WorkflowRow[])
    .map((row) => normalizeRunnableWorkflow(row))
    .filter((row): row is RunnableWorkflow => !!row);
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

function evaluateHealthReading(input: {
  heartRate: number | null;
  spo2: number | null;
  temperature: number | null;
  systolicBP: number | null;
  diastolicBP: number | null;
  aiRiskScore: number | null;
  criticalThreshold: number;
  highThreshold: number;
}) {
  const aiRiskScore = input.aiRiskScore ?? 0;
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
  if (aiRiskScore >= input.criticalThreshold) {
    severity = 'critical';
    triggers.push(`AI risk score rose to ${(aiRiskScore * 100).toFixed(1)}%`);
  } else if (aiRiskScore >= input.highThreshold && severity === 'normal') {
    severity = 'high';
    triggers.push(`AI risk score rose to ${(aiRiskScore * 100).toFixed(1)}%`);
  }
  if (input.temperature != null && (input.temperature > 38.5 || input.temperature < 35)) {
    severity = severity === 'critical' ? 'critical' : 'high';
    triggers.push(`Temperature measured ${input.temperature}C`);
  }

  return { severity, triggers };
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
    const workflows = await getRunnableWorkflows('support.ticket.created', 'support_ticket_triage');
    if (workflows.length === 0) return null;

    const insights = deriveSupportInsights(input.subject, input.description);
    let currentCategory = input.category;
    let currentPriority = input.priority;
    const runs: Array<Record<string, unknown>> = [];

    for (const workflow of workflows) {
      const config = {
        autoUpgradePriority: true,
        autoCategorizeGeneral: true,
        generateDraftReply: true,
        ...(workflow.config ?? {}),
      };

      const updates: { category?: string; priority?: string } = {};

      if (config.autoCategorizeGeneral && currentCategory === 'general' && insights.suggestedCategory !== 'general') {
        updates.category = insights.suggestedCategory;
      }
      if (config.autoUpgradePriority && priorityRank(insights.suggestedPriority) > priorityRank(currentPriority)) {
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
        currentCategory = updates.category ?? currentCategory;
        currentPriority = updates.priority ?? currentPriority;
      }

      const summary = [
        `Workflow ${workflow.name} suggested category: ${currentCategory}.`,
        `Workflow ${workflow.name} suggested priority: ${currentPriority}.`,
        insights.hasUrgentLanguage ? 'Urgent symptom language detected.' : 'No emergency symptom language detected.',
      ].join(' ');

      const payload = {
        runtimeTemplate: workflow.runtimeTemplate,
        originalCategory: input.category,
        originalPriority: input.priority,
        suggestedCategory: currentCategory,
        suggestedPriority: currentPriority,
        draftReply: config.generateDraftReply ? insights.draftReply : null,
      };

      await insertAutomationLog({
        workflowId: workflow.id,
        workflowKey: workflow.workflowKey,
        entityType: 'support_ticket',
        entityId: input.ticketId,
        userId: input.userId,
        severity: insights.hasUrgentLanguage ? 'urgent' : (currentPriority as WorkflowSeverity),
        title: `${workflow.name} triaged support ticket`,
        summary,
        payload,
      });

      runs.push({
        workflowKey: workflow.workflowKey,
        name: workflow.name,
        suggestedCategory: currentCategory,
        suggestedPriority: currentPriority,
        draftReply: config.generateDraftReply ? insights.draftReply : null,
      });
    }

    return {
      finalCategory: currentCategory,
      finalPriority: currentPriority,
      runs,
    };
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
    const workflows = await getRunnableWorkflows('health.reading.recorded', 'health_reading_guardian');
    if (workflows.length === 0) return null;

    const runs: Array<Record<string, unknown>> = [];
    let highestSeverity: WorkflowSeverity = 'normal';
    let combinedTriggers: string[] = [];

    for (const workflow of workflows) {
      const config = {
        criticalRiskThreshold: 0.75,
        highRiskThreshold: 0.5,
        logNormalReadings: false,
        ...(workflow.config ?? {}),
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
        triggers.push(`Temperature measured ${input.temperature}C`);
      }

      if (!triggers.length && !config.logNormalReadings) {
        runs.push({
          workflowKey: workflow.workflowKey,
          name: workflow.name,
          severity,
          triggers: [],
        });
        continue;
      }

      const summary =
        triggers.length > 0
          ? `${workflow.name} reviewed this reading and flagged: ${triggers.join('; ')}.`
          : `${workflow.name} reviewed this reading and found it within the normal operating window.`;

      const payload = {
        runtimeTemplate: workflow.runtimeTemplate,
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
        workflowKey: workflow.workflowKey,
        entityType: 'health_reading',
        entityId: String(input.readingId),
        userId: input.userId,
        severity,
        title:
          severity === 'normal'
            ? `${workflow.name} reviewed health reading`
            : `${workflow.name} flagged elevated health reading`,
        summary,
        payload,
      });

      if (severity === 'critical' || (severity === 'high' && highestSeverity === 'normal')) {
        highestSeverity = severity;
      }
      combinedTriggers = [...combinedTriggers, ...triggers];
      runs.push({
        workflowKey: workflow.workflowKey,
        name: workflow.name,
        severity,
        triggers,
      });
    }

    return {
      severity: highestSeverity,
      triggers: Array.from(new Set(combinedTriggers)),
      runs,
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
  assistantMode?: string;
  escalationSummary?: string;
  nextSteps?: string[];
}) {
  try {
    const workflows = await getRunnableWorkflows('assistant.message.created', 'assistant_urgent_triage');
    if (workflows.length === 0) return null;

    const isUrgent = ['urgent', 'high', 'critical'].includes(input.assistantSeverity);
    if (!isUrgent) return null;

    const runs: Array<Record<string, unknown>> = [];

    for (const workflow of workflows) {
      const summary = input.escalationSummary
        ? `${workflow.name} flagged a ${input.assistantSeverity} conversation. ${input.escalationSummary}`
        : `${workflow.name} flagged a ${input.assistantSeverity} conversation and logged it for admin follow-up.`;
      const payload = {
        runtimeTemplate: workflow.runtimeTemplate,
        userMessage: input.userMessage,
        assistantReply: input.assistantReply,
        assistantSeverity: input.assistantSeverity,
        assistantMode: input.assistantMode ?? 'assistant_urgent_triage',
        escalationSummary: input.escalationSummary ?? null,
        nextSteps: input.nextSteps ?? [],
      };

      await insertAutomationLog({
        workflowId: workflow.id,
        workflowKey: workflow.workflowKey,
        entityType: 'assistant_message',
        entityId: `assistant-${Date.now()}-${workflow.workflowKey}`,
        userId: input.userId,
        severity: input.assistantSeverity as WorkflowSeverity,
        title: `${workflow.name} escalated conversation`,
        summary,
        payload,
      });

      runs.push({
        workflowKey: workflow.workflowKey,
        name: workflow.name,
        severity: input.assistantSeverity,
      });
    }

    return {
      severity: input.assistantSeverity,
      runs,
    };
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

export async function simulateWorkflowTemplate(input: {
  templateKey: RuntimeTemplateKey;
  payload: Record<string, unknown>;
}): Promise<WorkflowSimulationResult> {
  const definition = getWorkflowDefinition(input.templateKey);
  if (!definition) {
    throw new Error('Unknown workflow template.');
  }

  if (input.templateKey === 'support_ticket_triage') {
    const subject = typeof input.payload.subject === 'string' ? input.payload.subject : 'Test support ticket';
    const description =
      typeof input.payload.description === 'string'
        ? input.payload.description
        : 'The device is not working and the user needs help.';
    const category = typeof input.payload.category === 'string' ? input.payload.category : 'general';
    const priority = typeof input.payload.priority === 'string' ? input.payload.priority : 'normal';
    const insights = deriveSupportInsights(subject, description);
    const nextCategory = category === 'general' && insights.suggestedCategory !== 'general' ? insights.suggestedCategory : category;
    const nextPriority =
      priorityRank(insights.suggestedPriority) > priorityRank(priority) ? insights.suggestedPriority : priority;

    return {
      templateKey: input.templateKey,
      templateName: definition.name,
      summary: `Support triage would classify this ticket as ${nextCategory} and ${nextPriority} priority.`,
      severity: insights.hasUrgentLanguage ? 'urgent' : (nextPriority as WorkflowSeverity),
      result: {
        originalCategory: category,
        originalPriority: priority,
        suggestedCategory: nextCategory,
        suggestedPriority: nextPriority,
        draftReply: insights.draftReply,
        urgentLanguageDetected: insights.hasUrgentLanguage,
      },
    };
  }

  if (input.templateKey === 'health_reading_guardian') {
    const evaluation = evaluateHealthReading({
      heartRate: typeof input.payload.heartRate === 'number' ? input.payload.heartRate : null,
      spo2: typeof input.payload.spo2 === 'number' ? input.payload.spo2 : null,
      temperature: typeof input.payload.temperature === 'number' ? input.payload.temperature : null,
      systolicBP: typeof input.payload.systolicBP === 'number' ? input.payload.systolicBP : null,
      diastolicBP: typeof input.payload.diastolicBP === 'number' ? input.payload.diastolicBP : null,
      aiRiskScore: typeof input.payload.aiRiskScore === 'number' ? input.payload.aiRiskScore : null,
      criticalThreshold: Number(input.payload.criticalRiskThreshold ?? 0.75),
      highThreshold: Number(input.payload.highRiskThreshold ?? 0.5),
    });

    return {
      templateKey: input.templateKey,
      templateName: definition.name,
      summary:
        evaluation.triggers.length > 0
          ? `Health guardian would flag this reading with ${evaluation.severity} severity.`
          : 'Health guardian would treat this reading as normal.',
      severity: evaluation.severity,
      result: {
        triggers: evaluation.triggers,
        severity: evaluation.severity,
      },
    };
  }

  const assistantSeverity =
    typeof input.payload.assistantSeverity === 'string'
      ? input.payload.assistantSeverity
      : typeof input.payload.message === 'string' &&
          /(chest pain|fainted|unconscious|can't breathe|cant breathe|shortness of breath)/i.test(input.payload.message)
        ? 'urgent'
        : 'normal';
  const urgent = ['urgent', 'high', 'critical'].includes(assistantSeverity);

  return {
    templateKey: input.templateKey,
    templateName: definition.name,
    summary: urgent
      ? `Assistant urgent triage would escalate this conversation as ${assistantSeverity}.`
      : 'Assistant urgent triage would keep this conversation as normal.',
    severity: urgent ? (assistantSeverity as WorkflowSeverity) : 'normal',
    result: {
      assistantSeverity,
      wouldEscalate: urgent,
      userMessage: typeof input.payload.message === 'string' ? input.payload.message : null,
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
  templateKey?: RuntimeTemplateKey | null;
  config?: Record<string, unknown>;
}) {
  const ready = await ensureWorkflowRegistry();
  if (!ready) {
    return null;
  }

  const nextConfig = {
    ...(input.config ?? {}),
    ...(input.templateKey ? { runtimeTemplate: input.templateKey } : {}),
  };

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
      ${input.automationType ?? (input.templateKey ? 'workflow_template' : 'workflow_builder')},
      false,
      ${JSON.stringify(nextConfig)}::jsonb,
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
      WHERE entity_type = 'support_ticket'
        AND entity_id = ${ticketId}
        AND payload ? 'draftReply'
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
