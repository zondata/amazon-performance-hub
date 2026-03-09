import AdsWorkspaceGridTable, {
  type AdsWorkspaceGridColumn,
} from '@/components/ads/AdsWorkspaceGridTable';
import AdsWorkspaceRowActionsMenu, {
  type AdsWorkspaceRowActionItem,
} from '@/components/ads/AdsWorkspaceRowActionsMenu';
import type {
  SpSearchTermsWorkspaceChildRow,
  SpSearchTermsWorkspaceRow,
} from '@/lib/ads/spSearchTermsWorkspaceModel';
import type { AdsWorkspaceSurfaceSettings } from '@/lib/ads-workspace/adsWorkspaceUiSettings';

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

type SpSearchTermsTableProps = {
  rows: SpSearchTermsWorkspaceRow[];
  onOpenComposer?: (row: SpSearchTermsWorkspaceChildRow) => void;
  activeDraftName?: string | null;
  showIds?: boolean;
  getRowActions?: (row: SpSearchTermsWorkspaceRow) => AdsWorkspaceRowActionItem[];
  surfaceSettings?: AdsWorkspaceSurfaceSettings | null;
  settingsSaveStateLabel?: string | null;
  onSurfaceSettingsChange: (settings: AdsWorkspaceSurfaceSettings) => void;
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

export default function SpSearchTermsTable({
  rows,
  onOpenComposer,
  activeDraftName,
  showIds = false,
  getRowActions,
  surfaceSettings,
  settingsSaveStateLabel,
  onSurfaceSettingsChange,
}: SpSearchTermsTableProps) {
  const columns: AdsWorkspaceGridColumn<SpSearchTermsWorkspaceRow>[] = [
    {
      key: 'ads_type',
      label: 'Sponsored',
      width: 140,
      getSortValue: (row) => row.ads_type,
      renderCell: (row) => <span className="text-foreground">{row.ads_type}</span>,
    },
    {
      key: 'search_term',
      label: 'Search term',
      width: 360,
      defaultFrozen: true,
      supportsWrap: true,
      getSortValue: (row) => row.search_term,
      renderCell: (row, context) => (
        <div className="min-w-0">
          <div className={`font-semibold text-foreground ${context.wrapLongLabels ? 'whitespace-normal break-words' : 'line-clamp-2 break-words'}`}>
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
      ),
    },
    {
      key: 'impressions',
      label: 'Impr.',
      width: 110,
      align: 'right',
      getSortValue: (row) => row.impressions,
      getNumericValue: (row) => row.impressions,
      renderCell: (row) => formatNumber(row.impressions),
    },
    {
      key: 'clicks',
      label: 'Clicks',
      width: 110,
      align: 'right',
      getSortValue: (row) => row.clicks,
      getNumericValue: (row) => row.clicks,
      renderCell: (row) => formatNumber(row.clicks),
    },
    {
      key: 'orders',
      label: 'Orders',
      width: 110,
      align: 'right',
      getSortValue: (row) => row.orders,
      getNumericValue: (row) => row.orders,
      renderCell: (row) => formatNumber(row.orders),
    },
    {
      key: 'units',
      label: 'Units',
      width: 110,
      align: 'right',
      getSortValue: (row) => row.units,
      getNumericValue: (row) => row.units,
      renderCell: (row) => formatNumber(row.units),
    },
    {
      key: 'spend',
      label: 'Spend',
      width: 120,
      align: 'right',
      getSortValue: (row) => row.spend,
      getNumericValue: (row) => row.spend,
      renderCell: (row) => formatCurrency(row.spend),
    },
    {
      key: 'sales',
      label: 'Sales',
      width: 120,
      align: 'right',
      getSortValue: (row) => row.sales,
      getNumericValue: (row) => row.sales,
      renderCell: (row) => formatCurrency(row.sales),
    },
    {
      key: 'ctr',
      label: 'CTR',
      width: 110,
      align: 'right',
      getSortValue: (row) => row.ctr,
      getNumericValue: (row) => row.ctr,
      renderCell: (row) => formatPercent(row.ctr),
    },
    {
      key: 'cpc',
      label: 'CPC',
      width: 110,
      align: 'right',
      getSortValue: (row) => row.cpc,
      getNumericValue: (row) => row.cpc,
      renderCell: (row) => formatCurrency(row.cpc),
    },
    {
      key: 'cost_per_order',
      label: 'Cost / order',
      width: 130,
      align: 'right',
      getSortValue: (row) => row.cost_per_order,
      getNumericValue: (row) => row.cost_per_order,
      renderCell: (row) => formatCurrency(row.cost_per_order),
    },
    {
      key: 'conversion',
      label: 'Conv.',
      width: 110,
      align: 'right',
      getSortValue: (row) => row.conversion,
      getNumericValue: (row) => row.conversion,
      renderCell: (row) => formatPercent(row.conversion),
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
      width: 100,
      align: 'right',
      getSortValue: () => null,
      renderCell: () => <span className="text-muted">—</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      width: 180,
      alwaysVisible: true,
      renderCell: (row) => (
        <div className="flex min-w-[140px] flex-col gap-2">
          <AdsWorkspaceRowActionsMenu items={getRowActions?.(row) ?? []} />
          {row.coverage_note ? (
            <div className="text-xs text-muted">{row.coverage_note}</div>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <AdsWorkspaceGridTable
      surfaceTitle="Search Terms"
      surfaceDescription="Grouped by ASIN bucket and normalized search term before expanding into keyword or target detail."
      emptyMessage="No SP search terms matched the current workspace filters. This view depends on STIS coverage."
      activeDraftName={activeDraftName}
      rows={rows}
      rowKey={(row) => row.id}
      columns={columns}
      surfaceSettings={surfaceSettings}
      settingsSaveStateLabel={settingsSaveStateLabel}
      onSurfaceSettingsChange={onSurfaceSettingsChange}
      rowClassName="border-b border-border last:border-b-0"
      expandedRowClassName="border-t border-border border-l-[6px] border-l-border bg-surface-2 px-4 py-4 shadow-[inset_0_1px_0_rgba(0,0,0,0.08)]"
      renderExpanded={(row) => (
        <>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-background/90 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-muted">Search term detail rows</div>
              <div className="mt-1 text-sm text-foreground">
                Parent rows stay aggregated by ASIN bucket and normalized search term. Stage changes from the child row with the concrete keyword or target context.
              </div>
              <div className="mt-1 text-xs text-muted">
                {activeDraftName ? `Active draft: ${activeDraftName}` : 'A draft queue is created on first save.'}
              </div>
            </div>
            <div className="text-xs text-muted">{row.child_rows.length.toLocaleString('en-US')} child row(s)</div>
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
                        {showIds ? <div className="mt-1 text-xs text-muted">{child.campaign_id}</div> : null}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-foreground">{child.ad_group_name ?? '—'}</div>
                        {showIds ? <div className="mt-1 text-xs text-muted">{child.ad_group_id ?? '—'}</div> : null}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-foreground">{child.target_text}</div>
                        {showIds ? (
                          <div className="mt-1 text-xs text-muted">{child.target_id ?? child.target_key ?? 'No target id'}</div>
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
                          <div className="mt-2 max-w-[220px] text-xs text-muted">{child.coverage_note}</div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    />
  );
}
