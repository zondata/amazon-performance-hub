import Link from 'next/link';

import { getPipelineStatus } from '@/lib/pipeline-status/getPipelineStatus';

const formatValue = (value: string | null) => value ?? '—';

export default async function PipelineStatusPage() {
  const rows = await getPipelineStatus();

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
        <div data-aph-hscroll data-aph-hscroll-axis="x" className="overflow-x-auto">
          <table className="w-full min-w-[1400px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="pb-3 pr-4">Source group</th>
                <th className="pb-3 pr-4">Source type</th>
                <th className="pb-3 pr-4">Target table</th>
                <th className="pb-3 pr-4">Implementation status</th>
                <th className="pb-3 pr-4">Latest period end</th>
                <th className="pb-3 pr-4">Last successful import time</th>
                <th className="pb-3 pr-4">Current coverage status</th>
                <th className="pb-3 pr-4">Active pending count</th>
                <th className="pb-3 pr-4">Oldest pending age</th>
                <th className="pb-3 pr-4">Failed/stale count</th>
                <th className="pb-3 pr-4">retry_after_at</th>
                <th className="pb-3 pr-4">Next action</th>
                <th className="pb-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={`${row.sourceType}:${row.targetTable}`}>
                  <td className="py-3 pr-4 font-medium text-foreground">{row.sourceGroup}</td>
                  <td className="py-3 pr-4 text-muted">{row.sourceType}</td>
                  <td className="py-3 pr-4 text-muted">{row.targetTable}</td>
                  <td className="py-3 pr-4 text-muted">{row.implementationStatus}</td>
                  <td className="py-3 pr-4 text-muted">{formatValue(row.latestPeriodEnd)}</td>
                  <td className="py-3 pr-4 text-muted">
                    {formatValue(row.lastSuccessfulImportTime)}
                  </td>
                  <td className="py-3 pr-4 text-muted">{row.currentCoverageStatus}</td>
                  <td className="py-3 pr-4 text-muted">{row.activePendingCount}</td>
                  <td className="py-3 pr-4 text-muted">{row.oldestPendingAge}</td>
                  <td className="py-3 pr-4 text-muted">{row.failedOrStaleCount}</td>
                  <td className="py-3 pr-4 text-muted">{formatValue(row.retryAfterAt)}</td>
                  <td className="py-3 pr-4 text-muted">{row.nextAction}</td>
                  <td className="py-3 text-muted">{row.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
