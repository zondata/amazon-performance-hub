import type { ReactNode } from 'react';

import type { SpTargetsWorkspaceRow } from '@/lib/ads/spTargetsWorkspaceModel';

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

const formatRank = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return Math.round(value).toLocaleString('en-US');
};

const GRID_TEMPLATE =
  'grid-cols-[minmax(260px,2.2fr)_100px_140px_180px_180px_120px_100px_90px_110px_110px_90px_90px_90px_100px_100px_90px_90px_90px_90px_110px_110px_110px_110px_120px]';

type SpTargetsTableProps = {
  rows: SpTargetsWorkspaceRow[];
  onOpenComposer?: (row: SpTargetsWorkspaceRow) => void;
  activeDraftName?: string | null;
};

const renderCell = (value: ReactNode, subvalue?: string | null) => (
  <div className="min-w-0 px-3 py-3">
    <div className="truncate text-sm text-foreground">{value}</div>
    {subvalue ? <div className="mt-1 text-[11px] text-muted">{subvalue}</div> : null}
  </div>
);

const coverageBadge = (row: SpTargetsWorkspaceRow) =>
  row.coverage_label ? (
    <span className="inline-flex rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
      {row.coverage_label}
    </span>
  ) : null;

const statusPill = (status: string | null) => {
  if (!status) {
    return <span className="text-xs text-muted">Unknown</span>;
  }
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

export default function SpTargetsTable({
  rows,
  onOpenComposer,
  activeDraftName,
}: SpTargetsTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface/80 px-5 py-10 text-sm text-muted">
        No SP targets matched the current workspace filters.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface/80 shadow-sm">
      <div className="max-h-[760px] overflow-y-auto">
          <div data-aph-hscroll data-aph-hscroll-axis="x" className="overflow-x-auto">
          <div className="min-w-[2780px]">
            <div
              className={`sticky top-0 z-10 grid ${GRID_TEMPLATE} border-b border-border bg-surface text-[11px] font-semibold uppercase tracking-[0.18em] text-muted`}
            >
              {[
                'Target',
                'Status',
                'Type',
                'Portfolio',
                'Campaign',
                'Ad group',
                'Match',
                'STIS',
                'STIR',
                'TOS IS',
                'Impr.',
                'Clicks',
                'Orders',
                'Units',
                'Sales',
                'Conv.',
                'Spend',
                'CPC',
                'CTR',
                'ACOS',
                'ROAS',
                'P&L',
                'Break-even bid',
                'Last activity',
              ].map((label) => (
                <div key={label} className="px-3 py-3">
                  {label}
                </div>
              ))}
            </div>

            {rows.map((row) => (
              <details key={row.target_id} className="group border-b border-border last:border-b-0">
                <summary
                  className={`grid ${GRID_TEMPLATE} cursor-pointer list-none bg-surface/70 hover:bg-surface-2/70 [&::-webkit-details-marker]:hidden`}
                >
                  <div className="min-w-0 px-3 py-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 text-xs text-muted transition group-open:rotate-90">
                        ▶
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">
                          {row.target_text}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <span className="text-[11px] text-muted">ID {row.target_id}</span>
                          {coverageBadge(row)}
                        </div>
                      </div>
                    </div>
                  </div>
                  {renderCell(statusPill(row.status))}
                  {renderCell(row.type_label)}
                  {renderCell(row.portfolio_name ?? '—')}
                  {renderCell(row.campaign_name ?? '—', row.campaign_id)}
                  {renderCell(row.ad_group_name ?? '—', row.ad_group_id)}
                  {renderCell(row.match_type ?? '—')}
                  {renderCell(formatPercent(row.stis), 'latest target diagnostic')}
                  {renderCell(formatRank(row.stir), 'same-text, else best covered child')}
                  {renderCell('—', 'campaign placement context below')}
                  {renderCell(formatNumber(row.impressions))}
                  {renderCell(formatNumber(row.clicks))}
                  {renderCell(formatNumber(row.orders))}
                  {renderCell(formatNumber(row.units))}
                  {renderCell(formatCurrency(row.sales))}
                  {renderCell(formatPercent(row.conversion))}
                  {renderCell(formatCurrency(row.spend))}
                  {renderCell(formatCurrency(row.cpc))}
                  {renderCell(formatPercent(row.ctr))}
                  {renderCell(formatPercent(row.acos))}
                  {renderCell(formatDecimal(row.roas))}
                  {renderCell('—', 'coverage gated')}
                  {renderCell('—', 'coverage gated')}
                  {renderCell(row.last_activity ?? '—')}
                </summary>

                <div className="border-t border-border bg-surface-2/40 px-4 py-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-muted">
                        Draft staging
                      </div>
                      <div className="mt-1 text-sm text-foreground">
                        Stage target, ad group, campaign, and campaign placement modifier edits without writing to logbook facts yet.
                      </div>
                      <div className="mt-1 text-xs text-muted">
                        {activeDraftName ? `Active draft: ${activeDraftName}` : 'A draft queue is created on first save.'}
                      </div>
                    </div>
                    {onOpenComposer ? (
                      <button
                        type="button"
                        onClick={() => onOpenComposer(row)}
                        className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                      >
                        Stage change
                      </button>
                    ) : null}
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
                    <section className="rounded-xl border border-border bg-surface p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-muted">
                            Search Terms
                          </div>
                          <div className="mt-1 text-sm text-foreground">
                            Parent totals stay on the target row. Child rows stay as search-term slices.
                          </div>
                        </div>
                        <div className="text-xs text-muted">
                          {row.search_terms.length.toLocaleString('en-US')} row(s)
                        </div>
                      </div>

                      {row.search_terms.length === 0 ? (
                        <div className="mt-4 rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
                          No search-term diagnostics for this target in the selected range.
                        </div>
                      ) : (
                        <div className="mt-4 overflow-x-auto">
                          <table className="min-w-[980px] w-full text-left text-sm">
                            <thead className="text-[11px] uppercase tracking-[0.16em] text-muted">
                              <tr className="border-b border-border">
                                <th className="px-3 py-2">Search term</th>
                                <th className="px-3 py-2">STIS</th>
                                <th className="px-3 py-2">STIR</th>
                                <th className="px-3 py-2">Impr.</th>
                                <th className="px-3 py-2">Clicks</th>
                                <th className="px-3 py-2">Orders</th>
                                <th className="px-3 py-2">Sales</th>
                                <th className="px-3 py-2">Spend</th>
                                <th className="px-3 py-2">ACOS</th>
                                <th className="px-3 py-2">ROAS</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {row.search_terms.map((child) => (
                                <tr key={child.id} className="align-top">
                                  <td className="px-3 py-3">
                                    <div className="font-medium text-foreground">
                                      {child.search_term}
                                    </div>
                                    {child.same_text ? (
                                      <div className="mt-1 inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                                        Same text
                                      </div>
                                    ) : null}
                                  </td>
                                  <td className="px-3 py-3 text-foreground">{formatPercent(child.stis)}</td>
                                  <td className="px-3 py-3 text-foreground">{formatRank(child.stir)}</td>
                                  <td className="px-3 py-3 text-foreground">{formatNumber(child.impressions)}</td>
                                  <td className="px-3 py-3 text-foreground">{formatNumber(child.clicks)}</td>
                                  <td className="px-3 py-3 text-foreground">{formatNumber(child.orders)}</td>
                                  <td className="px-3 py-3 text-foreground">{formatCurrency(child.sales)}</td>
                                  <td className="px-3 py-3 text-foreground">{formatCurrency(child.spend)}</td>
                                  <td className="px-3 py-3 text-foreground">{formatPercent(child.acos)}</td>
                                  <td className="px-3 py-3 text-foreground">{formatDecimal(child.roas)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>

                    <section className="rounded-xl border border-border bg-surface p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-muted">
                        Campaign Placement Context
                      </div>
                      <div className="mt-1 text-sm text-foreground">
                        Placement metrics stay campaign-scoped. They are shown here as context only.
                      </div>

                      {row.coverage_note ? (
                        <div className="mt-3 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-3 text-sm text-amber-800">
                          {row.coverage_note}
                        </div>
                      ) : null}

                      {row.placement_context ? (
                        <div className="mt-4 space-y-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-lg border border-border bg-surface-2 px-3 py-3">
                              <div className="text-[11px] uppercase tracking-[0.16em] text-muted">
                                TOS modifier
                              </div>
                              <div className="mt-1 text-lg font-semibold text-foreground">
                                {row.placement_context.top_of_search_modifier_pct === null
                                  ? '—'
                                  : `${row.placement_context.top_of_search_modifier_pct.toFixed(0)}%`}
                              </div>
                            </div>
                            <div className="rounded-lg border border-border bg-surface-2 px-3 py-3">
                              <div className="text-[11px] uppercase tracking-[0.16em] text-muted">
                                TOS IS
                              </div>
                              <div className="mt-1 text-lg font-semibold text-foreground">—</div>
                              <div className="mt-1 text-[11px] text-muted">
                                Not derived from placement performance facts.
                              </div>
                            </div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-lg border border-border bg-surface-2 px-3 py-3">
                              <div className="text-[11px] uppercase tracking-[0.16em] text-muted">
                                Top-of-search spend
                              </div>
                              <div className="mt-1 text-lg font-semibold text-foreground">
                                {formatCurrency(row.placement_context.spend)}
                              </div>
                              <div className="mt-1 text-[11px] text-muted">
                                Sales {formatCurrency(row.placement_context.sales)}
                              </div>
                            </div>
                            <div className="rounded-lg border border-border bg-surface-2 px-3 py-3">
                              <div className="text-[11px] uppercase tracking-[0.16em] text-muted">
                                Top-of-search clicks
                              </div>
                              <div className="mt-1 text-lg font-semibold text-foreground">
                                {formatNumber(row.placement_context.clicks)}
                              </div>
                              <div className="mt-1 text-[11px] text-muted">
                                Orders {formatNumber(row.placement_context.orders)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
                          No top-of-search placement context was found for this campaign in the selected range.
                        </div>
                      )}
                    </section>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
