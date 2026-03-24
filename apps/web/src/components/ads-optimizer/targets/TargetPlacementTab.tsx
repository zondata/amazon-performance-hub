'use client';

import { useMemo, useState } from 'react';

import {
  buildAdsOptimizerPlacementCampaignTargetCount,
  buildAdsOptimizerPlacementTableRows,
  buildAdsOptimizerPlacementTotalsRow,
  type AdsOptimizerPlacementMetricCell,
  type AdsOptimizerPlacementTableRow,
} from '@/lib/ads-optimizer/targetDecisionSurface';
import type { AdsOptimizerTargetReviewRow } from '@/lib/ads-optimizer/runtime';
import { formatUiDate } from '@/lib/time/formatUiDate';

import ExpandedTabTable, {
  type ColumnDef,
  type SortState,
} from './ExpandedTabTable';

type TargetPlacementTabProps = {
  row: AdsOptimizerTargetReviewRow;
  allRows: AdsOptimizerTargetReviewRow[];
};

type PlacementSortKey =
  | 'impressions'
  | 'clicks'
  | 'ctr'
  | 'cvr'
  | 'cpc'
  | 'spend'
  | 'sales'
  | 'orders'
  | 'acos'
  | 'roas';

type PlacementSortDirection = 'asc' | 'desc';
type PlacementMetricKind = PlacementSortKey;

const SORT_LABELS: Record<PlacementSortKey, string> = {
  impressions: 'impressions',
  clicks: 'clicks',
  ctr: 'ctr',
  cvr: 'cvr',
  cpc: 'cpc',
  spend: 'spend',
  sales: 'sales',
  orders: 'orders',
  acos: 'acos',
  roas: 'roas',
};

const COVERAGE_LABELS: Record<string, string> = {
  ready: 'Ready',
  partial: 'Partial',
  expected_unavailable: 'Expected unavailable',
  true_missing: 'Missing',
  missing: 'Missing',
};

const getSortValue = (row: AdsOptimizerPlacementTableRow, key: PlacementSortKey) => {
  switch (key) {
    case 'impressions':
      return row.impressions.current;
    case 'clicks':
      return row.clicks.current;
    case 'ctr':
      return row.ctr.current;
    case 'cvr':
      return row.cvr.current;
    case 'cpc':
      return row.cpc.current;
    case 'spend':
      return row.spend.current;
    case 'sales':
      return row.sales.current;
    case 'orders':
      return row.orders.current;
    case 'acos':
      return row.acos.current;
    case 'roas':
      return row.roas.current;
  }
};

const isAbsentMetricValue = (value: number | null) =>
  value === null || !Number.isFinite(value) || value <= 0;

const formatInteger = (value: number | null, useGrouping = true) => {
  if (isAbsentMetricValue(value)) return '—';
  const numeric = value as number;
  return numeric.toLocaleString('en-US', {
    maximumFractionDigits: 0,
    useGrouping,
  });
};

const formatPercent = (value: number | null, fractionDigits: number) => {
  if (isAbsentMetricValue(value)) return '—';
  const numeric = value as number;
  return `${(numeric * 100).toFixed(fractionDigits)}%`;
};

const formatUsd = (value: number | null) => {
  if (isAbsentMetricValue(value)) return '—';
  const numeric = value as number;
  return numeric.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatRatio = (value: number | null) => {
  if (isAbsentMetricValue(value)) return '—';
  return (value as number).toFixed(2);
};

const formatWholeSharePercent = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${Math.round(value * 100)}%`;
};

const formatMetricValue = (kind: PlacementMetricKind, value: number | null) => {
  if (kind === 'impressions') return formatInteger(value, true);
  if (kind === 'clicks' || kind === 'orders') return formatInteger(value, false);
  if (kind === 'ctr') return formatPercent(value, 2);
  if (kind === 'cvr' || kind === 'acos') return formatPercent(value, 1);
  if (kind === 'cpc' || kind === 'spend' || kind === 'sales') return formatUsd(value);
  return formatRatio(value);
};

const getRoundedChangeValue = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(1));
};

const formatChangePercent = (value: number | null) => {
  const rounded = getRoundedChangeValue(value);
  if (rounded === null || rounded === 0 || Object.is(rounded, -0)) return '—';
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}%`;
};

const getChangeToneClass = (kind: PlacementMetricKind, value: number | null) => {
  const rounded = getRoundedChangeValue(value);
  if (rounded === null || rounded === 0 || Object.is(rounded, -0)) return 'text-muted';

  const positiveIsFavorable =
    kind === 'impressions' ||
    kind === 'clicks' ||
    kind === 'ctr' ||
    kind === 'cvr' ||
    kind === 'sales' ||
    kind === 'orders' ||
    kind === 'roas';

  if ((positiveIsFavorable && rounded > 0) || (!positiveIsFavorable && rounded < 0)) {
    return 'text-emerald-700';
  }

  return 'text-rose-700';
};

const renderMetricLines = (args: {
  kind: PlacementMetricKind;
  metric: AdsOptimizerPlacementMetricCell;
}) => (
  <>
    <div
      className={`metric-current text-[13px] font-medium ${
        isAbsentMetricValue(args.metric.current) ? 'text-muted' : 'text-foreground'
      }`}
    >
      {formatMetricValue(args.kind, args.metric.current)}
    </div>
    <div className="metric-prev text-[11px] text-muted">
      {formatMetricValue(args.kind, args.metric.previous)}
    </div>
    <div
      className={`metric-change text-[11px] ${
        args.metric.changePercent === null
          ? 'text-muted'
          : getChangeToneClass(args.kind, args.metric.changePercent)
      }`}
    >
      {formatChangePercent(args.metric.changePercent)}
    </div>
  </>
);

const renderEvidenceBadge = (evidence: AdsOptimizerPlacementTableRow['evidence']) => {
  const badgeProps =
    evidence === 'strong'
      ? {
          label: 'Strong',
          className: 'bg-[#EAF3DE] text-[#3B6D11]',
        }
      : evidence === 'weak'
        ? {
            label: 'Weak',
            className: 'bg-[#FCEBEB] text-[#A32D2D]',
          }
        : {
            label: 'Mixed',
            className: 'bg-surface-2 text-foreground/80',
          };

  return (
    <span
      className={`inline-block rounded-[4px] px-2 py-[2px] text-[10px] font-medium ${badgeProps.className}`}
    >
      {badgeProps.label}
    </span>
  );
};

const renderSharedBadgeIcon = (shared: boolean) =>
  shared ? (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className="h-3 w-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    >
      <circle cx="6" cy="6" r="4.5" />
      <line x1="3.5" y1="6" x2="8.5" y2="6" />
    </svg>
  ) : (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className="h-3 w-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    >
      <circle cx="6" cy="6" r="4.5" />
      <line x1="4" y1="4" x2="8" y2="8" />
      <line x1="8" y1="4" x2="4" y2="8" />
    </svg>
  );

export default function TargetPlacementTab(props: TargetPlacementTabProps) {
  const [showPreviousAndChange, setShowPreviousAndChange] = useState(true);
  const [sortKey, setSortKey] = useState<PlacementSortKey>('impressions');
  const [sortDirection, setSortDirection] = useState<PlacementSortDirection>('desc');

  const tableRows = useMemo(() => buildAdsOptimizerPlacementTableRows(props.row), [props.row]);
  const totalsRow = useMemo(() => buildAdsOptimizerPlacementTotalsRow(tableRows), [tableRows]);
  const campaignTargetCount = useMemo(
    () => buildAdsOptimizerPlacementCampaignTargetCount(props.allRows, props.row.campaignId),
    [props.allRows, props.row.campaignId]
  );

  const sortedRows = useMemo(() => {
    return [...tableRows].sort((left, right) => {
      const leftValue = getSortValue(left, sortKey);
      const rightValue = getSortValue(right, sortKey);
      const leftMissing = leftValue === null || !Number.isFinite(leftValue);
      const rightMissing = rightValue === null || !Number.isFinite(rightValue);

      if (leftMissing && rightMissing) {
        return left.placementName.localeCompare(right.placementName, 'en-US');
      }
      if (leftMissing) return 1;
      if (rightMissing) return -1;

      const delta =
        sortDirection === 'desc'
          ? (rightValue as number) - (leftValue as number)
          : (leftValue as number) - (rightValue as number);

      if (delta !== 0) return delta;
      return left.placementName.localeCompare(right.placementName, 'en-US');
    });
  }, [sortDirection, sortKey, tableRows]);

  const summaryCounts = useMemo(
    () => ({
      placementCount: tableRows.length,
      strong: tableRows.filter((row) => row.evidence === 'strong').length,
      weak: tableRows.filter((row) => row.evidence === 'weak').length,
      mixed: tableRows.filter((row) => row.evidence === 'mixed').length,
    }),
    [tableRows]
  );

  const handleSortChange = (nextSort: SortState) => {
    setSortKey(nextSort.key as PlacementSortKey);
    setSortDirection(nextSort.direction);
  };

  const tosIs = props.row.nonAdditiveDiagnostics.tosIs;
  const latestLabel = tosIs.latestObservedDate
    ? `Latest observed (${formatUiDate(tosIs.latestObservedDate)})`
    : 'Latest observed';
  const coverageLabel =
    COVERAGE_LABELS[props.row.coverage.statuses.tosIs] ?? COVERAGE_LABELS.missing;
  const deltaValue =
    tosIs.delta === null || !Number.isFinite(tosIs.delta) ? null : Math.round(tosIs.delta * 100);
  const deltaClass =
    deltaValue === null
      ? ''
      : deltaValue > 0
        ? 'bg-emerald-50 text-emerald-800'
        : deltaValue < 0
          ? 'bg-rose-50 text-rose-800'
          : 'bg-surface text-muted';
  const directionLabel =
    tosIs.direction === 'up'
      ? 'Higher'
      : tosIs.direction === 'down'
        ? 'Lower'
        : tosIs.direction === 'flat'
          ? 'Flat'
          : 'No comparison';
  const isSharedCampaign = campaignTargetCount > 1;
  const bidStrategyText =
    typeof props.row.currentCampaignBiddingStrategy === 'string' &&
    props.row.currentCampaignBiddingStrategy.trim().length > 0
      ? props.row.currentCampaignBiddingStrategy
      : 'Not captured';

  const placementColumns: ColumnDef<AdsOptimizerPlacementTableRow>[] = [
    {
      key: 'placement',
      label: 'Placement',
      width: { strategy: 'content-fit', minPx: 120, maxPx: 220 },
      frozen: true,
      render: (placement) => (
        <>
          <div className="text-[13px] font-medium text-foreground">{placement.placementName}</div>
          {placement.modifierPct !== null && placement.modifierPct !== 0 ? (
            <div className="mt-[2px] text-[10px] text-muted">
              Modifier: {placement.modifierPct > 0 ? '+' : ''}
              {Number.isInteger(placement.modifierPct)
                ? placement.modifierPct.toFixed(0)
                : placement.modifierPct.toFixed(1)}
              %
            </div>
          ) : null}
        </>
      ),
    },
    {
      key: 'bidStrategy',
      label: 'Bid strategy',
      width: { strategy: 'content-fit', minPx: 120, maxPx: 180 },
      render: () => (
        <div className="text-[11px] leading-[1.4] text-foreground/80">{bidStrategyText}</div>
      ),
    },
    {
      key: 'evidence',
      label: 'Evidence',
      width: { strategy: 'content-fit', minPx: 70, maxPx: 100 },
      render: (placement) => renderEvidenceBadge(placement.evidence),
    },
    {
      key: 'impressions',
      label: 'Impr.',
      width: { strategy: 'content-fit', minPx: 60, maxPx: 90 },
      align: 'right',
      sortable: true,
      render: (placement) => renderMetricLines({ kind: 'impressions', metric: placement.impressions }),
    },
    {
      key: 'clicks',
      label: 'Clicks',
      width: { strategy: 'content-fit', minPx: 55, maxPx: 80 },
      align: 'right',
      sortable: true,
      render: (placement) => renderMetricLines({ kind: 'clicks', metric: placement.clicks }),
    },
    {
      key: 'ctr',
      label: 'CTR',
      width: { strategy: 'content-fit', minPx: 60, maxPx: 85 },
      align: 'right',
      sortable: true,
      render: (placement) => renderMetricLines({ kind: 'ctr', metric: placement.ctr }),
    },
    {
      key: 'cvr',
      label: 'CVR',
      width: { strategy: 'content-fit', minPx: 60, maxPx: 85 },
      align: 'right',
      sortable: true,
      render: (placement) => renderMetricLines({ kind: 'cvr', metric: placement.cvr }),
    },
    {
      key: 'cpc',
      label: 'CPC',
      width: { strategy: 'content-fit', minPx: 60, maxPx: 90 },
      align: 'right',
      sortable: true,
      render: (placement) => renderMetricLines({ kind: 'cpc', metric: placement.cpc }),
    },
    {
      key: 'spend',
      label: 'Spend',
      width: { strategy: 'content-fit', minPx: 65, maxPx: 100 },
      align: 'right',
      sortable: true,
      render: (placement) => renderMetricLines({ kind: 'spend', metric: placement.spend }),
    },
    {
      key: 'sales',
      label: 'Sales',
      width: { strategy: 'content-fit', minPx: 65, maxPx: 100 },
      align: 'right',
      sortable: true,
      render: (placement) => renderMetricLines({ kind: 'sales', metric: placement.sales }),
    },
    {
      key: 'orders',
      label: 'Orders',
      width: { strategy: 'content-fit', minPx: 55, maxPx: 80 },
      align: 'right',
      sortable: true,
      render: (placement) => renderMetricLines({ kind: 'orders', metric: placement.orders }),
    },
    {
      key: 'acos',
      label: 'ACOS',
      width: { strategy: 'content-fit', minPx: 60, maxPx: 90 },
      align: 'right',
      sortable: true,
      render: (placement) => renderMetricLines({ kind: 'acos', metric: placement.acos }),
    },
    {
      key: 'roas',
      label: 'ROAS',
      width: { strategy: 'content-fit', minPx: 55, maxPx: 80 },
      align: 'right',
      sortable: true,
      render: (placement) => renderMetricLines({ kind: 'roas', metric: placement.roas }),
    },
  ];

  return (
    <div
      data-ads-optimizer-placement-tab="true"
      className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)_auto]"
    >
      <div className="mb-3 flex gap-3">
        <section className="flex-[0_0_340px] rounded-lg bg-surface-2 px-[14px] py-[10px]">
          <div className="mb-[6px] text-[10px] font-medium tracking-[0.3px] text-muted uppercase">
            TOP OF SEARCH IMPRESSION SHARE (TOS IS)
          </div>
          <div className="mb-2 flex items-start justify-between">
            <div>
              <div className="text-[22px] leading-none font-medium text-foreground">
                {formatWholeSharePercent(tosIs.latestValue)}
              </div>
              <div className="mt-[2px] text-[10px] text-muted">{latestLabel}</div>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end text-[16px] leading-none font-medium text-muted">
                <span>{formatWholeSharePercent(tosIs.previousValue)}</span>
                {deltaValue !== null ? (
                  <span
                    className={`ml-[6px] rounded-[4px] px-[6px] py-[1px] text-[11px] font-medium ${deltaClass}`}
                  >
                    {deltaValue > 0 ? '+' : ''}
                    {deltaValue}pp
                  </span>
                ) : null}
              </div>
              <div className="mt-[2px] text-[10px] text-muted">Previous observed</div>
            </div>
          </div>
          <div className="text-[10px] leading-[1.5] text-muted">
            Non-additive diagnostic. Latest and previous are the two most recent observed TOS IS
            values in-window. No window average is synthesized.
          </div>
          <div className="mt-2 flex gap-[10px] border-t border-border/70 pt-[6px]">
            <div>
              <div className="text-[9px] tracking-[0.2px] text-muted uppercase">Observed days</div>
              <div className="mt-[1px] text-[10px] text-foreground">{tosIs.observedDays}</div>
            </div>
            <div>
              <div className="text-[9px] tracking-[0.2px] text-muted uppercase">Direction</div>
              <div className="mt-[1px] text-[10px] text-foreground">{directionLabel}</div>
            </div>
            <div>
              <div className="text-[9px] tracking-[0.2px] text-muted uppercase">Coverage</div>
              <div className="mt-[1px] text-[10px] text-foreground">{coverageLabel}</div>
            </div>
          </div>
        </section>

        <section className="flex-1 rounded-lg bg-surface-2 px-[14px] py-[10px]">
          <div className="mb-[6px] text-[10px] font-medium tracking-[0.3px] text-muted uppercase">
            CAMPAIGN CONTEXT
          </div>
          <div className="text-[12px] leading-[1.6] text-foreground/80">
            {isSharedCampaign ? (
              <>
                This campaign contains{' '}
                <strong className="font-medium text-foreground">{campaignTargetCount}</strong>{' '}
                targets — all targets share the same placement metrics and bid strategy. Changes to
                placement modifiers affect all targets in this campaign.
              </>
            ) : (
              <>
                This is the only target in this campaign. Placement data reflects this campaign for
                one target only. Changes to placement modifiers affect only this target.
              </>
            )}
          </div>
          <div className="mt-[6px]">
            <span
              className={`inline-flex items-center gap-1 rounded-[4px] px-2 py-[2px] text-[11px] font-medium ${
                isSharedCampaign ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'
              }`}
            >
              {renderSharedBadgeIcon(isSharedCampaign)}
              {isSharedCampaign
                ? `Shared across ${campaignTargetCount} targets`
                : 'Exclusive to this target'}
            </span>
          </div>
        </section>
      </div>

      <div className="mb-[10px] flex items-center justify-between">
        <div className="flex items-center gap-2 whitespace-nowrap text-[10px] text-muted">
          <span>Top = current · Middle = previous · Bottom = change %</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-[5px]">
            <span className="h-[6px] w-[6px] rounded-full bg-emerald-600" />
            Favorable
          </span>
          <span className="inline-flex items-center gap-[5px]">
            <span className="h-[6px] w-[6px] rounded-full bg-rose-600" />
            Unfavorable
          </span>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={showPreviousAndChange}
          onClick={() => setShowPreviousAndChange((current) => !current)}
          className="flex items-center gap-[6px] text-[11px]"
        >
          <span
            className={`relative h-4 w-[30px] rounded-full transition-colors duration-200 ${
              showPreviousAndChange ? 'bg-primary' : 'bg-border'
            }`}
          >
            <span
              className={`absolute left-[2px] top-[2px] h-3 w-3 rounded-full bg-white transition-transform duration-200 ${
                showPreviousAndChange ? 'translate-x-[14px]' : ''
              }`}
            />
          </span>
          <span
            className={`transition-colors duration-150 ${
              showPreviousAndChange ? 'text-primary' : 'text-foreground/80'
            }`}
          >
            Previous &amp; change
          </span>
        </button>
      </div>

      <div className="min-h-0">
        <style>{`
          [data-ads-optimizer-placement-tab='true'] [data-expanded-tab-table-row='data'] .metric-prev,
          [data-ads-optimizer-placement-tab='true'] [data-expanded-tab-table-row='data'] .metric-change {
            transition: opacity 0.15s ease, max-height 0.2s ease, margin-top 0.15s ease;
            overflow: hidden;
          }
          [data-ads-optimizer-placement-tab='true'] [data-show-previous-change='true'] [data-expanded-tab-table-row='data'] .metric-prev {
            opacity: 1;
            max-height: 24px;
            margin-top: 2px;
          }
          [data-ads-optimizer-placement-tab='true'] [data-show-previous-change='true'] [data-expanded-tab-table-row='data'] .metric-change {
            opacity: 1;
            max-height: 24px;
            margin-top: 1px;
          }
          [data-ads-optimizer-placement-tab='true'] [data-show-previous-change='false'] [data-expanded-tab-table-row='data'] .metric-prev,
          [data-ads-optimizer-placement-tab='true'] [data-show-previous-change='false'] [data-expanded-tab-table-row='data'] .metric-change {
            opacity: 0;
            max-height: 0;
            margin-top: 0;
          }
        `}</style>

        <ExpandedTabTable
          columns={placementColumns}
          rows={sortedRows}
          sort={{ key: sortKey, direction: sortDirection }}
          onSortChange={handleSortChange}
          maxHeight={380}
          totalRow={{
            render: (column) => {
              switch (column.key) {
                case 'placement':
                  return (
                    <div className="text-[12px] font-medium text-foreground/80">
                      Total: {totalsRow.placementCount}
                    </div>
                  );
                case 'impressions':
                  return (
                    <div className="text-[13px] font-medium text-foreground">
                      {formatMetricValue('impressions', totalsRow.impressions)}
                    </div>
                  );
                case 'clicks':
                  return (
                    <div className="text-[13px] font-medium text-foreground">
                      {formatMetricValue('clicks', totalsRow.clicks)}
                    </div>
                  );
                case 'ctr':
                  return (
                    <div className="text-[13px] font-medium text-foreground">
                      {formatMetricValue('ctr', totalsRow.ctr)}
                    </div>
                  );
                case 'cvr':
                  return (
                    <div className="text-[13px] font-medium text-foreground">
                      {formatMetricValue('cvr', totalsRow.cvr)}
                    </div>
                  );
                case 'cpc':
                  return (
                    <div className="text-[13px] font-medium text-foreground">
                      {formatMetricValue('cpc', totalsRow.cpc)}
                    </div>
                  );
                case 'spend':
                  return (
                    <div className="text-[13px] font-medium text-foreground">
                      {formatMetricValue('spend', totalsRow.spend)}
                    </div>
                  );
                case 'sales':
                  return (
                    <div className="text-[13px] font-medium text-foreground">
                      {formatMetricValue('sales', totalsRow.sales)}
                    </div>
                  );
                case 'orders':
                  return (
                    <div className="text-[13px] font-medium text-foreground">
                      {formatMetricValue('orders', totalsRow.orders)}
                    </div>
                  );
                case 'acos':
                  return (
                    <div className="text-[13px] font-medium text-foreground">
                      {formatMetricValue('acos', totalsRow.acos)}
                    </div>
                  );
                case 'roas':
                  return (
                    <div className="text-[13px] font-medium text-foreground">
                      {formatMetricValue('roas', totalsRow.roas)}
                    </div>
                  );
                default:
                  return null;
              }
            },
          }}
          wrapperDataAttributes={{
            'data-show-previous-change': showPreviousAndChange ? 'true' : 'false',
            'data-aph-hscroll': '',
            'data-aph-hscroll-axis': 'x',
          }}
        />
      </div>

      <div className="flex items-center justify-between pt-2 text-[11px] text-muted">
        <div>
          {summaryCounts.placementCount} placements · {summaryCounts.strong} strong ·{' '}
          {summaryCounts.weak} weak · {summaryCounts.mixed} mixed
        </div>
        <div>
          Sorted by {SORT_LABELS[sortKey]} ({sortDirection})
        </div>
      </div>
    </div>
  );
}
