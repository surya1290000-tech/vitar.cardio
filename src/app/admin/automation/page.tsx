'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';

type Workflow = {
  id: string;
  workflowKey: string;
  name: string;
  description: string;
  module: string;
  triggerEvent: string;
  automationType: string;
  isEnabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type AutomationLog = {
  id: string;
  workflowKey: string;
  entityType: string;
  entityId: string;
  userId: string | null;
  status: string;
  severity: string;
  title: string;
  summary: string;
  createdAt: string;
};

type Snapshot = {
  workflows: Workflow[];
  logs: AutomationLog[];
  runtimeTemplates: Array<{
    key: string;
    module: string;
    name: string;
    triggerEvent: string;
    description: string;
  }>;
  stats: {
    totalWorkflows: number;
    activeWorkflows: number;
    automationRuns24h: number;
    urgentRuns24h: number;
  };
  warning?: string;
};

type RuntimeTemplate = {
  key: string;
  module: string;
  name: string;
  triggerEvent: string;
  description: string;
};

type SimulationResult = {
  templateKey: string;
  templateName: string;
  summary: string;
  severity: string;
  result: Record<string, unknown>;
};

type BuilderNode = {
  id: string;
  title: string;
  detail: string;
};

type BuilderFlow = {
  trigger: BuilderNode;
  conditions: BuilderNode[];
  actions: BuilderNode[];
};

const moduleTint: Record<string, string> = {
  support: '#C0392B',
  health: '#2F80ED',
  assistant: '#27AE60',
};

function formatWorkflowKey(value: string) {
  return value.replace(/_/g, ' ');
}

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function getDefaultBuilderFlow(workflowKey: string, triggerEvent: string): BuilderFlow {
  switch (workflowKey) {
    case 'support_ticket_triage':
      return {
        trigger: {
          id: makeId('trigger'),
          title: 'New Support Ticket',
          detail: `Runs when ${triggerEvent} fires from care center.`,
        },
        conditions: [
          {
            id: makeId('condition'),
            title: 'Detect urgent language',
            detail: 'Look for critical medical, device-failure, or blocked-account language.',
          },
          {
            id: makeId('condition'),
            title: 'Classify ticket theme',
            detail: 'Sort into technical, medical, billing, device, or general.',
          },
        ],
        actions: [
          {
            id: makeId('action'),
            title: 'Upgrade priority',
            detail: 'Raise priority automatically when risk or blocker language is present.',
          },
          {
            id: makeId('action'),
            title: 'Draft support reply',
            detail: 'Prepare the first admin response for review inside support desk.',
          },
        ],
      };
    case 'health_reading_guardian':
      return {
        trigger: {
          id: makeId('trigger'),
          title: 'Incoming Health Reading',
          detail: `Runs whenever ${triggerEvent} is received from device ingestion.`,
        },
        conditions: [
          {
            id: makeId('condition'),
            title: 'Check vitals against thresholds',
            detail: 'Review heart rate, SpO2, temperature, and blood pressure ranges.',
          },
          {
            id: makeId('condition'),
            title: 'Check AI risk score',
            detail: 'Compare risk score to high and critical thresholds.',
          },
        ],
        actions: [
          {
            id: makeId('action'),
            title: 'Log escalation event',
            detail: 'Record elevated or critical readings for admin operations.',
          },
          {
            id: makeId('action'),
            title: 'Expose risk summary',
            detail: 'Make the trigger reasons visible in admin monitoring views.',
          },
        ],
      };
    case 'assistant_urgent_triage':
      return {
        trigger: {
          id: makeId('trigger'),
          title: 'Assistant Conversation Message',
          detail: `Runs when ${triggerEvent} fires after a user sends a care-center message.`,
        },
        conditions: [
          {
            id: makeId('condition'),
            title: 'Read symptom severity',
            detail: 'Evaluate user wording and assistant severity classification.',
          },
        ],
        actions: [
          {
            id: makeId('action'),
            title: 'Log urgent conversation',
            detail: 'Create an admin-visible record when triage is high, urgent, or critical.',
          },
        ],
      };
    default:
      return {
        trigger: {
          id: makeId('trigger'),
          title: 'Workflow Trigger',
          detail: `Runs when ${triggerEvent} occurs in the platform.`,
        },
        conditions: [
          {
            id: makeId('condition'),
            title: 'Evaluate rule set',
            detail: 'Inspect payload details and risk context.',
          },
        ],
        actions: [
          {
            id: makeId('action'),
            title: 'Execute automation',
            detail: 'Run the configured action and log the result.',
          },
        ],
      };
  }
}

function getSimulationPayloadTemplate(templateKey: string) {
  switch (templateKey) {
    case 'support_ticket_triage':
      return JSON.stringify(
        {
          subject: 'Device not syncing after chest pain alert',
          description: 'The wearable is offline and the user mentioned chest pain earlier today.',
          category: 'general',
          priority: 'normal',
        },
        null,
        2
      );
    case 'health_reading_guardian':
      return JSON.stringify(
        {
          heartRate: 132,
          spo2: 88,
          temperature: 38.7,
          systolicBP: 186,
          diastolicBP: 98,
          aiRiskScore: 0.81,
        },
        null,
        2
      );
    default:
      return JSON.stringify(
        {
          message: 'I have chest pain and feel short of breath right now.',
          assistantSeverity: 'urgent',
        },
        null,
        2
      );
  }
}

function normalizeBuilderFlow(workflow: Workflow | null): BuilderFlow | null {
  if (!workflow) return null;
  const configBuilder = workflow.config?.builder as Partial<BuilderFlow> | undefined;
  const fallback = getDefaultBuilderFlow(workflow.workflowKey, workflow.triggerEvent);

  return {
    trigger: {
      ...fallback.trigger,
      ...(configBuilder?.trigger ?? {}),
      id: configBuilder?.trigger?.id || fallback.trigger.id,
    },
    conditions:
      Array.isArray(configBuilder?.conditions) && configBuilder?.conditions.length > 0
        ? configBuilder.conditions.map((item, index) => ({
            id: item?.id || makeId(`condition-${index}`),
            title: item?.title || `Condition ${index + 1}`,
            detail: item?.detail || '',
          }))
        : fallback.conditions,
    actions:
      Array.isArray(configBuilder?.actions) && configBuilder?.actions.length > 0
        ? configBuilder.actions.map((item, index) => ({
            id: item?.id || makeId(`action-${index}`),
            title: item?.title || `Action ${index + 1}`,
            detail: item?.detail || '',
          }))
        : fallback.actions,
  };
}

function getWorkflowSteps(workflowKey: string) {
  switch (workflowKey) {
    case 'support_ticket_triage':
      return [
        { label: 'Trigger', detail: 'A new support ticket is created from care center.' },
        { label: 'Analysis', detail: 'The workflow classifies topic, urgency, and draft response.' },
        { label: 'Actions', detail: 'It can upgrade priority, suggest category, and prepare an admin reply.' },
      ];
    case 'health_reading_guardian':
      return [
        { label: 'Trigger', detail: 'A health reading arrives from a paired device feed.' },
        { label: 'Analysis', detail: 'Vitals and AI risk are compared to guardian thresholds.' },
        { label: 'Actions', detail: 'Elevated or critical events are logged for admin review.' },
      ];
    case 'assistant_urgent_triage':
      return [
        { label: 'Trigger', detail: 'A user message is sent to the assistant.' },
        { label: 'Analysis', detail: 'Urgent symptom language and reply severity are evaluated.' },
        { label: 'Actions', detail: 'High-risk conversations are recorded for follow-up in admin.' },
      ];
    default:
      return [
        { label: 'Trigger', detail: 'Workflow is triggered by an app event.' },
        { label: 'Analysis', detail: 'Rules review the payload and risk context.' },
        { label: 'Actions', detail: 'Configured actions run and the event is logged.' },
      ];
  }
}

function ConfigField({
  name,
  value,
  onChange,
}: {
  name: string;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const label = name.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());

  if (typeof value === 'boolean') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.9rem 1rem', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-strong)' }}>
        <div>
          <div style={{ color: 'var(--white)', fontSize: '0.88rem', fontWeight: 600 }}>{label}</div>
          <div style={{ color: 'var(--muted)', fontSize: '0.76rem', marginTop: '0.25rem' }}>Enable or disable this rule inside the workflow.</div>
        </div>
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      </label>
    );
  }

  return (
    <label style={{ display: 'grid', gap: '0.45rem' }}>
      <span style={{ color: 'var(--muted)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      <input
        value={String(value ?? '')}
        onChange={(e) => onChange(typeof value === 'number' ? Number(e.target.value) : e.target.value)}
        type={typeof value === 'number' ? 'number' : 'text'}
        step={typeof value === 'number' ? '0.01' : undefined}
        style={{
          width: '100%',
          background: 'var(--surface-strong)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          color: 'var(--white)',
          padding: '0.85rem 0.95rem',
          fontSize: '0.88rem',
        }}
      />
    </label>
  );
}

function BuilderNodeCard({
  node,
  accent,
  kind,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  node: BuilderNode;
  accent: string;
  kind: string;
  onChange: (next: BuilderNode) => void;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  return (
    <div
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
        border: `1px solid ${accent}2f`,
        borderRadius: 16,
        padding: '1rem',
        boxShadow: `0 18px 40px ${accent}10`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.8rem' }}>
        <div style={{ color: accent, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{kind}</div>
        <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap' }}>
          {onMoveUp && (
            <button
              type="button"
              onClick={onMoveUp}
              style={{
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent',
                color: 'var(--muted)',
                borderRadius: 999,
                padding: '.25rem .55rem',
                cursor: 'pointer',
                fontSize: '.72rem',
              }}
            >
              Up
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              onClick={onMoveDown}
              style={{
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent',
                color: 'var(--muted)',
                borderRadius: 999,
                padding: '.25rem .55rem',
                cursor: 'pointer',
                fontSize: '.72rem',
              }}
            >
              Down
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              style={{
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent',
                color: 'var(--muted)',
                borderRadius: 999,
                padding: '.25rem .55rem',
                cursor: 'pointer',
                fontSize: '.72rem',
              }}
            >
              Remove
            </button>
          )}
        </div>
      </div>
      <div style={{ display: 'grid', gap: '0.65rem' }}>
        <input
          value={node.title}
          onChange={(e) => onChange({ ...node, title: e.target.value })}
          placeholder={`${kind} title`}
          style={{
            width: '100%',
            background: 'var(--surface-strong)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            color: 'var(--white)',
            padding: '0.8rem 0.9rem',
            fontSize: '0.9rem',
            fontWeight: 600,
          }}
        />
        <textarea
          value={node.detail}
          onChange={(e) => onChange({ ...node, detail: e.target.value })}
          placeholder={`${kind} details`}
          rows={4}
          style={{
            width: '100%',
            resize: 'vertical',
            background: 'var(--surface-strong)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            color: 'var(--white)',
            padding: '0.85rem 0.9rem',
            fontSize: '0.84rem',
            lineHeight: 1.6,
          }}
        />
      </div>
    </div>
  );
}

function BuilderLane({
  title,
  accent,
  helper,
  nodes,
  kind,
  onAdd,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  title: string;
  accent: string;
  helper: string;
  nodes: BuilderNode[];
  kind: string;
  onAdd?: () => void;
  onUpdate: (index: number, node: BuilderNode) => void;
  onRemove?: (index: number) => void;
  onMoveUp?: (index: number) => void;
  onMoveDown?: (index: number) => void;
}) {
  return (
    <div
      style={{
        background: 'var(--graphite)',
        border: '1px solid var(--border)',
        borderRadius: 18,
        padding: '1.1rem',
        display: 'grid',
        gap: '0.9rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: accent, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.14em' }}>{title}</div>
          <div style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: '0.35rem', lineHeight: 1.5 }}>{helper}</div>
        </div>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            style={{
              border: `1px solid ${accent}30`,
              background: `${accent}16`,
              color: 'var(--white)',
              borderRadius: 999,
              padding: '.45rem .8rem',
              cursor: 'pointer',
              fontSize: '.76rem',
            }}
          >
            Add {kind}
          </button>
        )}
      </div>
      {nodes.map((node, index) => (
        <BuilderNodeCard
          key={node.id}
          node={node}
          accent={accent}
          kind={`${kind} ${index + 1}`}
          onChange={(next) => onUpdate(index, next)}
          onRemove={onRemove ? () => onRemove(index) : undefined}
          onMoveUp={onMoveUp && index > 0 ? () => onMoveUp(index) : undefined}
          onMoveDown={onMoveDown && index < nodes.length - 1 ? () => onMoveDown(index) : undefined}
        />
      ))}
    </div>
  );
}

export default function AdminAutomationPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [authed, setAuthed] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedModule, setSelectedModule] = useState<'all' | 'support' | 'health' | 'assistant'>('all');
  const [selectedWorkflowKey, setSelectedWorkflowKey] = useState<string | null>(null);
  const [draftConfig, setDraftConfig] = useState<Record<string, unknown>>({});
  const [builderFlow, setBuilderFlow] = useState<BuilderFlow | null>(null);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({
    workflowKey: '',
    name: '',
    description: '',
    module: 'support' as 'support' | 'health' | 'assistant',
    templateKey: 'support_ticket_triage',
    triggerEvent: '',
  });
  const [simulationTemplateKey, setSimulationTemplateKey] = useState('support_ticket_triage');
  const [simulationPayload, setSimulationPayload] = useState(getSimulationPayloadTemplate('support_ticket_triage'));
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);

  const loadSnapshot = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/automation/workflows', { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setAuthed(false);
          return;
        }
        throw new Error(json?.error || 'Failed to load automation workflows.');
      }

      setSnapshot(json);
      const workflows = Array.isArray(json?.workflows) ? json.workflows : [];
      if (!selectedWorkflowKey || !workflows.some((workflow: Workflow) => workflow.workflowKey === selectedWorkflowKey)) {
        setSelectedWorkflowKey(workflows[0]?.workflowKey ?? null);
      }
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Automation Load Failed',
        message: error?.message || 'Failed to load automation workflows.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/admin/auth/session', { credentials: 'include' });
        const json = await res.json();
        if (res.ok && json?.authenticated) {
          setAuthed(true);
          await loadSnapshot();
        }
      } catch {
        // manual login path
      } finally {
        setCheckingSession(false);
      }
    };
    void run();
  }, []);

  const workflows = useMemo(() => {
    const items = snapshot?.workflows ?? [];
    if (selectedModule === 'all') return items;
    return items.filter((workflow) => workflow.module === selectedModule);
  }, [selectedModule, snapshot?.workflows]);

  const selectedWorkflow = useMemo(
    () => (snapshot?.workflows ?? []).find((workflow) => workflow.workflowKey === selectedWorkflowKey) ?? null,
    [selectedWorkflowKey, snapshot?.workflows]
  );

  const selectedLogs = useMemo(
    () => (snapshot?.logs ?? []).filter((log) => !selectedWorkflowKey || log.workflowKey === selectedWorkflowKey),
    [selectedWorkflowKey, snapshot?.logs]
  );

  const availableTemplates = useMemo(
    () => (snapshot?.runtimeTemplates ?? []).filter((template) => template.module === newWorkflow.module),
    [newWorkflow.module, snapshot?.runtimeTemplates]
  );
  const runtimeTemplates = snapshot?.runtimeTemplates ?? [];

  useEffect(() => {
    if (availableTemplates.length === 0) return;

    const hasCurrentTemplate = availableTemplates.some((template) => template.key === newWorkflow.templateKey);
    const nextTemplate = hasCurrentTemplate ? availableTemplates.find((template) => template.key === newWorkflow.templateKey) : availableTemplates[0];
    if (!nextTemplate) return;

    setNewWorkflow((prev) => ({
      ...prev,
      templateKey: nextTemplate.key,
      triggerEvent: prev.triggerEvent || nextTemplate.triggerEvent,
    }));
  }, [availableTemplates, newWorkflow.templateKey]);

  useEffect(() => {
    if (!selectedWorkflow) {
      setDraftConfig({});
      setBuilderFlow(null);
      return;
    }

    const nextConfig = { ...selectedWorkflow.config };
    delete nextConfig.builder;
    setDraftConfig(nextConfig);
    setBuilderFlow(normalizeBuilderFlow(selectedWorkflow));
  }, [selectedWorkflow?.workflowKey]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAuthError(json?.error || 'Failed to sign in.');
        return;
      }
      setAuthed(true);
      setPassword('');
      await loadSnapshot();
      showToast({ type: 'success', title: 'Admin Signed In' });
    } catch {
      setAuthError('Network error while signing in.');
    } finally {
      setAuthLoading(false);
    }
  };

  const saveWorkflow = async () => {
    if (!selectedWorkflow || !builderFlow) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/automation/workflows', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          workflowKey: selectedWorkflow.workflowKey,
          isEnabled: selectedWorkflow.isEnabled,
          config: {
            ...draftConfig,
            builder: builderFlow,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to save workflow.');
      }
      setSnapshot((prev) =>
        prev
          ? {
              ...prev,
              workflows: prev.workflows.map((workflow) =>
                workflow.workflowKey === selectedWorkflow.workflowKey ? json.workflow : workflow
              ),
            }
          : prev
      );
      setDraftConfig(json.workflow.config ?? {});
      showToast({ type: 'success', title: 'Workflow Saved', message: json.workflow.name });
      await loadSnapshot();
    } catch (error: any) {
      showToast({ type: 'error', title: 'Save Failed', message: error?.message || 'Could not save workflow.' });
    } finally {
      setSaving(false);
    }
  };

  const updateCondition = (index: number, node: BuilderNode) =>
    setBuilderFlow((prev) =>
      prev ? { ...prev, conditions: prev.conditions.map((item, i) => (i === index ? node : item)) } : prev
    );

  const updateAction = (index: number, node: BuilderNode) =>
    setBuilderFlow((prev) =>
      prev ? { ...prev, actions: prev.actions.map((item, i) => (i === index ? node : item)) } : prev
    );

  const moveItem = (items: BuilderNode[], from: number, to: number) => {
    const next = [...items];
    const [picked] = next.splice(from, 1);
    next.splice(to, 0, picked);
    return next;
  };

  const moveCondition = (from: number, to: number) =>
    setBuilderFlow((prev) => (prev ? { ...prev, conditions: moveItem(prev.conditions, from, to) } : prev));

  const moveAction = (from: number, to: number) =>
    setBuilderFlow((prev) => (prev ? { ...prev, actions: moveItem(prev.actions, from, to) } : prev));

  const toggleWorkflow = async (workflow: Workflow) => {
    try {
      const res = await fetch('/api/admin/automation/workflows', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ workflowKey: workflow.workflowKey, isEnabled: !workflow.isEnabled }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to update workflow status.');
      }
      setSnapshot((prev) =>
        prev
          ? {
              ...prev,
              workflows: prev.workflows.map((item) =>
                item.workflowKey === workflow.workflowKey ? json.workflow : item
              ),
              stats: {
                ...prev.stats,
                activeWorkflows: prev.workflows.reduce((count, item) => {
                  const enabled = item.workflowKey === workflow.workflowKey ? json.workflow.isEnabled : item.isEnabled;
                  return count + (enabled ? 1 : 0);
                }, 0),
              },
            }
          : prev
      );
      showToast({
        type: 'success',
        title: json.workflow.isEnabled ? 'Workflow Enabled' : 'Workflow Disabled',
        message: json.workflow.name,
      });
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Update Failed',
        message: error?.message || 'Could not update workflow status.',
      });
    }
  };

  const handleCreateWorkflow = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const workflowKey = newWorkflow.workflowKey.trim().toLowerCase().replace(/\s+/g, '_');
      const selectedTemplate = availableTemplates.find((template) => template.key === newWorkflow.templateKey) ?? null;
      const payload = {
        ...newWorkflow,
        workflowKey,
        triggerEvent: newWorkflow.triggerEvent.trim() || selectedTemplate?.triggerEvent || '',
        templateKey: selectedTemplate?.key,
        config: {
          builder: getDefaultBuilderFlow(
            selectedTemplate?.key || workflowKey,
            newWorkflow.triggerEvent.trim() || selectedTemplate?.triggerEvent || ''
          ),
        },
      };

      const res = await fetch('/api/admin/automation/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to create workflow.');
      }

      setCreateOpen(false);
      setNewWorkflow({
        workflowKey: '',
        name: '',
        description: '',
        module: 'support',
        templateKey: 'support_ticket_triage',
        triggerEvent: '',
      });
      setSelectedWorkflowKey(json.workflow.workflowKey);
      showToast({ type: 'success', title: 'Workflow Created', message: json.workflow.name });
      await loadSnapshot();
    } catch (error: any) {
      showToast({ type: 'error', title: 'Create Failed', message: error?.message || 'Could not create workflow.' });
    } finally {
      setCreating(false);
    }
  };

  const runSimulation = async () => {
    setSimulationLoading(true);
    try {
      const payload = simulationPayload.trim() ? JSON.parse(simulationPayload) : {};
      const res = await fetch('/api/admin/automation/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          templateKey: simulationTemplateKey,
          payload,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to simulate workflow.');
      }
      setSimulationResult(json.result);
      showToast({ type: 'success', title: 'Simulation Complete', message: json.result.templateName });
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Simulation Failed',
        message: error?.message || 'Could not run workflow simulation.',
      });
    } finally {
      setSimulationLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--deep)', color: 'var(--white)' }}>
        Checking admin session...
      </div>
    );
  }

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--deep)', padding: '2rem' }}>
        <form
          onSubmit={handleLogin}
          style={{
            width: '100%',
            maxWidth: 420,
            background: 'var(--graphite)',
            border: '1px solid var(--border)',
            borderRadius: 18,
            padding: '2rem',
            color: 'var(--white)',
          }}
        >
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.8rem' }}>
            VITAR<span style={{ color: '#C0392B' }}>.</span>
          </div>
          <div style={{ color: 'var(--muted)', marginTop: '.5rem', marginBottom: '1.6rem' }}>Admin automation studio access</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter admin password"
            style={{
              width: '100%',
              background: 'var(--deep)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              color: 'var(--white)',
              padding: '0.9rem 1rem',
            }}
          />
          {authError && <div style={{ marginTop: '0.85rem', color: '#E74C3C', fontSize: '0.85rem' }}>{authError}</div>}
          <button
            type="submit"
            disabled={authLoading}
            style={{
              marginTop: '1rem',
              width: '100%',
              background: '#C0392B',
              border: 'none',
              borderRadius: 12,
              color: 'var(--white)',
              padding: '0.95rem 1rem',
              fontWeight: 700,
              cursor: authLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {authLoading ? 'Signing in...' : 'Open Automation Studio'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--deep)', color: 'var(--white)', padding: '2rem' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', display: 'grid', gap: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#C0392B', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: '0.45rem' }}>
              Workflow Studio
            </div>
            <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2.4rem', lineHeight: 1.05, margin: 0 }}>
              Automation control for support, health, and care operations.
            </h1>
            <p style={{ color: 'var(--muted)', maxWidth: 780, marginTop: '0.8rem', fontSize: '1rem', lineHeight: 1.7 }}>
              This is your internal workflow manager. Each automation has a trigger, rule set, live status, and execution trail so you can run VITAR operations more like a visual workflow system.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button onClick={() => setCreateOpen((prev) => !prev)} style={{ border: '1px solid rgba(47,128,237,0.28)', background: 'rgba(47,128,237,0.12)', color: '#D8E8FF', borderRadius: 10, padding: '.8rem 1rem', cursor: 'pointer' }}>
              {createOpen ? 'Close Builder Form' : 'Create Workflow'}
            </button>
            <button onClick={() => router.push('/admin')} style={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--white)', borderRadius: 10, padding: '.8rem 1rem', cursor: 'pointer' }}>
              Back to Admin
            </button>
            <button onClick={() => router.push('/admin/support')} style={{ border: '1px solid rgba(192,57,43,0.35)', background: 'rgba(192,57,43,0.12)', color: '#F2C2BC', borderRadius: 10, padding: '.8rem 1rem', cursor: 'pointer' }}>
              Open Support Desk
            </button>
            <button onClick={() => router.push('/admin/assistant-training')} style={{ border: '1px solid rgba(39,174,96,0.35)', background: 'rgba(39,174,96,0.12)', color: '#CFF3DF', borderRadius: 10, padding: '.8rem 1rem', cursor: 'pointer' }}>
              Assistant Training
            </button>
            <button onClick={() => void loadSnapshot()} style={{ border: 'none', background: '#C0392B', color: 'var(--white)', borderRadius: 10, padding: '.8rem 1rem', cursor: 'pointer' }}>
              Refresh Snapshot
            </button>
          </div>
        </div>

        {snapshot?.warning && (
          <div style={{ border: '1px solid rgba(243, 156, 18, 0.35)', background: 'rgba(243, 156, 18, 0.08)', color: '#F4C06B', borderRadius: 14, padding: '1rem 1.1rem' }}>
            {snapshot.warning}
          </div>
        )}

        {createOpen && (
          <form
            onSubmit={handleCreateWorkflow}
            style={{ background: 'var(--graphite)', border: '1px solid var(--border)', borderRadius: 18, padding: '1.25rem', display: 'grid', gap: '1rem' }}
          >
            <div>
              <div style={{ color: '#2F80ED', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>New workflow</div>
              <div style={{ color: 'var(--muted)', marginTop: '.35rem', lineHeight: 1.6 }}>
                Create a new workflow from a runtime template. It will start disabled so we can shape and test the flow safely before switching it on.
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
              <input
                value={newWorkflow.name}
                onChange={(e) => setNewWorkflow((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Workflow name"
                style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--white)', padding: '0.85rem 0.95rem' }}
              />
              <input
                value={newWorkflow.workflowKey}
                onChange={(e) => setNewWorkflow((prev) => ({ ...prev, workflowKey: e.target.value }))}
                placeholder="workflow_key"
                style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--white)', padding: '0.85rem 0.95rem' }}
              />
              <select
                value={newWorkflow.module}
                onChange={(e) => {
                  const module = e.target.value as 'support' | 'health' | 'assistant';
                  const moduleTemplates = (snapshot?.runtimeTemplates ?? []).filter((template) => template.module === module);
                  setNewWorkflow((prev) => ({
                    ...prev,
                    module,
                    templateKey: moduleTemplates[0]?.key ?? '',
                    triggerEvent: moduleTemplates[0]?.triggerEvent ?? '',
                  }));
                }}
                style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--white)', padding: '0.85rem 0.95rem' }}
              >
                <option value="support">Support</option>
                <option value="health">Health</option>
                <option value="assistant">Assistant</option>
              </select>
              <select
                value={newWorkflow.templateKey}
                onChange={(e) => {
                  const templateKey = e.target.value;
                  const template = availableTemplates.find((item) => item.key === templateKey);
                  setNewWorkflow((prev) => ({
                    ...prev,
                    templateKey,
                    triggerEvent: template?.triggerEvent ?? prev.triggerEvent,
                  }));
                }}
                style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--white)', padding: '0.85rem 0.95rem' }}
              >
                {availableTemplates.map((template) => (
                  <option key={template.key} value={template.key}>
                    {template.name}
                  </option>
                ))}
              </select>
              <input
                value={newWorkflow.triggerEvent}
                onChange={(e) => setNewWorkflow((prev) => ({ ...prev, triggerEvent: e.target.value }))}
                placeholder="trigger.event.name"
                style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--white)', padding: '0.85rem 0.95rem' }}
              />
            </div>
            {availableTemplates.length > 0 && (
              <div style={{ color: 'var(--muted)', fontSize: '.82rem', lineHeight: 1.6 }}>
                Runtime template: <span style={{ color: 'var(--white)' }}>{availableTemplates.find((template) => template.key === newWorkflow.templateKey)?.name}</span>
                {' '}· this workflow will run on the same event as the built-in template once you enable it.
              </div>
            )}
            <textarea
              value={newWorkflow.description}
              onChange={(e) => setNewWorkflow((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what this workflow should do."
              rows={4}
              style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--white)', padding: '0.95rem', resize: 'vertical', lineHeight: 1.6 }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" disabled={creating} style={{ border: 'none', background: '#C0392B', color: 'var(--white)', borderRadius: 10, padding: '.85rem 1rem', cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.7 : 1 }}>
                {creating ? 'Creating...' : 'Create Runtime Workflow'}
              </button>
            </div>
          </form>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {[
            ['Total workflows', String(snapshot?.stats.totalWorkflows ?? 0)],
            ['Active workflows', String(snapshot?.stats.activeWorkflows ?? 0)],
            ['Runs in 24h', String(snapshot?.stats.automationRuns24h ?? 0)],
            ['Urgent runs', String(snapshot?.stats.urgentRuns24h ?? 0)],
          ].map(([label, value]) => (
            <div key={label} style={{ background: 'var(--graphite)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.15rem 1.2rem' }}>
              <div style={{ color: 'var(--muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
              <div style={{ marginTop: '0.45rem', fontSize: '1.9rem', fontWeight: 700 }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--graphite)', border: '1px solid var(--border)', borderRadius: 18, padding: '1.25rem', display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: '#2F80ED', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Workflow Test Runner</div>
              <div style={{ color: 'var(--white)', fontSize: '1rem', marginTop: '.35rem' }}>
                Simulate support, health, and assistant workflows before testing them with real data.
              </div>
              <div style={{ color: 'var(--muted)', marginTop: '.45rem', lineHeight: 1.6 }}>
                This runner does not write live tickets or health readings. It shows the decision path we would take for a sample payload.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1rem', alignItems: 'start' }}>
            <div style={{ display: 'grid', gap: '.75rem' }}>
              <label style={{ display: 'grid', gap: '.45rem' }}>
                <span style={{ color: 'var(--muted)', fontSize: '.78rem', textTransform: 'uppercase', letterSpacing: '.08em' }}>Template</span>
                <select
                  value={simulationTemplateKey}
                  onChange={(e) => {
                    setSimulationTemplateKey(e.target.value);
                    setSimulationPayload(getSimulationPayloadTemplate(e.target.value));
                    setSimulationResult(null);
                  }}
                  style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--white)', padding: '.85rem .95rem' }}
                >
                  {runtimeTemplates.map((template: RuntimeTemplate) => (
                    <option key={template.key} value={template.key}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '.9rem', background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ color: 'var(--muted)', fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.08em' }}>Current trigger</div>
                <div style={{ color: 'var(--white)', marginTop: '.35rem' }}>
                  {runtimeTemplates.find((template) => template.key === simulationTemplateKey)?.triggerEvent}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void runSimulation()}
                disabled={simulationLoading}
                style={{ border: 'none', background: '#C0392B', color: 'var(--white)', borderRadius: 10, padding: '.9rem 1rem', cursor: simulationLoading ? 'not-allowed' : 'pointer', opacity: simulationLoading ? 0.7 : 1 }}
              >
                {simulationLoading ? 'Running Simulation...' : 'Run Simulation'}
              </button>
            </div>

            <div style={{ display: 'grid', gap: '.9rem' }}>
              <textarea
                value={simulationPayload}
                onChange={(e) => setSimulationPayload(e.target.value)}
                rows={11}
                style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--white)', padding: '1rem', resize: 'vertical', fontFamily: 'monospace', lineHeight: 1.6 }}
              />
              {simulationResult ? (
                <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: '1rem', background: 'rgba(255,255,255,0.03)', display: 'grid', gap: '.7rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.75rem', flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 700 }}>{simulationResult.templateName}</div>
                    <span style={{ fontSize: '0.68rem', padding: '.2rem .45rem', borderRadius: 999, background: ['urgent', 'critical'].includes(simulationResult.severity) ? 'rgba(192,57,43,0.14)' : 'rgba(39,174,96,0.14)', color: ['urgent', 'critical'].includes(simulationResult.severity) ? '#F0A39A' : '#8BE3B4', border: `1px solid ${['urgent', 'critical'].includes(simulationResult.severity) ? 'rgba(192,57,43,0.3)' : 'rgba(39,174,96,0.3)'}` }}>
                      {simulationResult.severity}
                    </span>
                  </div>
                  <div style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{simulationResult.summary}</div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'rgba(0,0,0,0.18)', borderRadius: 12, padding: '1rem', color: '#F4F4F4', fontSize: '.83rem', lineHeight: 1.6 }}>
                    {JSON.stringify(simulationResult.result, null, 2)}
                  </pre>
                </div>
              ) : (
                <div style={{ color: 'var(--muted)', fontSize: '.88rem' }}>
                  Run a simulation to see severity, suggested actions, and the exact structured output for the selected template.
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '340px minmax(0, 1fr)', gap: '1.25rem', alignItems: 'start' }}>
          <div style={{ background: 'var(--graphite)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden' }}>
            <div style={{ padding: '1.1rem 1.15rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ color: 'var(--muted)', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Modules</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.8rem' }}>
                {(['all', 'support', 'health', 'assistant'] as const).map((module) => (
                  <button
                    key={module}
                    onClick={() => setSelectedModule(module)}
                    style={{
                      border: selectedModule === module ? '1px solid rgba(192,57,43,0.4)' : '1px solid var(--border)',
                      background: selectedModule === module ? 'rgba(192,57,43,0.12)' : 'transparent',
                      color: selectedModule === module ? '#F6D0CB' : 'var(--muted)',
                      borderRadius: 999,
                      padding: '.5rem .8rem',
                      fontSize: '.78rem',
                      textTransform: 'capitalize',
                      cursor: 'pointer',
                    }}
                  >
                    {module}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid' }}>
              {workflows.map((workflow) => {
                const selected = workflow.workflowKey === selectedWorkflowKey;
                const tint = moduleTint[workflow.module] ?? '#C0392B';
                return (
                  <button
                    key={workflow.id}
                    onClick={() => setSelectedWorkflowKey(workflow.workflowKey)}
                    style={{
                      textAlign: 'left',
                      background: selected ? 'rgba(255,255,255,0.04)' : 'transparent',
                      border: 'none',
                      borderLeft: selected ? `3px solid ${tint}` : '3px solid transparent',
                      padding: '1rem 1.1rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--white)', fontSize: '0.92rem' }}>{workflow.name}</div>
                      <span style={{ fontSize: '0.68rem', borderRadius: 999, padding: '.2rem .5rem', background: workflow.isEnabled ? 'rgba(39,174,96,0.15)' : 'rgba(255,255,255,0.06)', color: workflow.isEnabled ? '#7ED9A8' : 'var(--muted)', border: `1px solid ${workflow.isEnabled ? 'rgba(39,174,96,0.28)' : 'var(--border)'}` }}>
                        {workflow.isEnabled ? 'Live' : 'Off'}
                      </span>
                    </div>
                    <div style={{ marginTop: '.35rem', color: 'var(--muted)', fontSize: '0.8rem', lineHeight: 1.55 }}>{workflow.description}</div>
                    <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '.7rem' }}>
                      <span style={{ fontSize: '0.68rem', padding: '.2rem .45rem', borderRadius: 999, background: `${tint}14`, color: tint, border: `1px solid ${tint}33` }}>
                        {workflow.module}
                      </span>
                      <span style={{ fontSize: '0.68rem', padding: '.2rem .45rem', borderRadius: 999, background: 'rgba(255,255,255,0.05)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                        {formatWorkflowKey(workflow.workflowKey)}
                      </span>
                    </div>
                  </button>
                );
              })}
              {!loading && workflows.length === 0 && (
                <div style={{ padding: '1.2rem', color: 'var(--muted)' }}>No workflows in this module yet.</div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gap: '1.25rem' }}>
            {selectedWorkflow && builderFlow ? (
              <>
                <div style={{ background: 'var(--graphite)', border: '1px solid var(--border)', borderRadius: 18, padding: '1.35rem' }}>
                  <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ color: moduleTint[selectedWorkflow.module] ?? '#C0392B', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                        {selectedWorkflow.module} workflow
                      </div>
                      <h2 style={{ margin: '.45rem 0 0', fontSize: '1.7rem', fontFamily: "'DM Serif Display', serif" }}>
                        {selectedWorkflow.name}
                      </h2>
                      <p style={{ color: 'var(--muted)', maxWidth: 760, lineHeight: 1.7 }}>{selectedWorkflow.description}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '.7rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => void toggleWorkflow(selectedWorkflow)}
                        style={{
                          border: selectedWorkflow.isEnabled ? '1px solid rgba(46, 204, 113, 0.35)' : '1px solid rgba(192,57,43,0.35)',
                          background: selectedWorkflow.isEnabled ? 'rgba(46, 204, 113, 0.12)' : 'rgba(192,57,43,0.12)',
                          color: 'var(--white)',
                          borderRadius: 12,
                          padding: '.85rem 1rem',
                          cursor: 'pointer',
                          minWidth: 170,
                        }}
                      >
                        {selectedWorkflow.isEnabled ? 'Disable Workflow' : 'Enable Workflow'}
                      </button>
                      <button
                        onClick={() => void saveWorkflow()}
                        disabled={saving}
                        style={{
                          border: 'none',
                          background: '#C0392B',
                          color: 'var(--white)',
                          borderRadius: 12,
                          padding: '.85rem 1rem',
                          cursor: saving ? 'not-allowed' : 'pointer',
                          opacity: saving ? 0.7 : 1,
                        }}
                      >
                        {saving ? 'Saving...' : 'Save Workflow'}
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))', border: '1px solid var(--border)', borderRadius: 20, padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ color: 'var(--muted)', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Visual Builder</div>
                      <div style={{ color: 'var(--white)', fontSize: '1rem', marginTop: '.35rem' }}>
                        Trigger: <span style={{ color: '#F5D1CC' }}>{selectedWorkflow.triggerEvent}</span>
                      </div>
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: '.82rem' }}>
                      Edit this flow like an internal n8n-style pipeline for VITAR.
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 1.2fr 70px 1.2fr', gap: '0.9rem', alignItems: 'stretch' }}>
                    <BuilderLane
                      title="Trigger"
                      accent={moduleTint[selectedWorkflow.module] ?? '#C0392B'}
                      helper="What starts the workflow."
                      nodes={[builderFlow.trigger]}
                      kind="Trigger"
                      onUpdate={(_, node) => setBuilderFlow((prev) => (prev ? { ...prev, trigger: node } : prev))}
                    />
                    <div style={{ display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: '1.4rem' }}>→</div>
                    <BuilderLane
                      title="Conditions"
                      accent="#D4A94D"
                      helper="Checks that decide whether the workflow should escalate or branch."
                      nodes={builderFlow.conditions}
                      kind="Condition"
                      onAdd={() =>
                        setBuilderFlow((prev) =>
                          prev
                            ? {
                                ...prev,
                                conditions: [
                                  ...prev.conditions,
                                  { id: makeId('condition'), title: `Condition ${prev.conditions.length + 1}`, detail: '' },
                                ],
                              }
                            : prev
                        )
                      }
                      onUpdate={updateCondition}
                      onMoveUp={(index) => moveCondition(index, index - 1)}
                      onMoveDown={(index) => moveCondition(index, index + 1)}
                      onRemove={(index) =>
                        setBuilderFlow((prev) =>
                          prev ? { ...prev, conditions: prev.conditions.filter((_, itemIndex) => itemIndex !== index) } : prev
                        )
                      }
                    />
                    <div style={{ display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: '1.4rem' }}>→</div>
                    <BuilderLane
                      title="Actions"
                      accent="#27AE60"
                      helper="What the workflow should do when conditions are met."
                      nodes={builderFlow.actions}
                      kind="Action"
                      onAdd={() =>
                        setBuilderFlow((prev) =>
                          prev
                            ? {
                                ...prev,
                                actions: [
                                  ...prev.actions,
                                  { id: makeId('action'), title: `Action ${prev.actions.length + 1}`, detail: '' },
                                ],
                              }
                            : prev
                        )
                      }
                      onUpdate={updateAction}
                      onMoveUp={(index) => moveAction(index, index - 1)}
                      onMoveDown={(index) => moveAction(index, index + 1)}
                      onRemove={(index) =>
                        setBuilderFlow((prev) =>
                          prev ? { ...prev, actions: prev.actions.filter((_, itemIndex) => itemIndex !== index) } : prev
                        )
                      }
                    />
                  </div>
                </div>

                <div style={{ background: 'var(--graphite)', border: '1px solid var(--border)', borderRadius: 18, padding: '1.35rem' }}>
                  <div style={{ color: 'var(--muted)', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>
                    Workflow Controls
                  </div>
                  <div style={{ display: 'grid', gap: '0.85rem', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                    {Object.entries(draftConfig).map(([name, value]) => (
                      <ConfigField
                        key={name}
                        name={name}
                        value={value}
                        onChange={(next) => setDraftConfig((prev) => ({ ...prev, [name]: next }))}
                      />
                    ))}
                    {Object.keys(draftConfig).length === 0 && (
                      <div style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
                        This workflow does not have extra controls yet. The visual trigger, conditions, and actions above are still saved as part of the builder.
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ background: 'var(--graphite)', border: '1px solid var(--border)', borderRadius: 18, padding: '2rem', color: 'var(--muted)' }}>
                Select a workflow to inspect and edit it.
              </div>
            )}

            <div style={{ background: 'var(--graphite)', border: '1px solid var(--border)', borderRadius: 18, padding: '1.35rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Execution Feed
                  </div>
                  <div style={{ color: 'var(--white)', fontSize: '1rem', marginTop: '.35rem' }}>
                    {selectedWorkflow ? `Recent runs for ${selectedWorkflow.name}` : 'Recent automation activity across the platform'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '0.8rem' }}>
                {selectedLogs.slice(0, 12).map((log) => (
                  <div key={log.id} style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: 14, padding: '0.95rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem', flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 700 }}>{log.title}</div>
                      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.68rem', padding: '.2rem .45rem', borderRadius: 999, background: 'rgba(255,255,255,0.05)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                          {formatWorkflowKey(log.workflowKey)}
                        </span>
                        <span style={{ fontSize: '0.68rem', padding: '.2rem .45rem', borderRadius: 999, background: ['urgent', 'critical'].includes(log.severity) ? 'rgba(192,57,43,0.14)' : 'rgba(39,174,96,0.14)', color: ['urgent', 'critical'].includes(log.severity) ? '#F0A39A' : '#8BE3B4', border: `1px solid ${['urgent', 'critical'].includes(log.severity) ? 'rgba(192,57,43,0.3)' : 'rgba(39,174,96,0.3)'}` }}>
                          {log.severity}
                        </span>
                      </div>
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: '0.88rem', lineHeight: 1.6, marginTop: '.45rem' }}>{log.summary}</div>
                    <div style={{ color: 'var(--muted)', fontSize: '0.74rem', marginTop: '.6rem' }}>
                      {log.entityType} · {log.entityId} · {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
                {!loading && selectedLogs.length === 0 && (
                  <div style={{ color: 'var(--muted)' }}>No automation events for this workflow yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
