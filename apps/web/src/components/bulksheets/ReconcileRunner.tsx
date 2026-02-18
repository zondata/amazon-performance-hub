'use client';

import React from 'react';

type ReconcileState = {
  summary?: {
    reconciled: number;
    pending: number;
    failed: number;
    processed: number;
  } | null;
  error?: string | null;
};

export default function ReconcileRunner(props: {
  action: (prevState: ReconcileState, formData: FormData) => Promise<ReconcileState>;
  defaultSnapshotDate: string;
}) {
  const [state, formAction] = React.useActionState(props.action, { summary: null, error: null });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-slate-400">Snapshot date</label>
          <input
            type="date"
            name="snapshot_date"
            defaultValue={props.defaultSnapshotDate}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            required
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Run reconcile now
        </button>
      </form>
      {state.error ? <div className="mt-3 text-sm text-red-500">{state.error}</div> : null}
      {state.summary ? (
        <div className="mt-4 text-sm text-slate-600">
          Processed {state.summary.processed} manifests. Reconciled{' '}
          {state.summary.reconciled}, pending {state.summary.pending}, failed{' '}
          {state.summary.failed}.
        </div>
      ) : null}
    </div>
  );
}
