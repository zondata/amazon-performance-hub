import Link from 'next/link';

import { getPipelineStatus } from '@/lib/pipeline-status/getPipelineStatus';

const badgeClassName = (
  tone: 'positive' | 'muted' | 'warning' | 'danger' | 'neutral'
) => {
  if (tone === 'positive') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (tone === 'muted') {
    return 'border-border bg-surface-2 text-muted';
  }
  if (tone === 'warning') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  if (tone === 'danger') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  return 'border-border bg-surface text-foreground';
};

const statusTone = (status: string) => {
  if (status === 'Complete' || status === 'imported' || status === 'completed') return 'positive';
  if (
    status === 'Expected Delay' ||
    status === 'pending' ||
    status === 'polling' ||
    status === 'requested' ||
    status === 'created'
  ) {
    return 'warning';
  }
  if (status === 'Incomplete' || status === 'pending_timeout' || status === 'stale_expired') {
    return 'warning';
  }
  if (status === 'failed' || status === 'Blocked') return 'danger';
  if (status === 'No Data' || status === '—' || status === 'Not implemented') return 'muted';
  return 'neutral';
};

export default async function PipelineStatusPage() {
  const { rows, batchSummary } = await getPipelineStatus();
  const totalSources = rows.length;
  const implementedSources = rows.filter(
    (row) => row.implementationStatus === 'implemented'
  ).length;
  const notImplementedSources = totalSources - implementedSources;
  const activePendingTotal = rows.reduce((sum, row) => sum + row.activePendingCount, 0);
  const failedOrStaleTotal = rows.reduce((sum, row) => sum + row.failedOrStaleCount, 0);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-surface/80 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted">
              V3 Operations
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">
              Pipeline Status
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted">
              Each row below reflects the current implementation and coverage state for a
              single source group.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled
              title="Manual workflow dispatch is not wired yet."
              aria-label="Run Sales manual sync is not wired yet."
              className="cursor-not-allowed rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-muted"
            >
              Run Sales
            </button>
            <button
              type="button"
              disabled
              title="Manual workflow dispatch is not wired yet."
              aria-label="Run Ads manual sync is not wired yet."
              className="cursor-not-allowed rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-muted"
            >
              Run Ads
            </button>
            <Link
              href="/imports-health"
              className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-foreground"
            >
              Open Imports &amp; Health
            </Link>
          </div>
        </div>
      </section>

      {batchSummary ? (
        <section className="rounded-2xl border border-border bg-surface/80 p-4 shadow-sm">
          <div className="flex flex-wrap items-start gap-3">
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClassName(
                statusTone(batchSummary.status)
              )}`}
            >
              Ads batch {batchSummary.status.replace(/_/g, ' ')}
            </span>
            <p className="max-w-4xl text-sm text-foreground">{batchSummary.summary}</p>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface/80 p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-border bg-surface px-4 py-3">
            <div className="text-xs uppercase tracking-[0.25em] text-muted">Total sources</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{totalSources}</div>
          </div>
          <div className="rounded-xl border border-border bg-surface px-4 py-3">
            <div className="text-xs uppercase tracking-[0.25em] text-muted">Implemented</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {implementedSources}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface px-4 py-3">
            <div className="text-xs uppercase tracking-[0.25em] text-muted">Not implemented</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {notImplementedSources}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface px-4 py-3">
            <div className="text-xs uppercase tracking-[0.25em] text-muted">Active pending</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {activePendingTotal}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface px-4 py-3">
            <div className="text-xs uppercase tracking-[0.25em] text-muted">Failed or stale</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {failedOrStaleTotal}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface/80 p-4 shadow-sm">
        <div
          data-aph-hscroll
          data-aph-hscroll-axis="x"
          className="max-h-[70vh] overflow-auto rounded-xl border border-border"
        >
          <table className="w-full min-w-[980px] table-fixed text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="sticky top-0 z-10 w-[15rem] border-b border-border bg-surface px-4 py-3 shadow-sm">
                  Source group
                </th>
                <th className="sticky top-0 z-10 w-[10rem] border-b border-border bg-surface px-4 py-3 shadow-sm">
                  Implementation
                </th>
                <th className="sticky top-0 z-10 w-[10rem] border-b border-border bg-surface px-4 py-3 shadow-sm">
                  Earliest report day
                </th>
                <th className="sticky top-0 z-10 w-[10rem] border-b border-border bg-surface px-4 py-3 shadow-sm">
                  Latest report day
                </th>
                <th className="sticky top-0 z-10 w-[11rem] border-b border-border bg-surface px-4 py-3 shadow-sm">
                  Data completeness
                </th>
                <th className="sticky top-0 z-10 w-[11rem] border-b border-border bg-surface px-4 py-3 shadow-sm">
                  Amazon/API state
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={`${row.sourceType}:${row.targetTable}`}>
                  <td className="px-4 py-3 align-top font-medium text-foreground">
                    <div className="max-w-[15rem] whitespace-normal break-words">
                      {row.sourceGroup}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-muted">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClassName(
                        row.implementationStatus === 'implemented' ? 'positive' : 'muted'
                      )}`}
                    >
                      {row.implementationLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-muted">{row.earliestReportDay}</td>
                  <td className="px-4 py-3 align-top text-muted">{row.latestReportDay}</td>
                  <td className="px-4 py-3 align-top text-muted">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClassName(
                        statusTone(row.dataCompleteness)
                      )}`}
                    >
                      {row.dataCompleteness}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-muted">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClassName(
                        statusTone(row.amazonApiState)
                      )}`}
                    >
                      {row.amazonApiState}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
