import CopyButton from '@/components/CopyButton';
import { getDataHealth, type DataHealthResult } from '@/lib/health/getDataHealth';

const SOURCE_GROUPS: Array<{ title: string; sources: string[] }> = [
  { title: 'Bulksheets', sources: ['bulk'] },
  {
    title: 'Ads — Sponsored Products',
    sources: ['sp_campaign', 'sp_placement', 'sp_targeting', 'sp_stis'],
  },
  {
    title: 'Ads — Sponsored Brands',
    sources: ['sb_campaign', 'sb_campaign_placement', 'sb_keyword', 'sb_stis'],
  },
  {
    title: 'Ads — Sponsored Display',
    sources: [
      'sd_campaign',
      'sd_advertised_product',
      'sd_targeting',
      'sd_matched_target',
      'sd_purchased_product',
    ],
  },
  { title: 'Sales', sources: ['si_sales_trend'] },
  { title: 'SQP', sources: ['sqp'] },
  { title: 'Ranking', sources: ['h10_keyword_tracker'] },
];

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
};

const formatNumber = (value?: number | string | null) => {
  if (value === null || value === undefined) return '—';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return String(value);
  return numeric.toLocaleString('en-US');
};

const getLatestTimestamp = (row: DataHealthResult['latestUploadsBySourceType'][number]) => {
  return row.exported_at || row.snapshot_date || row.ingested_at;
};

const getRowKey = (
  row: DataHealthResult['latestUploadsBySourceType'][number]
) => {
  if (row.upload_id) return row.upload_id;
  const stamp = row.exported_at || row.snapshot_date || row.ingested_at || 'na';
  const filename = row.original_filename || 'na';
  const source = row.source_type || 'unknown';
  return `${source}|${stamp}|${filename}`;
};

const isStale = (row: DataHealthResult['latestUploadsBySourceType'][number]) => {
  const latest = getLatestTimestamp(row);
  if (!latest) return false;
  const parsed = new Date(latest);
  if (Number.isNaN(parsed.getTime())) return false;
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - 8);
  return parsed < threshold;
};

const renderUploadTable = (
  title: string,
  rows: DataHealthResult['latestUploadsBySourceType']
) => {
  return (
    <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <span className="text-xs uppercase tracking-[0.2em] text-muted">
          {rows.length} sources
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
          No uploads found for this module.
        </div>
      ) : (
        <div data-aph-hscroll data-aph-hscroll-axis="x" className="overflow-x-auto">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="w-40 pb-2">Source</th>
                <th className="w-32 pb-2">Latest export</th>
                <th className="w-40 pb-2">Coverage</th>
                <th className="w-24 pb-2">Rows</th>
                <th className="w-64 pb-2">File</th>
                <th className="w-56 pb-2">Upload ID</th>
                <th className="w-24 pb-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={getRowKey(row)}>
                  <td className="py-3 font-medium text-foreground">
                    {row.source_type}
                  </td>
                  <td className="py-3 text-muted">
                    {formatDate(getLatestTimestamp(row))}
                  </td>
                  <td className="py-3 text-muted">
                    {row.coverage_start || row.coverage_end
                      ? `${row.coverage_start ?? '—'} → ${row.coverage_end ?? '—'}`
                      : '—'}
                  </td>
                  <td className="py-3 text-muted">
                    {formatNumber(row.row_count)}
                  </td>
                  <td className="py-3 text-muted">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="min-w-0 flex-1 truncate"
                        title={row.original_filename ?? undefined}
                      >
                        {row.original_filename ?? '—'}
                      </span>
                      {row.original_filename ? (
                        <CopyButton value={row.original_filename} label="filename" />
                      ) : null}
                    </div>
                  </td>
                  <td className="py-3 text-xs text-muted">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="min-w-0 flex-1 truncate"
                        title={row.upload_id ?? undefined}
                      >
                        {row.upload_id ?? '—'}
                      </span>
                      {row.upload_id ? (
                        <CopyButton value={row.upload_id} label="upload id" />
                      ) : null}
                    </div>
                  </td>
                  <td className="py-3 text-right">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                        isStale(row)
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {isStale(row) ? 'Stale' : 'Healthy'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default async function ImportsHealthPage() {
  const data = await getDataHealth();
  const latestBySource = new Map(
    data.latestUploadsBySourceType.map((row) => [row.source_type ?? '', row])
  );

  const usedSources = new Set<string>();
  const groupedSections = SOURCE_GROUPS.map((group) => {
    const rows = group.sources
      .map((source) => latestBySource.get(source))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
    group.sources.forEach((source) => usedSources.add(source));
    return { title: group.title, rows };
  });

  const otherRows = data.latestUploadsBySourceType.filter(
    (row) => row.source_type && !usedSources.has(row.source_type)
  );

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
          <div className="text-xs uppercase tracking-[0.3em] text-muted">
            Account
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {data.accountId}
          </div>
          <div className="mt-1 text-sm text-muted">
            Marketplace {data.marketplace}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
          <div className="text-xs uppercase tracking-[0.3em] text-muted">
            Mapping issues (latest)
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>SP</span>
              <span className="font-semibold text-foreground">
                {data.mappingIssues.sp.issue_rows} issues ·{' '}
                {formatNumber(data.mappingIssues.sp.affected_rows)} rows
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>SB</span>
              <span className="font-semibold text-foreground">
                {data.mappingIssues.sb.issue_rows} issues ·{' '}
                {formatNumber(data.mappingIssues.sb.affected_rows)} rows
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>SD</span>
              <span className="font-semibold text-foreground">
                {data.mappingIssues.sd.issue_rows} issues ·{' '}
                {formatNumber(data.mappingIssues.sd.affected_rows)} rows
              </span>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
          <div className="text-xs uppercase tracking-[0.3em] text-muted">
            Reconcile queue
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {data.reconcileQueue.configured
              ? formatNumber(data.reconcileQueue.pending_count ?? 0)
              : 'Not configured'}
          </div>
          <div className="mt-1 text-sm text-muted">
            Pending manifests
          </div>
        </div>
      </section>

      {data.spendReconciliation ? (
        <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-muted">
                Spend reconciliation (14 days)
              </div>
              {data.spendReconciliation.enabled ? (
                'recent_flags_count' in data.spendReconciliation ? (
                  <div className="mt-2 text-2xl font-semibold text-foreground">
                    {data.spendReconciliation.recent_flags_count} flagged days
                  </div>
                ) : (
                  <div className="mt-2 text-2xl font-semibold text-foreground">
                    Spend reconciliation: unavailable (timeout)
                  </div>
                )
              ) : (
                <div className="mt-2 text-2xl font-semibold text-foreground">
                  Spend reconciliation: disabled
                </div>
              )}
            </div>
            {data.spendReconciliation.enabled &&
            'latest_flag_date' in data.spendReconciliation ? (
              <div className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-muted">
                Latest flag: {formatDate(data.spendReconciliation.latest_flag_date)}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="space-y-6">
        {groupedSections.map((section) => (
          <div key={section.title}>
            {renderUploadTable(section.title, section.rows)}
          </div>
        ))}
        {otherRows.length > 0
          ? renderUploadTable('Other sources', otherRows)
          : null}
      </div>
    </div>
  );
}
