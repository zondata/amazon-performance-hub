'use client';

import React from 'react';

type ImportState = {
  ok?: boolean;
  error?: string | null;
  groupCount?: number;
  keywordCount?: number;
  membershipCount?: number;
};

export default function KeywordGroupImport(props: {
  action: (prevState: ImportState, formData: FormData) => Promise<ImportState>;
}) {
  const [state, formAction] = React.useActionState(props.action, {
    ok: false,
    error: null,
  });

  return (
    <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted">
            Keyword group import
          </div>
          <div className="mt-1 text-lg font-semibold text-foreground">
            Upload a keyword group CSV
          </div>
        </div>
      </div>
      {state?.error ? (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}
      {state?.ok ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Import complete. Groups {state.groupCount ?? 0}, Keywords{' '}
          {state.keywordCount ?? 0}, Memberships {state.membershipCount ?? 0}.
        </div>
      ) : null}
      <form action={formAction} className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col text-xs uppercase tracking-wide text-muted md:col-span-2">
          Group set name
          <input
            type="text"
            name="group_set_name"
            required
            placeholder="e.g. March keyword refresh"
            className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            name="is_exclusive"
            className="h-4 w-4 rounded border-border"
          />
          Exclusive (each keyword in one group)
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            name="set_active"
            defaultChecked
            className="h-4 w-4 rounded border-border"
          />
          Set active
        </label>
        <label className="flex flex-col text-xs uppercase tracking-wide text-muted md:col-span-2">
          CSV file
          <input
            type="file"
            name="file"
            accept=".csv"
            required
            className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-foreground"
          />
        </label>
        <div className="md:col-span-2">
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Import CSV
          </button>
        </div>
      </form>
    </section>
  );
}
