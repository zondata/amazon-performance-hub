'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { type FormEvent, useMemo, useState } from 'react';

type AppliedSummary = {
  kiv: {
    created: number;
    updated: number;
    status_changed: number;
    matched_by_id: number;
    matched_by_title: number;
  };
  events: {
    created: number;
  };
  memory: {
    updated: boolean;
  };
};

type ImportState = {
  ok: boolean;
  error?: string | null;
  experiment_id?: string;
  evaluation_id?: string;
  outcome_score?: number;
  outcome_label?: string;
  applied?: AppliedSummary;
  warnings?: string[];
};

const readErrorText = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.clone().json()) as { error?: unknown };
    if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
  } catch {}

  const text = await response.text();
  return text.trim().length > 0 ? text : `Request failed (${response.status})`;
};

export default function ExperimentEvaluationOutputPackImport({
  experimentId,
  uploadUrl,
}: {
  experimentId: string;
  uploadUrl: string;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [state, setState] = useState<ImportState | null>(null);

  const evaluationHref = useMemo(() => {
    if (!state?.ok || !state.evaluation_id) return null;
    return `/logbook/experiments/${encodeURIComponent(experimentId)}#evaluation-${encodeURIComponent(state.evaluation_id)}`;
  }, [experimentId, state?.evaluation_id, state?.ok]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setState(null);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        setState({
          ok: false,
          error: await readErrorText(response),
        });
        return;
      }

      const result = (await response.json()) as ImportState;
      setState(result);
      if (result.ok) {
        event.currentTarget.reset();
        router.refresh();
      }
    } catch (submitError) {
      setState({
        ok: false,
        error: submitError instanceof Error ? submitError.message : 'Upload failed.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-2">
      {state?.error ? (
        <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {state.error}
        </div>
      ) : null}

      {state?.ok ? (
        <div className="space-y-2 rounded-lg border border-border bg-surface-2 px-3 py-3 text-xs text-foreground">
          <div className="font-semibold text-foreground">
            Evaluation imported.
            {state.evaluation_id ? ` ID: ${state.evaluation_id}.` : ''}
            {typeof state.outcome_score === 'number' && state.outcome_label
              ? ` Outcome: ${Math.round(state.outcome_score)} (${state.outcome_label}).`
              : ''}
          </div>
          {state.applied ? (
            <div className="rounded-md border border-border bg-surface px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-muted">Applied changes</div>
              <div className="mt-1 text-muted">
                KIV created {state.applied.kiv.created} · updated {state.applied.kiv.updated} · status changed{' '}
                {state.applied.kiv.status_changed}
              </div>
              <div className="text-muted">
                KIV matched by ID {state.applied.kiv.matched_by_id} · by title {state.applied.kiv.matched_by_title}
              </div>
              <div className="text-muted">
                Events created {state.applied.events.created} · memory updated{' '}
                {state.applied.memory.updated ? 'yes' : 'no'}
              </div>
            </div>
          ) : null}
          {state.warnings && state.warnings.length > 0 ? (
            <div className="rounded-md border border-border bg-surface px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-muted">Warnings</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">
                {state.warnings.map((warning, index) => (
                  <li key={`${warning}-${index}`}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {evaluationHref ? (
            <Link href={evaluationHref} className="inline-flex text-xs font-semibold text-foreground underline">
              View created evaluation
            </Link>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[220px] flex-1 flex-col text-[11px] uppercase tracking-wide text-muted">
          Eval Output Pack (JSON)
          <input
            type="file"
            name="file"
            accept=".json,application/json"
            required
            className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-surface-2 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-foreground"
          />
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Uploading…' : 'Upload Eval Output Pack'}
        </button>
      </form>
    </div>
  );
}
