import Link from 'next/link';

import { getPipelineStatus } from '@/lib/pipeline-status/getPipelineStatus';

const formatValue = (value: string | null) => value ?? '—';

const badgeClassName = (tone: 'positive' | 'muted' | 'warning' | 'danger' | 'neutral') => {
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

const countBadgeTone = (count: number, positiveTone: 'warning' | 'danger') =>
  count > 0 ? positiveTone : 'muted';

const formatImplementationStatus = (value: string) =>
  value === 'implemented' ? 'Implemented' : 'Not implemented';

const formatCoverageStatus = (value: string) => value.replace(/_/g, ' ');

export default async function PipelineStatusPage() {
  const rows = await getPipelineStatus();
  const totalSources = rows.length;
  const implementedSources = rows.filter(
    (row) => row.implementationStatus === 'implemented'
  ).length;
  const notImplementedSources = totalSources - implementedSources;
  const activePendingTotal = rows.reduce(
    (sum, row) => sum + row.activePendingCount,
    0
  );
  const failedOrStaleTotal = rows.reduce(
    (sum, row) => sum + row.failedOrStaleCount,
    0
  );

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
              Plain status view for implemented Amazon pull loops and unsupported
              sources. Unsupported sources are marked as not implemented, not failed.
            </p>
          </div>
          <Link
            href="/imports-health"
            className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-foreground"
          >
            Open Imports &amp; Health
          </Link>
        </div>
      </section>

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
          <table className="w-full min-w-[1380px] table-fixed text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-3 shadow-sm w-[13rem]">
                  Source group
                </th>
                <th className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-3 shadow-sm w-[15rem]">
                  Source type
                </th>
                <th className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-3 shadow-sm w-[14rem]">
                  Target table
                </th>
                <th className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-3 shadow-sm w-[9rem]">
                  Implementation
                </th>
                <th className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-3 shadow-sm w-[10rem]">
                  Latest period end
                </th>
                <th className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-3 shadow-sm w-[12rem]">
                  Last successful import
                </th>
                <th className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-3 shadow-sm w-[11rem]">
                  Coverage status
                </th>
                <th className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-3 text-center shadow-sm w-[7rem]">
                  Active pending
                </th>
                <th className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-3 text-center shadow-sm w-[8rem]">
                  Oldest age
                </th>
                <th className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-3 text-center shadow-sm w-[7rem]">
                  Failed/stale
                </th>
                <th className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-3 shadow-sm w-[12rem]">
                  retry_after_at
                </th>
                <th className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-3 shadow-sm w-[18rem]">
                  Next action
                </th>
                <th className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-3 shadow-sm w-[22rem]">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={`${row.sourceType}:${row.targetTable}`}>
                  <td className="px-4 py-3 align-top font-medium text-foreground">
                    <div className="max-w-[13rem] whitespace-normal break-words">
                      {row.sourceGroup}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-muted">
                    <div
                      className="max-w-[15rem] break-all"
                      title={row.sourceType}
                    >
                      {row.sourceType}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-muted">
                    <div
                      className="max-w-[14rem] overflow-hidden text-ellipsis whitespace-nowrap"
                      title={row.targetTable}
                    >
                      {row.targetTable}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-muted">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClassName(
                        row.implementationStatus === 'implemented' ? 'positive' : 'muted'
                      )}`}
                    >
                      {formatImplementationStatus(row.implementationStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-muted">
                    <div className="max-w-[10rem] break-words">
                      {formatValue(row.latestPeriodEnd)}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-muted">
                    <div className="max-w-[12rem] break-words">
                      {formatValue(row.lastSuccessfulImportTime)}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-muted">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClassName(
                        row.currentCoverageStatus === 'not_implemented'
                          ? 'muted'
                          : row.failedOrStaleCount > 0
                            ? 'danger'
                            : row.activePendingCount > 0
                              ? 'warning'
                              : 'neutral'
                      )}`}
                    >
                      {formatCoverageStatus(row.currentCoverageStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center align-top text-muted">
                    <span
                      className={`inline-flex min-w-10 justify-center rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClassName(
                        countBadgeTone(row.activePendingCount, 'warning')
                      )}`}
                    >
                      {row.activePendingCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center align-top text-muted">
                    <div className="mx-auto max-w-[8rem] break-words">{row.oldestPendingAge}</div>
                  </td>
                  <td className="px-4 py-3 text-center align-top text-muted">
                    <span
                      className={`inline-flex min-w-10 justify-center rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClassName(
                        countBadgeTone(row.failedOrStaleCount, 'danger')
                      )}`}
                    >
                      {row.failedOrStaleCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-muted">
                    <div className="max-w-[12rem] break-words">
                      {formatValue(row.retryAfterAt)}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-muted">
                    <div className="max-w-[18rem] whitespace-normal break-words">
                      {row.nextAction}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-muted">
                    <div className="max-w-[22rem] whitespace-normal break-words [overflow-wrap:anywhere]">
                      {row.notes || '—'}
                    </div>
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
