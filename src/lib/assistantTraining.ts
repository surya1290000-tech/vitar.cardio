import { sql } from '@/lib/db';

export type AssistantTrainingMode =
  | 'all'
  | 'urgent_triage'
  | 'health_guidance'
  | 'device_support'
  | 'billing_support'
  | 'care_planning';

export type AssistantTrainingEntry = {
  id: string;
  title: string;
  mode: AssistantTrainingMode;
  priority: number;
  instructions: string;
  examples: string[];
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function listAssistantTrainingEntries(): Promise<AssistantTrainingEntry[]> {
  const rows = await sql`
    SELECT id, title, mode, priority, instructions, examples, is_enabled, created_at, updated_at
    FROM assistant_training_entries
    ORDER BY is_enabled DESC, priority DESC, updated_at DESC
  `;
  return rows.map((row: any) => ({
    id: row.id,
    title: row.title,
    mode: row.mode,
    priority: row.priority ?? 0,
    instructions: row.instructions,
    examples: Array.isArray(row.examples) ? row.examples : [],
    isEnabled: !!row.is_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createAssistantTrainingEntry(input: {
  title: string;
  mode: AssistantTrainingMode;
  priority?: number;
  instructions: string;
  examples?: string[];
  isEnabled?: boolean;
}): Promise<AssistantTrainingEntry | null> {
  const rows = await sql`
    INSERT INTO assistant_training_entries (title, mode, priority, instructions, examples, is_enabled)
    VALUES (
      ${input.title},
      ${input.mode},
      ${input.priority ?? 50},
      ${input.instructions},
      ${JSON.stringify(input.examples ?? [])}::jsonb,
      ${input.isEnabled ?? true}
    )
    RETURNING id, title, mode, priority, instructions, examples, is_enabled, created_at, updated_at
  `;
  const row = rows[0] as any;
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    mode: row.mode,
    priority: row.priority ?? 0,
    instructions: row.instructions,
    examples: Array.isArray(row.examples) ? row.examples : [],
    isEnabled: !!row.is_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updateAssistantTrainingEntry(input: {
  id: string;
  title?: string;
  mode?: AssistantTrainingMode;
  priority?: number;
  instructions?: string;
  examples?: string[];
  isEnabled?: boolean;
}): Promise<AssistantTrainingEntry | null> {
  const rows = await sql`
    UPDATE assistant_training_entries
    SET
      title = COALESCE(${input.title ?? null}, title),
      mode = COALESCE(${input.mode ?? null}, mode),
      priority = COALESCE(${input.priority ?? null}, priority),
      instructions = COALESCE(${input.instructions ?? null}, instructions),
      examples = COALESCE(${input.examples ? JSON.stringify(input.examples) : null}::jsonb, examples),
      is_enabled = COALESCE(${typeof input.isEnabled === 'boolean' ? input.isEnabled : null}, is_enabled),
      updated_at = NOW()
    WHERE id = ${input.id}
    RETURNING id, title, mode, priority, instructions, examples, is_enabled, created_at, updated_at
  `;
  const row = rows[0] as any;
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    mode: row.mode,
    priority: row.priority ?? 0,
    instructions: row.instructions,
    examples: Array.isArray(row.examples) ? row.examples : [],
    isEnabled: !!row.is_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function deleteAssistantTrainingEntry(id: string): Promise<boolean> {
  const rows = await sql`
    DELETE FROM assistant_training_entries
    WHERE id = ${id}
    RETURNING id
  `;
  return !!rows[0];
}

export async function loadTrainingNotesForMode(mode: string): Promise<string[]> {
  const rows = await sql`
    SELECT title, instructions, examples
    FROM assistant_training_entries
    WHERE is_enabled = true
      AND mode IN ('all', ${mode})
    ORDER BY priority DESC, updated_at DESC
    LIMIT 8
  `;

  return rows.map((row: any) => {
    const examples = Array.isArray(row.examples) && row.examples.length
      ? ` Examples: ${row.examples.slice(0, 2).join(' | ')}`
      : '';
    return `${row.title}: ${row.instructions}${examples}`;
  });
}

export function isMissingTrainingTableError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '42P01';
}

