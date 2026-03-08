import AdsWorkspaceGridTable, {
  type AdsWorkspaceGridColumn,
} from '@/components/ads/AdsWorkspaceGridTable';
import type { SpAdGroupsWorkspaceRow } from '@/lib/ads/spWorkspaceTablesModel';
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

type SpAdGroupsTableProps = {
  rows: SpAdGroupsWorkspaceRow[];
  onOpenComposer?: (row: SpAdGroupsWorkspaceRow) => void;
  activeDraftName?: string | null;
  showIds?: boolean;
  onDrilldownToTargets?: (row: SpAdGroupsWorkspaceRow) => void;
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

export default function SpAdGroupsTable({
  rows,
  onOpenComposer,
  activeDraftName,
  showIds = false,
  onDrilldownToTargets,
  surfaceSettings,
  settingsSaveStateLabel,
  onSurfaceSettingsChange,
  rowHighlightTones,
}: SpAdGroupsTableProps) {
  const columns: AdsWorkspaceGridColumn<SpAdGroupsWorkspaceRow>[] = [
    {
      key: 'ads_type',
      label: 'Ads type',
      width: 130,
      getSortValue: (row) => row.ads_type,
      renderCell: (row) => <span className="text-foreground">{row.ads_type}</span>,
    },
    {
      key: 'campaign_name',
      label: 'Campaign',
      width: 240,
      defaultFrozen: true,
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
      key: 'status',
      label: 'Status',
      width: 110,
      defaultFrozen: true,
      getSortValue: (row) => row.status,
      renderCell: (row) => statusPill(row.status),
    },
    {
      key: 'ad_group_name',
      label: 'Ad group',
      width: 240,
      defaultFrozen: true,
      supportsWrap: true,
      getSortValue: (row) => row.ad_group_name,
      renderCell: (row, context) => (
        <div className="min-w-0">
          <div className={`font-semibold text-foreground ${context.wrapLongLabels ? 'whitespace-normal break-words' : 'line-clamp-2 break-words'}`}>
            {row.ad_group_name}
          </div>
          {showIds ? <div className="mt-1 text-xs text-muted">{row.ad_group_id}</div> : null}
          {row.coverage_label ? (
            <div className="mt-2 inline-flex rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
              {row.coverage_label}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'default_bid',
      label: 'Default bid',
      width: 120,
      align: 'right',
      getSortValue: (row) => row.default_bid,
      getNumericValue: (row) => row.default_bid,
      renderCell: (row) => formatCurrency(row.default_bid),
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
      width: 100,
      align: 'right',
      getSortValue: (row) => row.clicks,
      getNumericValue: (row) => row.clicks,
      renderCell: (row) => formatNumber(row.clicks),
    },
    {
      key: 'orders',
      label: 'Orders',
      width: 95,
      align: 'right',
      getSortValue: (row) => row.orders,
      getNumericValue: (row) => row.orders,
      renderCell: (row) => formatNumber(row.orders),
    },
    {
      key: 'units',
      label: 'Units',
      width: 95,
      align: 'right',
      getSortValue: (row) => row.units,
      getNumericValue: (row) => row.units,
      renderCell: (row) => formatNumber(row.units),
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
      key: 'conversion',
      label: 'Conv.',
      width: 95,
      align: 'right',
      getSortValue: (row) => row.conversion,
      getNumericValue: (row) => row.conversion,
      renderCell: (row) => formatPercent(row.conversion),
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
      key: 'cpc',
      label: 'CPC',
      width: 100,
      align: 'right',
      getSortValue: (row) => row.cpc,
      getNumericValue: (row) => row.cpc,
      renderCell: (row) => formatCurrency(row.cpc),
    },
    {
      key: 'ctr',
      label: 'CTR',
      width: 95,
      align: 'right',
      getSortValue: (row) => row.ctr,
      getNumericValue: (row) => row.ctr,
      renderCell: (row) => formatPercent(row.ctr),
    },
    {
      key: 'acos',
      label: 'ACOS',
      width: 95,
      align: 'right',
      getSortValue: (row) => row.acos,
      getNumericValue: (row) => row.acos,
      renderCell: (row) => formatPercent(row.acos),
    },
    {
      key: 'roas',
      label: 'ROAS',
      width: 95,
      align: 'right',
      getSortValue: (row) => row.roas,
      getNumericValue: (row) => row.roas,
      renderCell: (row) => formatDecimal(row.roas),
    },
    {
      key: 'pnl',
      label: 'P&L',
      width: 95,
      align: 'right',
      getSortValue: () => null,
      renderCell: () => <span className="text-muted">—</span>,
    },
    {
      key: 'actions',
      label: 'Action',
      width: 170,
      alwaysVisible: true,
      renderCell: (row) => (
        <div className="flex min-w-[140px] flex-col gap-2">
          {onDrilldownToTargets ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDrilldownToTargets(row);
              }}
              className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground"
            >
              View targets
            </button>
          ) : null}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpenComposer?.(row);
            }}
            className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            Stage change
          </button>
          {row.coverage_note ? <div className="text-xs text-muted">{row.coverage_note}</div> : null}
        </div>
      ),
    },
  ];

  return (
    <AdsWorkspaceGridTable
      surfaceTitle="Ad Groups"
      surfaceDescription="Ad group totals are explicit SP targeting aggregations in the current facts layer."
      emptyMessage="No SP ad groups matched the current workspace filters."
      activeDraftName={activeDraftName}
      rows={rows}
      rowKey={(row) => row.ad_group_id}
      columns={columns}
      surfaceSettings={surfaceSettings}
      settingsSaveStateLabel={settingsSaveStateLabel}
      onSurfaceSettingsChange={onSurfaceSettingsChange}
      rowLinkRole={onDrilldownToTargets ? 'link' : undefined}
      onRowClick={onDrilldownToTargets}
      onRowKeyDown={(row, event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onDrilldownToTargets?.(row);
        }
      }}
      rowClassName={(row) =>
        `border-b border-border last:border-b-0 ${stagedRowClassName(
          rowHighlightTones?.get(row.ad_group_id)
        )}`.trim()
      }
    />
  );
}
