'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  experimentId: string;
  runIds: string[];
};

const readErrorText = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.clone().json()) as {
      error?: unknown;
      details?: unknown;
    };
    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error;
    }
  } catch {}

  const text = await response.text();
  return text.trim().length > 0 ? text : `Request failed (${response.status})`;
};

export default function ExperimentPhaseActions({ experimentId, runIds }: Props) {
  const router = useRouter();
  const [busyRunId, setBusyRunId] = useState<string | null>(null);
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
      <div className="mt-3 min-h-5 text-xs">
        {notice ? <span className="text-foreground">{notice}</span> : null}
        {error ? <span className="text-rose-700">{error}</span> : null}
      </div>
    </div>
  );
}
