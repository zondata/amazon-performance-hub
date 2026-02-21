'use client';

import React from 'react';

type ImportState = {
  ok?: boolean;
  error?: string | null;
  evaluation_id?: string;
  outcome_score?: number;
  outcome_label?: string;
};

export default function ExperimentEvaluationOutputPackImport(props: {
  action: (prevState: ImportState, formData: FormData) => Promise<ImportState>;
  experimentId: string;
}) {
  const [state, formAction] = React.useActionState(props.action, {
    ok: false,
    error: null,
  });

  return (
    <div className="space-y-2">
      {state?.error ? (
        <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {state.error}
        </div>
      ) : null}

      {state?.ok ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          Evaluation imported.
          {state.evaluation_id ? ` ID: ${state.evaluation_id}.` : ''}
          {typeof state.outcome_score === 'number' && state.outcome_label
            ? ` Outcome: ${Math.round(state.outcome_score)} (${state.outcome_label}).`
            : ''}
        </div>
      ) : null}

      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="experiment_id" value={props.experimentId} />
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
          className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
        >
          Upload Eval Output Pack
        </button>
      </form>
    </div>
  );
}
