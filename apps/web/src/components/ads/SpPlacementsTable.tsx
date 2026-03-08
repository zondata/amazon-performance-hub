import type { SpPlacementsWorkspaceRow } from '@/lib/ads/spWorkspaceTablesModel';

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
};

export default function SpPlacementsTable({
  rows,
  onOpenComposer,
  activeDraftName,
  showIds = false,
}: SpPlacementsTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface/80 px-5 py-10 text-sm text-muted">
        No SP placements matched the current workspace filters.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface/80 shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted">Placements</div>
            <div className="mt-1 text-sm text-foreground">
              Placement rows stay campaign-scoped facts. Modifier edits change only the selected placement row.
            </div>
          </div>
          <div className="text-xs text-muted">
            {activeDraftName ? `Active draft: ${activeDraftName}` : 'A draft queue is created on first save.'}
          </div>
        </div>
      </div>
      <div data-aph-hscroll data-aph-hscroll-axis="x" className="max-h-[760px] overflow-auto">
        <table className="min-w-[1820px] w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-surface text-[11px] uppercase tracking-[0.18em] text-muted">
            <tr className="border-b border-border">
              {[
                'Type',
                'Portfolio',
                'Campaign',
                'Placement',
                'Placement modifier',
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
                'Action',
              ].map((label) => (
                <th key={label} className="bg-surface px-3 py-3 font-semibold">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id} className="align-top bg-surface/70 hover:bg-surface-2/60">
                <td className="px-3 py-3 text-foreground">{row.ads_type}</td>
                <td className="px-3 py-3 text-foreground">{row.portfolio_name ?? '—'}</td>
                <td className="px-3 py-3">
                  <div className="font-medium text-foreground">{row.campaign_name ?? '—'}</div>
                  {showIds ? <div className="mt-1 text-xs text-muted">{row.campaign_id}</div> : null}
                </td>
                <td className="px-3 py-3">
                  <div className="font-semibold text-foreground">{row.placement_label}</div>
                  {showIds ? <div className="mt-1 text-xs text-muted">{row.placement_code}</div> : null}
                  {row.coverage_label ? (
                    <div className="mt-2 inline-flex rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                      {row.coverage_label}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-foreground">
                  {row.placement_modifier_pct === null ? '—' : `${row.placement_modifier_pct.toFixed(0)}%`}
                </td>
                <td className="px-3 py-3 text-foreground">{formatNumber(row.impressions)}</td>
                <td className="px-3 py-3 text-foreground">{formatNumber(row.clicks)}</td>
                <td className="px-3 py-3 text-foreground">{formatNumber(row.orders)}</td>
                <td className="px-3 py-3 text-foreground">{formatNumber(row.units)}</td>
                <td className="px-3 py-3 text-foreground">{formatCurrency(row.sales)}</td>
                <td className="px-3 py-3 text-foreground">{formatPercent(row.conversion)}</td>
                <td className="px-3 py-3 text-foreground">{formatCurrency(row.spend)}</td>
                <td className="px-3 py-3 text-foreground">{formatCurrency(row.cpc)}</td>
                <td className="px-3 py-3 text-foreground">{formatPercent(row.ctr)}</td>
                <td className="px-3 py-3 text-foreground">{formatPercent(row.acos)}</td>
                <td className="px-3 py-3 text-foreground">{formatDecimal(row.roas)}</td>
                <td className="px-3 py-3 text-muted">—</td>
                <td className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => onOpenComposer?.(row)}
                    className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                  >
                    Stage change
                  </button>
                  {row.coverage_note ? (
                    <div className="mt-2 max-w-[220px] text-xs text-muted">{row.coverage_note}</div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
