'use client';

import React from 'react';

type ImportState = {
  ok?: boolean;
  error?: string | null;
  created_experiment_id?: string;
  created_change_ids_count?: number;
};

export default function ProductLogbookAiPackImport(props: {
  action: (prevState: ImportState, formData: FormData) => Promise<ImportState>;
}) {
  const [state, formAction] = React.useActionState(props.action, {
    ok: false,
    error: null,
  });

  return (
    <div>
      {state?.error ? (
        <div className="mb-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}

      {state?.ok ? (
        <div className="mb-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Uploaded AI output pack.
          {state.created_experiment_id ? ` Experiment: ${state.created_experiment_id}.` : ''}
          {typeof state.created_change_ids_count === 'number'
            ? ` Manual changes created: ${state.created_change_ids_count}.`
            : ''}
        </div>
      ) : null}

      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[260px] flex-1 flex-col text-xs uppercase tracking-wide text-muted">
          AI Output Pack (JSON)
          <input
            type="file"
            name="file"
            accept=".json,application/json"
            required
            className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-foreground"
          />
        </label>

        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Upload AI Output Pack
        </button>
      </form>
    </div>
  );
}
