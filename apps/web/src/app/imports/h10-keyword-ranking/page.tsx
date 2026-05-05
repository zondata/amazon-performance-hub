import Link from 'next/link';

import H10KeywordRankingUploadForm from '@/components/imports/H10KeywordRankingUploadForm';
import { formatUiDate } from '@/lib/time/formatUiDate';
import { getH10KeywordRankingStatus } from '@/lib/imports/h10KeywordRankingUpload';

import { uploadH10KeywordRankingAction } from './actions';

export default async function H10KeywordRankingUploadPage() {
  const status = await getH10KeywordRankingStatus();

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-surface/80 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted">Manual import</div>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">
              Helium 10 Keyword Ranking Upload
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted">
              Upload a Helium 10 Keyword Tracker CSV to update keyword ranking history.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/imports-health"
              className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-foreground"
            >
              Back to Imports &amp; Health
            </Link>
            <Link
              href="/pipeline-status"
              className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-foreground"
            >
              Open Pipeline Status
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface/80 p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-foreground">Current H10 status</h2>
          <p className="mt-1 text-sm text-muted">
            Latest keyword ranking status for the configured account and marketplace.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface px-4 py-3">
            <div className="text-xs uppercase tracking-[0.25em] text-muted">Latest observed</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {formatUiDate(status.latestObservedDate)}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface px-4 py-3">
            <div className="text-xs uppercase tracking-[0.25em] text-muted">Rows</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {status.rowCount === null ? '—' : status.rowCount.toLocaleString('en-US')}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface px-4 py-3">
            <div className="text-xs uppercase tracking-[0.25em] text-muted">ASINs at latest date</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {status.latestAsinCount === null
                ? '—'
                : status.latestAsinCount.toLocaleString('en-US')}
            </div>
          </div>
        </div>
        {status.statusMessage ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Status query warning: {status.statusMessage}
          </div>
        ) : null}
      </section>

      <H10KeywordRankingUploadForm action={uploadH10KeywordRankingAction} />
    </div>
  );
}
