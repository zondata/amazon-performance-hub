'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type EventType = 'guardrail_breach' | 'manual_intervention' | 'stop_loss' | 'rollback';

type Props = {
  experimentId: string;
  runIds: string[];
};

const EVENT_TYPE_OPTIONS: Array<{ value: EventType; label: string }> = [
  { value: 'guardrail_breach', label: 'Guardrail breach' },
  { value: 'manual_intervention', label: 'Manual intervention' },
  { value: 'stop_loss', label: 'Stop loss' },
  { value: 'rollback', label: 'Rollback' },
];

const readErrorText = async (response: Response): Promise<string> => {
  const text = await response.text();
  return text.trim().length > 0 ? text : `Request failed (${response.status})`;
};

export default function ExperimentPhaseActions({ experimentId, runIds }: Props) {
  const router = useRouter();
  const [busyRunId, setBusyRunId] = useState<string | null>(null);
  const [eventType, setEventType] = useState<EventType>('guardrail_breach');
  const [eventRunId, setEventRunId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);
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

  const handleMarkUploaded = async (runId: string) => {
    setBusyRunId(runId);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch(
        `/logbook/experiments/${encodeURIComponent(experimentId)}/phases/${encodeURIComponent(runId)}/mark-uploaded`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error(await readErrorText(response));
      }

      const data = (await response.json()) as { effective_date?: string | null; uploaded_at?: string | null };
      setNotice(
        `Marked uploaded for ${runId} (effective_date=${data.effective_date ?? '—'}, uploaded_at=${data.uploaded_at ?? '—'}).`
      );
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to mark uploaded.');
    } finally {
      setBusyRunId(null);
    }
  };

  const handleSubmitEvent = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    setIsSubmittingEvent(true);
    setNotice(null);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        event_type: eventType,
      };
      if (eventRunId.trim()) {
        payload.run_id = eventRunId.trim();
      }
      if (notes.trim()) {
        payload.notes = notes.trim();
      }

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

      const data = (await response.json()) as { id?: string };
      setNotice(`Event logged (${data.id ?? 'unknown id'}).`);
      setNotes('');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to log event.');
    } finally {
      setIsSubmittingEvent(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div className="mb-4 text-sm font-semibold text-foreground">Phase actions</div>

      {uniqueRunIds.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-2 px-3 py-3 text-sm text-muted">
          No run IDs available yet.
        </div>
      ) : (
        <div className="space-y-2">
          {uniqueRunIds.map((runId) => (
            <div
              key={runId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2"
            >
              <code className="text-xs text-foreground">{runId}</code>
              <button
                type="button"
                onClick={() => handleMarkUploaded(runId)}
                disabled={busyRunId !== null}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyRunId === runId ? 'Submitting…' : 'Mark uploaded to Amazon'}
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmitEvent} className="mt-5 space-y-3 rounded-lg border border-border bg-surface-2 p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">Log intervention event</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="space-y-1 text-xs text-muted">
            <span>Type</span>
            <select
              value={eventType}
              onChange={(event) => setEventType(event.target.value as EventType)}
              className="w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm text-foreground"
            >
              {EVENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted">
            <span>run_id (optional)</span>
            <select
              value={eventRunId}
              onChange={(event) => setEventRunId(event.target.value)}
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
        </div>
        <label className="block space-y-1 text-xs text-muted">
          <span>Notes (optional)</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
            placeholder="Describe what happened and why."
          />
        </label>
        <div className="flex items-center justify-between gap-3">
          <div className="min-h-5 text-xs">
            {notice ? <span className="text-emerald-700">{notice}</span> : null}
            {error ? <span className="text-rose-700">{error}</span> : null}
          </div>
          <button
            type="submit"
            disabled={isSubmittingEvent}
            className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmittingEvent ? 'Logging…' : 'Log event'}
          </button>
        </div>
      </form>
    </div>
  );
}
