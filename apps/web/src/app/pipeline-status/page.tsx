import Link from 'next/link';

import { getPipelineStatus } from '@/lib/pipeline-status/getPipelineStatus';

const formatValue = (value: string | null) => value ?? '—';
const PREVIEW_LIMIT = 120;

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

const previewText = (value: string | null, limit = PREVIEW_LIMIT) => {
  if (!value) {
    return '—';
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit - 1)}…`;
};

const statusTone = (status: string) => {
  if (status === 'success') return 'positive';
  if (status === 'partial_success') return 'warning';
  if (status === 'warning') return 'warning';
  if (status === 'failed') return 'danger';
  if (status === 'blocked' || status === 'not_implemented' || status === 'no_coverage') {
    return 'muted';
  }
  return 'neutral';
};

const statusLabel = (status: string) => status.replace(/_/g, ' ');

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
              Each row below reflects its own source group. Batch-level failures are shown
              separately and do not overwrite successful source-group rows.
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

      {batchSummary ? (
        <section className="rounded-2xl border border-border bg-surface/80 p-4 shadow-sm">
          <div className="flex flex-wrap items-start gap-3">
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClassName(
                statusTone(batchSummary.status)
              )}`}
            >
              Ads batch {statusLabel(batchSummary.status)}
            </span>
            <p className="max-w-4xl text-sm text-foreground">{batchSummary.summary}</p>
          </div>
          {batchSummary.technicalDetails ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-muted">
                Show technical details
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-border bg-surface px-3 py-2 text-xs whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                {batchSummary.technicalDetails}
              </pre>
            </details>
          ) : null}
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
          <table className="w-full min-w-[1420px] table-fixed text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="sticky top-0 z-10 w-[13rem] border-b border-border bg-surface px-4 py-3 shadow-sm">
                  Source group
                </th>
                <th className="sticky top-0 z-10 w-[15rem] border-b border-border bg-surface px-4 py-3 shadow-sm">
                  Source type
                </th>
                <th className="sticky top-0 z-10 w-[14rem] border-b border-border bg-surface px-4 py-3 shadow-sm">
                  Target table
                </th>
                <th className="sticky top-0 z-10 w-[9rem] border-b border-border bg-surface px-4 py-3 shadow-sm">
                  Implementation
                </th>
                <th className="sticky top-0 z-10 w-[9rem] border-b border-border bg-surface px-4 py-3 shadow-sm">
                  Row status
                </th>
                <th className="sticky top-0 z-10 w-[10rem] border-b border-border bg-surface px-4 py-3 shadow-sm">
                  Latest report day
                </th>
                <th className="sticky top-0 z-10 w-[12rem] border-b border-border bg-surface px-4 py-3 shadow-sm">
                  Imported at
                </th>
                <th className="sticky top-0 z-10 w-[10rem] border-b border-border bg-surface px-4 py-3 shadow-sm">
                  Coverage status
                </th>
                <th className="sticky top-0 z-10 w-[7rem] border-b border-border bg-surface px-4 py-3 text-center shadow-sm">
                  Active pending
                </th>
                <th className="sticky top-0 z-10 w-[8rem] border-b border-border bg-surface px-4 py-3 text-center shadow-sm">
                  Oldest age
                </th>
                <th className="sticky top-0 z-10 w-[7rem] border-b border-border bg-surface px-4 py-3 text-center shadow-sm">
                  Failed/stale
                </th>
                <th className="sticky top-0 z-10 w-[12rem] border-b border-border bg-surface px-4 py-3 shadow-sm">
                  retry_after_at
                </th>
                <th className="sticky top-0 z-10 w-[18rem] border-b border-border bg-surface px-4 py-3 shadow-sm">
                  Next action
                </th>
                <th className="sticky top-0 z-10 w-[24rem] border-b border-border bg-surface px-4 py-3 shadow-sm">
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
                    <div className="max-w-[15rem] break-all" title={row.sourceType}>
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
                      {statusLabel(row.implementationStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-muted">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClassName(
                        statusTone(row.sourceGroupStatus)
                      )}`}
                    >
                      {statusLabel(row.sourceGroupStatus)}
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
                        statusTone(row.sourceGroupStatus)
                      )}`}
                    >
                      {row.currentCoverageStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center align-top text-muted">
                    <span
                      className={`inline-flex min-w-10 justify-center rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClassName(
                        row.activePendingCount > 0 ? 'warning' : 'muted'
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
                        row.failedOrStaleCount > 0 ? 'danger' : 'muted'
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
                    <div
                      className="max-h-12 max-w-[18rem] overflow-hidden whitespace-normal break-words [overflow-wrap:anywhere]"
                      title={row.nextAction}
                    >
                      {previewText(row.nextAction)}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-muted">
                    <div className="max-w-[24rem]">
                      <div className="max-h-12 overflow-hidden whitespace-normal break-words [overflow-wrap:anywhere]">
                        {previewText(row.friendlySummary)}
                      </div>
                      {row.technicalDetails ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-muted">
                            Show technical details
                          </summary>
                          <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-border bg-surface px-3 py-2 text-xs whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                            {row.technicalDetails}
                          </pre>
                        </details>
                      ) : null}
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
