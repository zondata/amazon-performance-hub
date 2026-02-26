'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type EventType = 'guardrail_breach' | 'manual_intervention' | 'stop_loss' | 'rollback';

type Props = {
  experimentId: string;
  runIds: string[];
};

const EVENT_PRESETS: Array<{ value: EventType; label: string }> = [
  { value: 'guardrail_breach', label: 'Guardrail breach' },
  { value: 'manual_intervention', label: 'Manual intervention' },
  { value: 'stop_loss', label: 'Stop-loss' },
  { value: 'rollback', label: 'Rollback' },
];

const readErrorText = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.clone().json()) as { error?: unknown };
    if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
  } catch {}

  const text = await response.text();
  return text.trim().length > 0 ? text : `Request failed (${response.status})`;
};

const toLocalDateTimeInputValue = (value: Date): string => {
  const pad = (part: number) => String(part).padStart(2, '0');
  return [
    `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`,
    `${pad(value.getHours())}:${pad(value.getMinutes())}`,
  ].join('T');
};

const toIsoDateTime = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

export default function ExperimentQuickLogEventPanel({ experimentId, runIds }: Props) {
  const router = useRouter();

  const [activeType, setActiveType] = useState<EventType | null>(null);
  const [eventRunId, setEventRunId] = useState('');
  const [notes, setNotes] = useState('');
  const [occurredAt, setOccurredAt] = useState(toLocalDateTimeInputValue(new Date()));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uniqueRunIds = useMemo(() => {
    const deduped = new Set<string>();
    for (const runId of runIds) {
      const trimmed = runId.trim();
      if (!trimmed) continue;
      deduped.add(trimmed);
    }
    return Array.from(deduped);
  }, [runIds]);

  const openPreset = (eventType: EventType) => {
    setActiveType(eventType);
    setEventRunId('');
    setNotes('');
    setOccurredAt(toLocalDateTimeInputValue(new Date()));
    setNotice(null);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeType) return;

    const occurredAtIso = toIsoDateTime(occurredAt);
    if (occurredAt.trim() && !occurredAtIso) {
      setError('occurred_at must be a valid date/time.');
      return;
    }

    setIsSubmitting(true);
    setNotice(null);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        event_type: activeType,
      };
      if (eventRunId.trim()) payload.run_id = eventRunId.trim();
      if (notes.trim()) payload.notes = notes.trim();
      if (occurredAtIso) payload.occurred_at = occurredAtIso;

      const response = await fetch(`/logbook/experiments/${encodeURIComponent(experimentId)}/events`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await readErrorText(response));
      }

      setActiveType(null);
      setEventRunId('');
      setNotes('');
      setOccurredAt(toLocalDateTimeInputValue(new Date()));
      setNotice('Event logged.');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to log event.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div className="text-sm font-semibold text-foreground">Quick Log Event</div>
      <div className="mt-1 text-xs text-muted">Capture guardrails and interventions in seconds.</div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {EVENT_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => openPreset(preset.value)}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
              activeType === preset.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-surface-2 text-foreground hover:bg-surface'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {activeType ? (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-lg border border-border bg-surface-2 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            {EVENT_PRESETS.find((preset) => preset.value === activeType)?.label}
          </div>
          <label className="block space-y-1 text-xs text-muted">
            <span>run_id (optional)</span>
            <select
              value={eventRunId}
              onChange={(selectEvent) => setEventRunId(selectEvent.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm text-foreground"
            >
              <option value="">(none)</option>
              {uniqueRunIds.map((runId) => (
                <option key={runId} value={runId}>
                  {runId}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-xs text-muted">
            <span>occurred_at (optional)</span>
            <input
              type="datetime-local"
              value={occurredAt}
              onChange={(inputEvent) => setOccurredAt(inputEvent.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="block space-y-1 text-xs text-muted">
            <span>Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(textEvent) => setNotes(textEvent.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
              placeholder="What happened?"
            />
          </label>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setActiveType(null)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Logging…' : 'Log event'}
            </button>
          </div>
        </form>
      ) : null}

      <div className="mt-3 min-h-5 text-xs">
        {notice ? <span className="text-foreground">{notice}</span> : null}
        {error ? <span className="text-rose-700">{error}</span> : null}
      </div>
    </div>
  );
}
