'use client';

import { useMemo } from 'react';

import {
  buildAdsOptimizerSqpComparisonState,
  buildAdsOptimizerSqpEmptyState,
  buildAdsOptimizerSqpKpiRows,
  buildAdsOptimizerSqpSummaryLines,
  type AdsOptimizerSqpChangeTone,
  type AdsOptimizerSqpMetricCell,
  type AdsOptimizerSqpTableRow,
} from '@/lib/ads-optimizer/targetDecisionSurface';
import type { AdsOptimizerTargetReviewRow } from '@/lib/ads-optimizer/runtime';
import { formatUiDate } from '@/lib/time/formatUiDate';

import ExpandedTabTable, { type ColumnDef } from './ExpandedTabTable';

type TargetSqpTabProps = {
  row: AdsOptimizerTargetReviewRow;
};

const SQP_SCOPE_NOTE =
  'SQP is matched-query ASIN context. Targets that resolve to the same query can share the same SQP values.';
const STACKED_VALUE_LEGEND = 'Top = current · Middle = previous · Bottom = change %';
const CHANGE_LEGEND = 'Green = increase · Red = decrease · Gray = no change or unavailable';
const SQP_KPI_ROW_ORDER = [
  'Impression',
  'Impression share',
  'Click',
  'Click share',
  'CTR',
  'CVR',
  'Purchase',
  'Purchase share',
] as const;

const toneClass = (tone: AdsOptimizerSqpChangeTone) => {
  if (tone === 'favorable') return 'text-emerald-700';
  if (tone === 'unfavorable') return 'text-rose-700';
  return 'text-muted';
};

const formatWeekLabel = (weekEnd: string | null) =>
  weekEnd ? `Week ending ${formatUiDate(weekEnd)}` : '—';

const formatInteger = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

const formatPercent = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
};

const formatChangePercent = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  const rounded = Number(value.toFixed(1));
  if (rounded === 0 || Object.is(rounded, -0)) return '0.0%';
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}%`;
};

const formatTableValue = (row: AdsOptimizerSqpTableRow, value: number | null) =>
  row.kind === 'count' ? formatInteger(value) : formatPercent(value);

const renderMetricLines = (args: {
  row: AdsOptimizerSqpTableRow;
  metric: AdsOptimizerSqpMetricCell;
}) => (
  <>
    <div
      className={`metric-current text-[13px] font-medium ${
        args.metric.current === null || !Number.isFinite(args.metric.current)
          ? 'text-muted'
          : 'text-foreground'
      }`}
    >
      {formatTableValue(args.row, args.metric.current)}
    </div>
    <div className="metric-prev mt-[2px] text-[11px] text-muted">
      {formatTableValue(args.row, args.metric.previous)}
    </div>
    <div className={`metric-change mt-[1px] text-[11px] ${toneClass(args.metric.changeTone)}`}>
      {formatChangePercent(args.metric.changePercent)}
    </div>
  </>
);

const renderMetadataItem = (label: string, value: string) => (
  <span className="min-w-0">
    <span className="font-medium text-foreground">{label}</span> {value}
  </span>
);

export default function TargetSqpTab(props: TargetSqpTabProps) {
  const comparison = useMemo(() => buildAdsOptimizerSqpComparisonState(props.row), [props.row]);
  const summaryLines = useMemo(() => buildAdsOptimizerSqpSummaryLines(props.row), [props.row]);
  const kpiRows = useMemo(() => buildAdsOptimizerSqpKpiRows(props.row), [props.row]);
  const emptyState = useMemo(() => buildAdsOptimizerSqpEmptyState(props.row), [props.row]);

  const currentQueryDisplay =
    props.row.sqpDetail?.matchedQueryRaw ?? props.row.sqpDetail?.matchedQueryNorm ?? '—';
  const currentWeekLabel = formatWeekLabel(comparison.currentWeekEnd);
  const previousWeekLabel = formatWeekLabel(comparison.previousWeekEnd);
  const footerText = props.row.sqpDetail?.matchedQueryNorm
    ? SQP_SCOPE_NOTE
    : `${SQP_SCOPE_NOTE} ${emptyState}`;
  const sqpColumns: ColumnDef<AdsOptimizerSqpTableRow>[] = [
    {
      key: 'kpi',
      label: 'KPI',
      width: { strategy: 'content-fit', minPx: 100, maxPx: 180 },
      frozen: true,
      render: (row, rowIndex) => (
        <div className="text-[13px] font-medium text-foreground">
          {SQP_KPI_ROW_ORDER[rowIndex] ?? row.kpi}
        </div>
      ),
    },
    {
      key: 'market',
      label: 'Market',
      width: { strategy: 'content-fit', minPx: 100, maxPx: 200 },
      align: 'right',
      render: (row) => renderMetricLines({ row, metric: row.market }),
    },
    {
      key: 'self',
      label: 'Self',
      width: { strategy: 'content-fit', minPx: 100, maxPx: 200 },
      align: 'right',
      render: (row) => renderMetricLines({ row, metric: row.self }),
    },
  ];

  return (
    <div
      data-ads-optimizer-sqp-tab="true"
      className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)_auto]"
    >
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
        {renderMetadataItem('Matched SQP query:', currentQueryDisplay)}
        {renderMetadataItem('Current SQP week:', currentWeekLabel)}
        {renderMetadataItem('Previous comparable SQP week:', previousWeekLabel)}
        {renderMetadataItem('Comparison basis:', 'same matched query only')}
        {comparison.status === 'different_query' && comparison.note ? <span>{comparison.note}</span> : null}
      </div>

      <section className="mb-3">
        <h3 className="text-[12px] font-medium text-foreground">Summary</h3>
        <ul className="mt-1 space-y-[4px] text-[12px] leading-[1.6] text-foreground/80">
          {summaryLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="min-h-0 overflow-hidden">
        <div className="mb-2 space-y-[2px] text-[11px] text-muted">
          <div>{STACKED_VALUE_LEGEND}</div>
          <div>{CHANGE_LEGEND}</div>
        </div>
        <ExpandedTabTable
          columns={sqpColumns}
          rows={kpiRows}
          maxHeight={380}
          wrapperDataAttributes={{
            'data-aph-hscroll': '',
            'data-aph-hscroll-axis': 'x',
          }}
        />
      </section>

      <div className="pt-2 text-[11px] text-muted">{footerText}</div>
    </div>
  );
}
