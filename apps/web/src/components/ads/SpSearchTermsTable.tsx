import type {
  SpSearchTermsWorkspaceChildRow,
  SpSearchTermsWorkspaceRow,
} from '@/lib/ads/spSearchTermsWorkspaceModel';

const formatCurrency = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 0 : 2,
  });
};

const formatNumber = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US');
};

const formatDecimal = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toFixed(2);
};

const formatPercent = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
};

const statusPill = (status: string | null) => {
  if (!status) return <span className="text-xs text-muted">Unknown</span>;
  const palette =
    status.toLowerCase() === 'enabled'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
      : status.toLowerCase() === 'paused'
        ? 'border-amber-400/40 bg-amber-500/10 text-amber-700'
        : 'border-border bg-surface-2 text-muted';
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${palette}`}
    >
      {status}
    </span>
  );
};

type SpSearchTermsTableProps = {
  rows: SpSearchTermsWorkspaceRow[];
  onOpenComposer?: (row: SpSearchTermsWorkspaceChildRow) => void;
  activeDraftName?: string | null;
  showIds?: boolean;
};

export default function SpSearchTermsTable({
  rows,
  onOpenComposer,
  activeDraftName,
  showIds = false,
}: SpSearchTermsTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface/80 px-5 py-10 text-sm text-muted">
        No SP search terms matched the current workspace filters. This view depends on STIS coverage.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface/80 shadow-sm">
      <div data-aph-hscroll data-aph-hscroll-axis="x" className="max-h-[760px] overflow-auto">
        <div className="min-w-[1980px]">
            <div className="sticky top-0 z-20 grid grid-cols-[140px_minmax(320px,2.4fr)_110px_110px_110px_110px_120px_120px_110px_110px_120px_110px_110px_100px_100px] border-b border-border bg-surface text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              {[
                'Sponsored',
                'Search term',
                'Impr.',
                'Clicks',
                'Orders',
                'Units',
                'Spend',
                'Sales',
                'CTR',
                'CPC',
                'Cost / order',
                'Conv.',
                'ACOS',
                'ROAS',
                'P&L',
              ].map((label) => (
                <div key={label} className="px-3 py-3">
                  {label}
                </div>
              ))}
            </div>

            {rows.map((row) => (
              <details key={row.id} className="group border-b border-border last:border-b-0">
                <summary className="grid cursor-pointer list-none grid-cols-[140px_minmax(320px,2.4fr)_110px_110px_110px_110px_120px_120px_110px_110px_120px_110px_110px_100px_100px] bg-surface/70 transition hover:bg-surface-2/80 group-open:bg-surface-2 [&::-webkit-details-marker]:hidden">
                  <div className="px-3 py-3 text-sm text-foreground">{row.ads_type}</div>
                  <div className="min-w-0 px-3 py-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 text-xs text-muted transition group-open:rotate-90">
                        ▶
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">
                          {row.search_term}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted">
                          <span>ASIN {row.asin_label}</span>
                          {row.coverage_label ? (
                            <span className="inline-flex rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 font-semibold uppercase tracking-[0.16em] text-amber-700">
                              {row.coverage_label}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="px-3 py-3 text-sm text-foreground">{formatNumber(row.impressions)}</div>
                  <div className="px-3 py-3 text-sm text-foreground">{formatNumber(row.clicks)}</div>
                  <div className="px-3 py-3 text-sm text-foreground">{formatNumber(row.orders)}</div>
                  <div className="px-3 py-3 text-sm text-foreground">{formatNumber(row.units)}</div>
                  <div className="px-3 py-3 text-sm text-foreground">{formatCurrency(row.spend)}</div>
                  <div className="px-3 py-3 text-sm text-foreground">{formatCurrency(row.sales)}</div>
                  <div className="px-3 py-3 text-sm text-foreground">{formatPercent(row.ctr)}</div>
                  <div className="px-3 py-3 text-sm text-foreground">{formatCurrency(row.cpc)}</div>
                  <div className="px-3 py-3 text-sm text-foreground">{formatCurrency(row.cost_per_order)}</div>
                  <div className="px-3 py-3 text-sm text-foreground">{formatPercent(row.conversion)}</div>
                  <div className="px-3 py-3 text-sm text-foreground">{formatPercent(row.acos)}</div>
                  <div className="px-3 py-3 text-sm text-foreground">{formatDecimal(row.roas)}</div>
                  <div className="px-3 py-3 text-sm text-muted">—</div>
                </summary>

                <div className="border-t border-border border-l-[6px] border-l-border bg-surface-2 px-4 py-4 shadow-[inset_0_1px_0_rgba(0,0,0,0.08)]">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-background/90 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-muted">
                        Search term detail rows
                      </div>
                      <div className="mt-1 text-sm text-foreground">
                        Parent rows stay aggregated by ASIN bucket and normalized search term. Stage changes from the child row with the concrete keyword or target context.
                      </div>
                      <div className="mt-1 text-xs text-muted">
                        {activeDraftName
                          ? `Active draft: ${activeDraftName}`
                          : 'A draft queue is created on first save.'}
                      </div>
                    </div>
                    <div className="text-xs text-muted">
                      {row.child_rows.length.toLocaleString('en-US')} child row(s)
                    </div>
                  </div>

                  {row.coverage_note ? (
                    <div className="mb-4 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
                      {row.coverage_note}
                    </div>
                  ) : null}

                  <div className="max-h-[360px] overflow-y-auto">
                    <div className="overflow-x-auto rounded-xl border border-border bg-background">
                      <table className="min-w-[1900px] w-full text-left text-sm">
                        <thead className="sticky top-0 z-10 bg-surface text-[11px] uppercase tracking-[0.16em] text-muted">
                          <tr className="border-b border-border">
                            <th className="px-3 py-2">Campaign</th>
                            <th className="px-3 py-2">Ad group</th>
                            <th className="px-3 py-2">Keyword / target</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Match type</th>
                            <th className="px-3 py-2">Impr.</th>
                            <th className="px-3 py-2">Clicks</th>
                            <th className="px-3 py-2">Orders</th>
                            <th className="px-3 py-2">Units</th>
                            <th className="px-3 py-2">Sales</th>
                            <th className="px-3 py-2">Conv.</th>
                            <th className="px-3 py-2">Cost</th>
                            <th className="px-3 py-2">Current bid</th>
                            <th className="px-3 py-2">CPC</th>
                            <th className="px-3 py-2">ACOS</th>
                            <th className="px-3 py-2">ROAS</th>
                            <th className="px-3 py-2">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {row.child_rows.map((child) => (
                            <tr
                              key={child.id}
                              className="align-top bg-background transition odd:bg-surface-2/90 hover:bg-surface"
                            >
                              <td className="px-3 py-3">
                                <div className="font-medium text-foreground">{child.campaign_name ?? '—'}</div>
                                {showIds ? (
                                  <div className="mt-1 text-xs text-muted">{child.campaign_id}</div>
                                ) : null}
                              </td>
                              <td className="px-3 py-3">
                                <div className="font-medium text-foreground">{child.ad_group_name ?? '—'}</div>
                                {showIds ? (
                                  <div className="mt-1 text-xs text-muted">{child.ad_group_id ?? '—'}</div>
                                ) : null}
                              </td>
                              <td className="px-3 py-3">
                                <div className="font-medium text-foreground">{child.target_text}</div>
                                {showIds ? (
                                  <div className="mt-1 text-xs text-muted">
                                    {child.target_id ?? child.target_key ?? 'No target id'}
                                  </div>
                                ) : null}
                                {child.coverage_label ? (
                                  <div className="mt-2 inline-flex rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                                    {child.coverage_label}
                                  </div>
                                ) : null}
                              </td>
                              <td className="px-3 py-3">{statusPill(child.status)}</td>
                              <td className="px-3 py-3 text-foreground">{child.match_type ?? '—'}</td>
                              <td className="px-3 py-3 text-foreground">{formatNumber(child.impressions)}</td>
                              <td className="px-3 py-3 text-foreground">{formatNumber(child.clicks)}</td>
                              <td className="px-3 py-3 text-foreground">{formatNumber(child.orders)}</td>
                              <td className="px-3 py-3 text-foreground">{formatNumber(child.units)}</td>
                              <td className="px-3 py-3 text-foreground">{formatCurrency(child.sales)}</td>
                              <td className="px-3 py-3 text-foreground">{formatPercent(child.conversion)}</td>
                              <td className="px-3 py-3 text-foreground">{formatCurrency(child.cost)}</td>
                              <td className="px-3 py-3 text-foreground">{formatCurrency(child.current_bid)}</td>
                              <td className="px-3 py-3 text-foreground">{formatCurrency(child.cpc)}</td>
                              <td className="px-3 py-3 text-foreground">{formatPercent(child.acos)}</td>
                              <td className="px-3 py-3 text-foreground">{formatDecimal(child.roas)}</td>
                              <td className="px-3 py-3">
                                <button
                                  type="button"
                                  onClick={() => onOpenComposer?.(child)}
                                  className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                                >
                                  Stage change
                                </button>
                                {child.coverage_note ? (
                                  <div className="mt-2 max-w-[220px] text-xs text-muted">
                                    {child.coverage_note}
                                  </div>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </details>
            ))}
        </div>
      </div>
    </div>
  );
}
