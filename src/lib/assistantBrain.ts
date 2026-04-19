type AssistantSection = {
  label: string;
  content: string;
};

type AssistantAction = {
  type: 'open_dashboard' | 'open_care_center' | 'create_support_ticket' | 'summarize_readings';
  label: string;
  payload?: Record<string, unknown>;
};

export type AssistantBrainInput = {
  userMessage: string;
  userFirstName?: string | null;
  mode: string;
  severity: 'normal' | 'high' | 'urgent';
  summary: string;
  fallbackMessage: string;
  fallbackSections: AssistantSection[];
  fallbackNextSteps: string[];
  fallbackActions: AssistantAction[];
  contextDigest: string;
  trainingNotes?: string[];
};

export type AssistantBrainOutput = {
  message: string;
  summary: string;
  sections: AssistantSection[];
  nextSteps: string[];
  actions: AssistantAction[];
  confidence: number;
  confidenceReason: string;
  source: 'llm' | 'fallback';
  model: string | null;
  latencyMs: number;
  error?: string;
};

const DEFAULT_MODEL = process.env.ASSISTANT_LLM_MODEL || 'gpt-4o-mini';
const API_URL = process.env.ASSISTANT_LLM_API_URL || 'https://api.openai.com/v1/chat/completions';

function clampConfidence(value: unknown, fallback = 0.76): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, Number(n.toFixed(2))));
}

function sanitizeText(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : fallback;
}

function sanitizeSections(value: unknown, fallback: AssistantSection[]): AssistantSection[] {
  if (!Array.isArray(value)) return fallback;
  const sections = value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const label = sanitizeText((item as any).label, '');
      const content = sanitizeText((item as any).content, '');
      if (!label || !content) return null;
      return { label, content };
    })
    .filter((item): item is AssistantSection => !!item)
    .slice(0, 4);
  return sections.length ? sections : fallback;
}

function sanitizeSteps(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const steps = value
    .map((step) => sanitizeText(step, ''))
    .filter(Boolean)
    .slice(0, 4);
  return steps.length ? steps : fallback;
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function buildSystemPrompt() {
  return [
    'You are the VITAR cardiac care assistant.',
    'Rules:',
    '- Never diagnose disease.',
    '- Never prescribe medication.',
    '- If severe chest pain, fainting, severe breathing difficulty, or emergency language appears, prioritize emergency escalation guidance.',
    '- Keep language calm, concise, and supportive.',
    '- Return ONLY valid JSON with keys: message, summary, sections, nextSteps, confidence, confidenceReason.',
    '- sections must be array of objects: { "label": string, "content": string }.',
    '- nextSteps must be array of short strings.',
  ].join('\n');
}

function buildUserPrompt(input: AssistantBrainInput) {
  const name = input.userFirstName ? `User first name: ${input.userFirstName}` : 'User first name: unknown';
  const trainingBlock = Array.isArray(input.trainingNotes) && input.trainingNotes.length
    ? `Training guidance:\n${input.trainingNotes.map((note, index) => `${index + 1}. ${note}`).join('\n')}`
    : 'Training guidance: none';
  return [
    name,
    `Detected mode: ${input.mode}`,
    `Detected severity: ${input.severity}`,
    `Assistant fallback summary: ${input.summary}`,
    `Context digest: ${input.contextDigest}`,
    trainingBlock,
    `User message: ${input.userMessage}`,
    'Now write a safer, cleaner assistant response in JSON.',
  ].join('\n');
}

export async function generateAssistantBrainReply(input: AssistantBrainInput): Promise<AssistantBrainOutput> {
  const start = Date.now();
  const apiKey = process.env.OPENAI_API_KEY || process.env.ASSISTANT_LLM_API_KEY || '';
  const fallbackBase: AssistantBrainOutput = {
    message: input.fallbackMessage,
    summary: input.summary,
    sections: input.fallbackSections,
    nextSteps: input.fallbackNextSteps,
    actions: input.fallbackActions,
    confidence: 0.74,
    confidenceReason: 'Rule-based fallback response used for reliability.',
    source: 'fallback',
    model: null,
    latencyMs: Date.now() - start,
  };

  if (!apiKey) {
    return fallbackBase;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.2,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildUserPrompt(input) },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        ...fallbackBase,
        latencyMs: Date.now() - start,
        error: `LLM HTTP ${response.status}: ${body.slice(0, 240)}`,
      };
    }

    const json: any = await response.json();
    const rawContent =
      json?.choices?.[0]?.message?.content ||
      json?.output_text ||
      '';

    const parsed = typeof rawContent === 'string' ? extractJsonObject(rawContent) : null;
    if (!parsed) {
      return {
        ...fallbackBase,
        latencyMs: Date.now() - start,
        error: 'LLM response did not contain valid JSON.',
      };
    }

    return {
      message: sanitizeText(parsed.message, input.fallbackMessage),
      summary: sanitizeText(parsed.summary, input.summary),
      sections: sanitizeSections(parsed.sections, input.fallbackSections),
      nextSteps: sanitizeSteps(parsed.nextSteps, input.fallbackNextSteps),
      actions: input.fallbackActions,
      confidence: clampConfidence(parsed.confidence, 0.82),
      confidenceReason: sanitizeText(
        parsed.confidenceReason,
        'LLM response generated with deterministic safety post-processing.',
      ),
      source: 'llm',
      model: DEFAULT_MODEL,
      latencyMs: Date.now() - start,
    };
  } catch (error: any) {
    return {
      ...fallbackBase,
      latencyMs: Date.now() - start,
      error: error?.message || 'LLM request failed.',
    };
  } finally {
    clearTimeout(timeout);
  }
}
