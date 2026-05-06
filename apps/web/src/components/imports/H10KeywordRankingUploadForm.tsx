'use client';

import { useActionState } from 'react';

import {
  INITIAL_H10_KEYWORD_RANKING_UPLOAD_STATE,
  type H10KeywordRankingUploadState,
} from '@/lib/imports/h10KeywordRankingUploadShared';

const toneClasses: Record<'success' | 'warning' | 'error', string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
};

export default function H10KeywordRankingUploadForm(props: {
  action: (
    prevState: H10KeywordRankingUploadState,
    formData: FormData
  ) => Promise<H10KeywordRankingUploadState>;
}) {
  const [state, formAction, isPending] = useActionState(
    props.action,
    INITIAL_H10_KEYWORD_RANKING_UPLOAD_STATE
  );

  return (
    <section className="rounded-2xl border border-border bg-surface/80 p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">Upload CSV</h2>
        <p className="mt-1 text-sm text-muted">
          Upload one Helium 10 Keyword Tracker export. Import runs server-side with the
          current account and marketplace environment.
        </p>
      </div>

      {state.message && state.tone ? (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${toneClasses[state.tone]}`}>
          <div className="font-semibold">{state.message}</div>
          {state.summary ? <div className="mt-1">{state.summary}</div> : null}
        </div>
      ) : null}

      <form action={formAction} className="space-y-4">
        <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
          CSV file
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-foreground"
          />
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? 'Uploading...' : 'Upload CSV'}
        </button>
      </form>
    </section>
  );
}
