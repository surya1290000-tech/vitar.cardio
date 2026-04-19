'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';

type TrainingMode =
  | 'all'
  | 'urgent_triage'
  | 'health_guidance'
  | 'device_support'
  | 'billing_support'
  | 'care_planning';

type TrainingEntry = {
  id: string;
  title: string;
  mode: TrainingMode;
  priority: number;
  instructions: string;
  examples: string[];
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

const modeOptions: Array<{ value: TrainingMode; label: string }> = [
  { value: 'all', label: 'All modes' },
  { value: 'urgent_triage', label: 'Urgent triage' },
  { value: 'health_guidance', label: 'Health guidance' },
  { value: 'device_support', label: 'Device support' },
  { value: 'billing_support', label: 'Billing support' },
  { value: 'care_planning', label: 'Care planning' },
];

export default function AdminAssistantTrainingPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [checkingSession, setCheckingSession] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [entries, setEntries] = useState<TrainingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '',
    mode: 'all' as TrainingMode,
    priority: 50,
    instructions: '',
    examplesText: '',
    isEnabled: true,
  });

  const selected = useMemo(
    () => entries.find((entry) => entry.id === selectedId) ?? null,
    [entries, selectedId],
  );

  const loadEntries = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/assistant-training', { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setAuthed(false);
          return;
        }
        throw new Error(json?.error || 'Failed to load training entries.');
      }
      const nextEntries = Array.isArray(json.entries) ? json.entries : [];
      setEntries(nextEntries);
      if (!selectedId && nextEntries.length > 0) {
        setSelectedId(nextEntries[0].id);
      }
      if (json?.warning) {
        showToast({ type: 'info', title: 'Training Table Warning', message: json.warning });
      }
    } catch (error: any) {
      showToast({ type: 'error', title: 'Load Failed', message: error?.message || 'Failed to load training entries.' });
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
          await loadEntries();
        }
      } finally {
        setCheckingSession(false);
      }
    };
    void run();
  }, []);

  useEffect(() => {
    if (!selected) return;
    setForm({
      title: selected.title,
      mode: selected.mode,
      priority: selected.priority,
      instructions: selected.instructions,
      examplesText: selected.examples.join('\n'),
      isEnabled: selected.isEnabled,
    });
  }, [selected]);

  const handleSaveNew = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const examples = form.examplesText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const res = await fetch('/api/admin/assistant-training', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          mode: form.mode,
          priority: form.priority,
          instructions: form.instructions,
          examples,
          isEnabled: form.isEnabled,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to create training entry.');
      }
      showToast({ type: 'success', title: 'Training Entry Created' });
      await loadEntries();
      if (json?.entry?.id) {
        setSelectedId(json.entry.id);
      }
    } catch (error: any) {
      showToast({ type: 'error', title: 'Create Failed', message: error?.message || 'Failed to create entry.' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSelected = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const examples = form.examplesText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const res = await fetch('/api/admin/assistant-training', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selected.id,
          title: form.title,
          mode: form.mode,
          priority: form.priority,
          instructions: form.instructions,
          examples,
          isEnabled: form.isEnabled,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to update training entry.');
      }
      showToast({ type: 'success', title: 'Training Entry Updated' });
      await loadEntries();
    } catch (error: any) {
      showToast({ type: 'error', title: 'Update Failed', message: error?.message || 'Failed to update entry.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!selected) return;
    if (!confirm('Delete this training entry?')) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/assistant-training', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to delete training entry.');
      }
      showToast({ type: 'success', title: 'Training Entry Deleted' });
      setSelectedId(null);
      await loadEntries();
    } catch (error: any) {
      showToast({ type: 'error', title: 'Delete Failed', message: error?.message || 'Failed to delete entry.' });
    } finally {
      setSaving(false);
    }
  };

  if (checkingSession) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>Checking admin session...</div>;
  }

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>
        <div>
          Admin session required. <button onClick={() => router.push('/admin')}>Go to Admin Login</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--deep)', color: 'var(--white)', padding: '2rem' }}>
      <div style={{ maxWidth: 1320, margin: '0 auto', display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ color: 'var(--muted)', fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.1em' }}>Assistant Training</div>
            <h1 style={{ margin: '.35rem 0 0', fontFamily: "'DM Serif Display', serif" }}>Train Assistant Responses</h1>
          </div>
          <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
            <button onClick={() => router.push('/admin')} style={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', borderRadius: 10, padding: '.7rem .95rem', cursor: 'pointer' }}>
              Back to Admin
            </button>
            <button onClick={() => void loadEntries()} disabled={loading} style={{ border: 'none', background: '#C0392B', color: '#fff', borderRadius: 10, padding: '.7rem .95rem', cursor: 'pointer', opacity: loading ? .7 : 1 }}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '330px 1fr', gap: '1rem' }}>
          <div style={{ background: 'var(--graphite)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '.9rem 1rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontSize: '.74rem', textTransform: 'uppercase', letterSpacing: '.08em' }}>
              Training Entries ({entries.length})
            </div>
            <div style={{ display: 'grid' }}>
              {entries.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setSelectedId(entry.id)}
                  style={{
                    textAlign: 'left',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,.04)',
                    background: selectedId === entry.id ? 'rgba(255,255,255,.04)' : 'transparent',
                    borderLeft: selectedId === entry.id ? '3px solid #C0392B' : '3px solid transparent',
                    color: 'var(--white)',
                    padding: '.9rem 1rem',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '.87rem' }}>{entry.title}</div>
                  <div style={{ marginTop: '.3rem', color: 'var(--muted)', fontSize: '.75rem' }}>
                    {entry.mode.replace(/_/g, ' ')} • priority {entry.priority} • {entry.isEnabled ? 'enabled' : 'disabled'}
                  </div>
                </button>
              ))}
              {entries.length === 0 ? (
                <div style={{ padding: '1rem', color: 'var(--muted)', fontSize: '.82rem' }}>No entries yet. Create your first training entry.</div>
              ) : null}
            </div>
          </div>

          <form onSubmit={handleSaveNew} style={{ background: 'var(--graphite)', border: '1px solid var(--border)', borderRadius: 14, padding: '1rem', display: 'grid', gap: '.9rem' }}>
            <div style={{ color: 'var(--muted)', fontSize: '.74rem', textTransform: 'uppercase', letterSpacing: '.08em' }}>
              {selected ? 'Edit Selected Entry' : 'Create New Entry'}
            </div>
            <input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Title (e.g., Emergency response tone)"
              style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--white)', padding: '.8rem .9rem' }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 150px', gap: '.7rem' }}>
              <select
                value={form.mode}
                onChange={(e) => setForm((prev) => ({ ...prev, mode: e.target.value as TrainingMode }))}
                style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--white)', padding: '.8rem .9rem' }}
              >
                {modeOptions.map((mode) => (
                  <option key={mode.value} value={mode.value}>{mode.label}</option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                max={100}
                value={form.priority}
                onChange={(e) => setForm((prev) => ({ ...prev, priority: Number(e.target.value) }))}
                style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--white)', padding: '.8rem .9rem' }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: '.55rem', padding: '.8rem .9rem', background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <input
                  type="checkbox"
                  checked={form.isEnabled}
                  onChange={(e) => setForm((prev) => ({ ...prev, isEnabled: e.target.checked }))}
                />
                Enabled
              </label>
            </div>

            <textarea
              rows={7}
              value={form.instructions}
              onChange={(e) => setForm((prev) => ({ ...prev, instructions: e.target.value }))}
              placeholder="Instructions for assistant behavior in this mode..."
              style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--white)', padding: '.85rem .9rem', resize: 'vertical', lineHeight: 1.6 }}
            />

            <textarea
              rows={5}
              value={form.examplesText}
              onChange={(e) => setForm((prev) => ({ ...prev, examplesText: e.target.value }))}
              placeholder="Optional examples (one per line)"
              style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--white)', padding: '.85rem .9rem', resize: 'vertical', lineHeight: 1.6 }}
            />

            <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
              {!selected ? (
                <button type="submit" disabled={saving} style={{ border: 'none', background: '#C0392B', color: '#fff', borderRadius: 10, padding: '.75rem 1rem', cursor: 'pointer', opacity: saving ? .7 : 1 }}>
                  {saving ? 'Creating...' : 'Create Entry'}
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => void handleUpdateSelected()} disabled={saving} style={{ border: 'none', background: '#C0392B', color: '#fff', borderRadius: 10, padding: '.75rem 1rem', cursor: 'pointer', opacity: saving ? .7 : 1 }}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button type="button" onClick={() => void handleDeleteSelected()} disabled={saving} style={{ border: '1px solid rgba(231,76,60,.4)', background: 'rgba(231,76,60,.12)', color: '#F3B2AA', borderRadius: 10, padding: '.75rem 1rem', cursor: 'pointer', opacity: saving ? .7 : 1 }}>
                    Delete
                  </button>
                  <button type="button" onClick={() => setSelectedId(null)} style={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', borderRadius: 10, padding: '.75rem 1rem', cursor: 'pointer' }}>
                    Switch To Create
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

