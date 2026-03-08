import AdsWorkspaceGridTable, {
  type AdsWorkspaceGridColumn,
} from '@/components/ads/AdsWorkspaceGridTable';
import type { SpPlacementsWorkspaceRow } from '@/lib/ads/spWorkspaceTablesModel';
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

type SpPlacementsTableProps = {
  rows: SpPlacementsWorkspaceRow[];
  onOpenComposer?: (row: SpPlacementsWorkspaceRow) => void;
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

export default function SpPlacementsTable({
  rows,
  onOpenComposer,
  activeDraftName,
  showIds = false,
  surfaceSettings,
  settingsSaveStateLabel,
  onSurfaceSettingsChange,
  rowHighlightTones,
}: SpPlacementsTableProps) {
  const columns: AdsWorkspaceGridColumn<SpPlacementsWorkspaceRow>[] = [
    {
      key: 'ads_type',
      label: 'Type',
      width: 130,
      getSortValue: (row) => row.ads_type,
      renderCell: (row) => <span className="text-foreground">{row.ads_type}</span>,
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
      width: 260,
      defaultFrozen: true,
      supportsWrap: true,
      getSortValue: (row) => row.campaign_name,
      renderCell: (row, context) => (
        <div className="min-w-0">
          <div className={`font-medium text-foreground ${context.wrapLongLabels ? 'whitespace-normal break-words' : 'line-clamp-2 break-words'}`}>
            {row.campaign_name ?? '—'}
          </div>
          {showIds ? <div className="mt-1 text-xs text-muted">{row.campaign_id}</div> : null}
        </div>
      ),
    },
    {
      key: 'placement_label',
      label: 'Placement',
      width: 200,
      defaultFrozen: true,
      supportsWrap: true,
      getSortValue: (row) => row.placement_label,
      renderCell: (row, context) => (
        <div className="min-w-0">
          <div className={`font-semibold text-foreground ${context.wrapLongLabels ? 'whitespace-normal break-words' : 'line-clamp-2 break-words'}`}>
            {row.placement_label}
          </div>
          {showIds ? <div className="mt-1 text-xs text-muted">{row.placement_code}</div> : null}
          {row.coverage_label ? (
            <div className="mt-2 inline-flex rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
              {row.coverage_label}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'placement_modifier_pct',
      label: 'Placement modifier',
      width: 150,
      align: 'right',
      getSortValue: (row) => row.placement_modifier_pct,
      getNumericValue: (row) => row.placement_modifier_pct,
      renderCell: (row) =>
        row.placement_modifier_pct === null ? '—' : `${row.placement_modifier_pct.toFixed(0)}%`,
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
      width: 160,
      alwaysVisible: true,
      renderCell: (row) => (
        <div className="flex min-w-[140px] flex-col gap-2">
          <button
            type="button"
            onClick={() => onOpenComposer?.(row)}
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
      surfaceTitle="Placements"
      surfaceDescription="Placement rows stay campaign-scoped facts. Modifier edits change only the selected placement row."
      emptyMessage="No SP placements matched the current workspace filters."
      activeDraftName={activeDraftName}
      rows={rows}
      rowKey={(row) => row.id}
      columns={columns}
      surfaceSettings={surfaceSettings}
      settingsSaveStateLabel={settingsSaveStateLabel}
      onSurfaceSettingsChange={onSurfaceSettingsChange}
      rowClassName={(row) =>
        `border-b border-border last:border-b-0 ${stagedRowClassName(
          rowHighlightTones?.get(row.id)
        )}`.trim()
      }
    />
  );
}
