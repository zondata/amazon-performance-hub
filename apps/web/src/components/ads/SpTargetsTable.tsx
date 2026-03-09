import AdsWorkspaceGridTable, {
  type AdsWorkspaceGridColumn,
} from '@/components/ads/AdsWorkspaceGridTable';
import type { SpTargetsWorkspaceRow } from '@/lib/ads/spTargetsWorkspaceModel';
import type { AdsWorkspaceSurfaceSettings } from '@/lib/ads-workspace/adsWorkspaceUiSettings';
import type { SpActiveDraftRowTone } from '@/lib/ads-workspace/spActiveDraftHighlights';

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

type SpTargetsTableProps = {
  rows: SpTargetsWorkspaceRow[];
  onOpenComposer?: (row: SpTargetsWorkspaceRow) => void;
  activeDraftName?: string | null;
  showIds?: boolean;
  surfaceSettings?: AdsWorkspaceSurfaceSettings | null;
  settingsSaveStateLabel?: string | null;
  onSurfaceSettingsChange: (settings: AdsWorkspaceSurfaceSettings) => void;
  rowHighlightTones?: Map<string, SpActiveDraftRowTone>;
};

const stagedRowClassName = (tone: SpActiveDraftRowTone | undefined) =>
  tone === 'direct'
    ? 'border-l-4 border-l-stone-500/45 bg-stone-500/10 ring-1 ring-inset ring-stone-500/20'
    : tone === 'context'
      ? 'border-l-4 border-l-stone-400/25 bg-stone-500/5 ring-1 ring-inset ring-stone-400/12'
      : '';

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

export default function SpTargetsTable({
  rows,
  onOpenComposer,
  activeDraftName,
  showIds = false,
  surfaceSettings,
  settingsSaveStateLabel,
  onSurfaceSettingsChange,
  rowHighlightTones,
}: SpTargetsTableProps) {
  const columns: AdsWorkspaceGridColumn<SpTargetsWorkspaceRow>[] = [
    {
      key: 'target_text',
      label: 'Target',
      width: 320,
      defaultFrozen: true,
      supportsWrap: true,
      getSortValue: (row) => row.target_text,
      renderCell: (row, context) => (
        <div className="min-w-0">
          <div className={`font-semibold text-foreground ${context.wrapLongLabels ? 'whitespace-normal break-words' : 'line-clamp-2 break-words'}`}>
            {row.target_text}
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            {showIds ? <span className="text-[11px] text-muted">ID {row.target_id}</span> : null}
            {row.coverage_label ? (
              <span className="inline-flex rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                {row.coverage_label}
              </span>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: 110,
      defaultFrozen: true,
      getSortValue: (row) => row.status,
      renderCell: (row) => statusPill(row.status),
    },
    {
      key: 'type_label',
      label: 'Type',
      width: 156,
      supportsWrap: true,
      getSortValue: (row) => row.type_label,
      renderCell: (row, context) => (
        <div className="min-w-0">
          <div className={context.wrapLongLabels ? 'whitespace-normal break-all text-foreground' : 'line-clamp-2 break-all text-foreground'}>
            {row.type_label}
          </div>
        </div>
      ),
    },
    {
      key: 'portfolio_name',
      label: 'Portfolio',
      width: 180,
      supportsWrap: true,
      getSortValue: (row) => row.portfolio_name,
      renderCell: (row, context) => (
        <span className={context.wrapLongLabels ? 'whitespace-normal break-words text-foreground' : 'line-clamp-2 break-words text-foreground'}>
          {row.portfolio_name ?? '—'}
        </span>
      ),
    },
    {
      key: 'campaign_name',
      label: 'Campaign',
      width: 190,
      supportsWrap: true,
      getSortValue: (row) => row.campaign_name,
      renderCell: (row, context) => (
        <div className="min-w-0">
          <div className={context.wrapLongLabels ? 'whitespace-normal break-words text-foreground' : 'line-clamp-2 break-words text-foreground'}>
            {row.campaign_name ?? '—'}
          </div>
          {showIds ? <div className="mt-1 text-xs text-muted">{row.campaign_id}</div> : null}
        </div>
      ),
    },
    {
      key: 'ad_group_name',
      label: 'Ad group',
      width: 190,
      supportsWrap: true,
      getSortValue: (row) => row.ad_group_name,
      renderCell: (row, context) => (
        <div className="min-w-0">
          <div className={context.wrapLongLabels ? 'whitespace-normal break-words text-foreground' : 'line-clamp-2 break-words text-foreground'}>
            {row.ad_group_name ?? '—'}
          </div>
          {showIds ? <div className="mt-1 text-xs text-muted">{row.ad_group_id ?? '—'}</div> : null}
        </div>
      ),
    },
    {
      key: 'match_type',
      label: 'Match',
      width: 132,
      getSortValue: (row) => row.match_type,
      renderCell: (row, context) => (
        <div className="min-w-0">
          <div className={context.wrapLongLabels ? 'whitespace-normal break-all text-foreground' : 'line-clamp-2 break-all text-foreground'}>
            {row.match_type ?? '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'rank_context',
      label: 'Rank context',
      width: 138,
      align: 'right',
      getSortValue: (row) => row.rank_context?.organic_rank ?? null,
      getNumericValue: (row) => row.rank_context?.organic_rank ?? null,
      renderCell: (row) => (
        <div
          title="Rank is contextual to the selected ASIN and exact keyword coverage. It is not a target-owned performance metric."
        >
          {row.rank_context ? (
            <>
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted">Organic</div>
              <div className="font-semibold text-foreground">
                {formatRank(row.rank_context.organic_rank)}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted">
                Sponsored
              </div>
              <div className="text-foreground/80">
                {formatRank(row.rank_context.sponsored_rank)}
              </div>
            </>
          ) : (
            <>
              <div className="text-foreground">—</div>
              <div className="mt-1 text-[11px] text-muted">
                {row.rank_context_note ?? 'context gated'}
              </div>
            </>
          )}
        </div>
      ),
    },
    {
      key: 'stis',
      label: 'STIS',
      width: 95,
      align: 'right',
      getSortValue: (row) => row.stis,
      getNumericValue: (row) => row.stis,
      renderCell: (row) => (
        <div>
          <div className="text-foreground">{formatPercent(row.stis)}</div>
          <div className="mt-1 text-[11px] text-muted">latest target diagnostic</div>
        </div>
      ),
    },
    {
      key: 'stir',
      label: 'STIR',
      width: 110,
      align: 'right',
      getSortValue: (row) => row.stir,
      getNumericValue: (row) => row.stir,
      renderCell: (row) => (
        <div>
          <div className="text-foreground">{formatRank(row.stir)}</div>
          <div className="mt-1 text-[11px] text-muted">same-text, else best child</div>
        </div>
      ),
    },
    {
      key: 'tos_is',
      label: 'TOS IS',
      width: 110,
      align: 'right',
      getSortValue: (row) => row.tos_is,
      getNumericValue: (row) => row.tos_is,
      renderCell: () => (
        <div>
          <div className="text-foreground">—</div>
          <div className="mt-1 text-[11px] text-muted">campaign placement context below</div>
        </div>
      ),
    },
    {
      key: 'impressions',
      label: 'Impr.',
      width: 95,
      align: 'right',
      getSortValue: (row) => row.impressions,
      getNumericValue: (row) => row.impressions,
      renderCell: (row) => formatNumber(row.impressions),
    },
    {
      key: 'clicks',
      label: 'Clicks',
      width: 90,
      align: 'right',
      getSortValue: (row) => row.clicks,
      getNumericValue: (row) => row.clicks,
      renderCell: (row) => formatNumber(row.clicks),
    },
    {
      key: 'orders',
      label: 'Orders',
      width: 90,
      align: 'right',
      getSortValue: (row) => row.orders,
      getNumericValue: (row) => row.orders,
      renderCell: (row) => formatNumber(row.orders),
    },
    {
      key: 'units',
      label: 'Units',
      width: 100,
      align: 'right',
      getSortValue: (row) => row.units,
      getNumericValue: (row) => row.units,
      renderCell: (row) => formatNumber(row.units),
    },
    {
      key: 'sales',
      label: 'Sales',
      width: 100,
      align: 'right',
      getSortValue: (row) => row.sales,
      getNumericValue: (row) => row.sales,
      renderCell: (row) => formatCurrency(row.sales),
    },
    {
      key: 'conversion',
      label: 'Conv.',
      width: 90,
      align: 'right',
      getSortValue: (row) => row.conversion,
      getNumericValue: (row) => row.conversion,
      renderCell: (row) => formatPercent(row.conversion),
    },
    {
      key: 'spend',
      label: 'Spend',
      width: 90,
      align: 'right',
      getSortValue: (row) => row.spend,
      getNumericValue: (row) => row.spend,
      renderCell: (row) => formatCurrency(row.spend),
    },
    {
      key: 'cpc',
      label: 'CPC',
      width: 90,
      align: 'right',
      getSortValue: (row) => row.cpc,
      getNumericValue: (row) => row.cpc,
      renderCell: (row) => formatCurrency(row.cpc),
    },
    {
      key: 'ctr',
      label: 'CTR',
      width: 90,
      align: 'right',
      getSortValue: (row) => row.ctr,
      getNumericValue: (row) => row.ctr,
      renderCell: (row) => formatPercent(row.ctr),
    },
    {
      key: 'acos',
      label: 'ACOS',
      width: 110,
      align: 'right',
      getSortValue: (row) => row.acos,
      getNumericValue: (row) => row.acos,
      renderCell: (row) => formatPercent(row.acos),
    },
    {
      key: 'roas',
      label: 'ROAS',
      width: 110,
      align: 'right',
      getSortValue: (row) => row.roas,
      getNumericValue: (row) => row.roas,
      renderCell: (row) => formatDecimal(row.roas),
    },
    {
      key: 'pnl',
      label: 'P&L',
      width: 110,
      align: 'right',
      getSortValue: () => null,
      renderCell: () => (
        <div>
          <div className="text-muted">—</div>
          <div className="mt-1 text-[11px] text-muted">coverage gated</div>
        </div>
      ),
    },
    {
      key: 'break_even_bid',
      label: 'Break-even bid',
      width: 120,
      align: 'right',
      getSortValue: () => null,
      renderCell: () => (
        <div>
          <div className="text-muted">—</div>
          <div className="mt-1 text-[11px] text-muted">coverage gated</div>
        </div>
      ),
    },
    {
      key: 'last_activity',
      label: 'Last activity',
      width: 140,
      getSortValue: (row) => row.last_activity,
      renderCell: (row) => <span className="text-foreground">{row.last_activity ?? '—'}</span>,
    },
  ];

  return (
    <AdsWorkspaceGridTable
      surfaceTitle="Targets"
      surfaceDescription="Parent row totals stay on the target. Child rows keep search-term slices and campaign placement context stays separate."
      emptyMessage="No SP targets matched the current workspace filters."
      activeDraftName={activeDraftName}
      rows={rows}
      rowKey={(row) => row.target_id}
      columns={columns}
      surfaceSettings={surfaceSettings}
      settingsSaveStateLabel={settingsSaveStateLabel}
      onSurfaceSettingsChange={onSurfaceSettingsChange}
      rowClassName={(row) =>
        `border-b border-border last:border-b-0 ${stagedRowClassName(
          rowHighlightTones?.get(row.target_id)
        )}`.trim()
      }
      expandedRowClassName="border-t border-border border-l-[6px] border-l-border bg-surface-2 px-4 py-4 shadow-[inset_0_1px_0_rgba(0,0,0,0.08)]"
      renderExpanded={(row) => (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/90 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-muted">Draft staging</div>
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
                  <div className="text-xs uppercase tracking-[0.2em] text-muted">Search Terms</div>
                  <div className="mt-1 text-sm text-foreground">
                    Parent totals stay on the target row. Child rows stay as search-term slices.
                  </div>
                </div>
                <div className="text-xs text-muted">{row.search_terms.length.toLocaleString('en-US')} row(s)</div>
              </div>

              {row.search_terms.length === 0 ? (
                <div className="mt-4 rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
                  No search-term diagnostics for this target in the selected range.
                </div>
              ) : (
                <div className="mt-4 max-h-[320px] overflow-y-auto">
                  <div className="overflow-x-auto rounded-xl border border-border bg-background">
                    <table className="min-w-[980px] w-full text-left text-sm">
                      <thead className="sticky top-0 z-10 bg-surface text-[11px] uppercase tracking-[0.16em] text-muted">
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
                          <tr
                            key={child.id}
                            className="align-top bg-background transition odd:bg-surface-2/90 hover:bg-surface"
                          >
                            <td className="px-3 py-3">
                              <div className="font-medium text-foreground">{child.search_term}</div>
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
                </div>
              )}
            </section>

            <section className="rounded-xl border border-border bg-surface p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-muted">Campaign Placement Context</div>
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
                      <div className="text-[11px] uppercase tracking-[0.16em] text-muted">TOS modifier</div>
                      <div className="mt-1 text-lg font-semibold text-foreground">
                        {row.placement_context.top_of_search_modifier_pct === null
                          ? '—'
                          : `${row.placement_context.top_of_search_modifier_pct.toFixed(0)}%`}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-surface-2 px-3 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-muted">TOS IS</div>
                      <div className="mt-1 text-lg font-semibold text-foreground">—</div>
                      <div className="mt-1 text-[11px] text-muted">Not derived from placement performance facts.</div>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-border bg-surface-2 px-3 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Top-of-search spend</div>
                      <div className="mt-1 text-lg font-semibold text-foreground">
                        {formatCurrency(row.placement_context.spend)}
                      </div>
                      <div className="mt-1 text-[11px] text-muted">Sales {formatCurrency(row.placement_context.sales)}</div>
                    </div>
                    <div className="rounded-lg border border-border bg-surface-2 px-3 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Top-of-search clicks</div>
                      <div className="mt-1 text-lg font-semibold text-foreground">
                        {formatNumber(row.placement_context.clicks)}
                      </div>
                      <div className="mt-1 text-[11px] text-muted">Orders {formatNumber(row.placement_context.orders)}</div>
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
        </>
      )}
    />
  );
}
