'use client';

import type { ReactNode } from 'react';

import type { AdsOptimizerTargetReviewRow } from '@/lib/ads-optimizer/runtime';
import type { AdsOptimizerTargetTableColumnWidths } from '@/lib/ads-optimizer/targetTableLayoutPrefs';
import type { AdsOptimizerTargetRowTableSummary } from '@/lib/ads-optimizer/targetRowTableSummary';

const toneClass = (tone: 'good' | 'bad' | 'neutral' | 'missing') => {
  if (tone === 'good') return 'text-emerald-700';
  if (tone === 'bad') return 'text-rose-700';
  if (tone === 'missing') return 'text-muted';
  return 'text-foreground';
};

const badgeClass = (tone: 'default' | 'priority' | 'override' = 'default') => {
  if (tone === 'priority') return 'border-sky-200 bg-sky-50 text-sky-800';
  if (tone === 'override') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-border bg-surface-2 text-muted';
};

const stateStatusClass = (value: string | null) => {
  if (value === 'profitable') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (value === 'break_even') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (value === 'converting_but_loss_making') return 'border-rose-200 bg-rose-50 text-rose-800';
  if (value === 'learning_no_sale') return 'border-sky-200 bg-sky-50 text-sky-800';
  return 'border-border bg-surface-2 text-muted';
};

const rankToneClass = (trend: string) => {
  if (trend === 'Rising') return 'text-emerald-700';
  if (trend === 'Decline') return 'text-rose-700';
  if (trend === 'Maintain') return 'text-foreground';
  return 'text-muted';
};

const metricLabelClass = 'text-[10px] font-medium tracking-wide text-muted';
const valueClass = (
  emphasis: 'current' | 'previous' | 'change',
  tone: 'good' | 'bad' | 'neutral' | 'missing',
  display: string
) => {
  const isMissing = tone === 'missing' || display === '—';
  if (emphasis === 'current') {
    return isMissing
      ? 'text-[12px] font-medium tabular-nums text-muted'
      : 'text-[13px] font-semibold tabular-nums text-foreground';
  }
  if (emphasis === 'previous') {
    return isMissing
      ? 'text-[11px] tabular-nums text-muted/80'
      : 'text-[12px] tabular-nums text-muted';
  }
  return `${toneClass(tone)} ${isMissing ? 'text-[11px] text-muted/80' : 'text-[12px] font-medium'} tabular-nums`;
};

const secondaryValueClass = (display: string) =>
  display === '—'
    ? 'text-[11px] tabular-nums text-muted/80'
    : 'text-[12px] font-medium tabular-nums text-foreground';

const Chevron = (props: { expanded: boolean }) => (
  <svg
    viewBox="0 0 16 16"
    aria-hidden="true"
    className={`mt-0.5 h-4 w-4 shrink-0 text-muted transition-transform ${props.expanded ? 'rotate-90' : ''}`}
    fill="currentColor"
  >
    <path d="M5 3.5v9L11.5 8 5 3.5Z" />
  </svg>
);

const ComparisonMatrix = (props: {
  rows: Array<{
    label: string;
    current: { display: string; tone: 'good' | 'bad' | 'neutral' | 'missing' };
    previous: { display: string; tone: 'good' | 'bad' | 'neutral' | 'missing' };
    change: { display: string; tone: 'good' | 'bad' | 'neutral' | 'missing' };
  }>;
}) => (
  <div className="grid w-full min-w-0 max-w-full grid-cols-[minmax(0,1.15fr)_repeat(3,minmax(0,1fr))] gap-x-3 gap-y-1.5 overflow-hidden text-[11px] leading-4">
    <div />
    <div className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-wide text-muted">
      Current
    </div>
    <div className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-wide text-muted">
      Previous
    </div>
    <div className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-wide text-muted">
      Change
    </div>
    {props.rows.map((metric) => (
      <div key={metric.label} className="contents">
        <div className={`min-w-0 break-words ${metricLabelClass}`}>{metric.label}</div>
        <div className={`min-w-0 truncate ${valueClass('current', metric.current.tone, metric.current.display)}`}>
          {metric.current.display}
        </div>
        <div className={`min-w-0 truncate ${valueClass('previous', metric.previous.tone, metric.previous.display)}`}>
          {metric.previous.display}
        </div>
        <div className={`min-w-0 truncate ${valueClass('change', metric.change.tone, metric.change.display)}`}>
          {metric.change.display}
        </div>
      </div>
    ))}
  </div>
);

type TargetSummaryRowProps = {
  row: AdsOptimizerTargetReviewRow;
  summary: AdsOptimizerTargetRowTableSummary;
  isActive: boolean;
  isSelected: boolean;
  isStageable: boolean;
  columnWidths: AdsOptimizerTargetTableColumnWidths;
  isTargetColumnFrozen: boolean;
  expandedContent?: ReactNode;
  colSpan: number;
  onSelect: () => void;
  onToggleSelect: (checked: boolean) => void;
};

export default function TargetSummaryRow(props: TargetSummaryRowProps) {
  const { row, summary } = props;
  const changeItems = summary.changeSummary.lines;
  const stickyCellBackground = props.isActive ? 'bg-primary/5' : 'bg-surface';
  const stateStatus = summary.stateComparison.rows[0];
  const columnStyle = (key: keyof AdsOptimizerTargetTableColumnWidths) => ({
    width: `${props.columnWidths[key]}px`,
    minWidth: `${props.columnWidths[key]}px`,
    maxWidth: `${props.columnWidths[key]}px`,
  });
  const targetColumnClass = props.isTargetColumnFrozen
    ? 'sticky left-0 z-20 shadow-[8px_0_12px_-12px_rgba(15,23,42,0.18)]'
    : '';

  return (
    <>
      <tr
        className={`border-b border-border/60 align-top ${props.isActive ? 'bg-primary/5' : ''}`}
        data-target-row-id={summary.rowId}
        data-persisted-target-key={summary.persistedTargetKey}
      >
        <td
          className={`${targetColumnClass} overflow-hidden border-r border-border/70 px-4 py-3 ${stickyCellBackground}`}
          style={columnStyle('target')}
        >
          <div className="flex min-w-0 max-w-full items-start gap-3 overflow-hidden">
            <input
              type="checkbox"
              aria-label={`Select ${row.targetText} for Ads Workspace handoff`}
              checked={props.isSelected}
              disabled={!props.isStageable}
              onChange={(event) => props.onToggleSelect(event.target.checked)}
            />
            <button
              type="button"
              className="min-w-0 max-w-full flex-1 overflow-hidden rounded-md px-1 py-1 text-left transition hover:bg-surface-2/70"
              aria-expanded={props.isActive}
              aria-controls={`target-inline-panel-${row.targetSnapshotId}`}
              onClick={props.onSelect}
            >
              <div className="flex min-w-0 max-w-full items-start gap-2 overflow-hidden">
                <Chevron expanded={props.isActive} />
                <div className="min-w-0 max-w-full flex-1">
                  <div className="line-clamp-2 text-sm font-semibold text-foreground">
                    {summary.identity.targetText}
                  </div>
                  <div className="mt-1 line-clamp-1 text-xs text-muted">
                    {summary.identity.targetKindLabel} · {summary.identity.matchTypeLabel} ·{' '}
                    {summary.identity.targetIdLabel}
                  </div>
                  <div className="mt-1 line-clamp-1 text-[11px] text-muted">
                    {summary.identity.campaignContextLabel}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeClass()}`}
                    >
                      {summary.identity.tierLabel}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeClass(
                        'priority'
                      )}`}
                    >
                      {summary.identity.priorityLabel}
                    </span>
                    {summary.identity.overrideBadgeLabel ? (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeClass(
                          'override'
                        )}`}
                      >
                        {summary.identity.overrideBadgeLabel}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${stateStatusClass(
                        summary.stateComparison.stateValue
                      )}`}
                    >
                      {stateStatus.current.display}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          </div>
        </td>

        <td
          className="overflow-hidden px-3 py-3 align-top"
          style={columnStyle('state')}
        >
          <ComparisonMatrix rows={summary.stateComparison.rows.slice(1)} />
        </td>

        <td
          className="overflow-hidden px-3 py-3 align-top"
          style={columnStyle('economics')}
        >
          <ComparisonMatrix rows={summary.economicsComparison.rows} />
        </td>

        <td
          className="overflow-hidden px-3 py-3 align-top"
          style={columnStyle('contribution')}
        >
          <div className="w-full min-w-0 max-w-full space-y-2 overflow-hidden text-[11px] leading-4">
            {summary.contribution.rows.map((entry) => (
              <div key={entry.label} className="flex min-w-0 items-start justify-between gap-2">
                <div className={`min-w-0 flex-1 truncate ${metricLabelClass}`}>{entry.label}</div>
                <div className="min-w-0 shrink-0 text-right">
                  <div
                    className={`truncate ${valueClass(
                      'current',
                      entry.share.tone,
                      entry.share.display
                    )}`}
                  >
                    {entry.share.display}
                  </div>
                  <div className={`truncate ${secondaryValueClass(entry.rank.display)}`}>
                    {entry.rank.display}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </td>

        <td className="overflow-hidden px-3 py-3 align-top" style={columnStyle('ranking')}>
          <div className="w-full min-w-0 max-w-full space-y-2 overflow-hidden text-[11px] leading-4">
            <div className="min-w-0">
              <div className={`truncate ${metricLabelClass}`}>Organic</div>
              <div
                className={`truncate ${valueClass(
                  'current',
                  summary.ranking.organic.latestRank === null ? 'missing' : 'neutral',
                  summary.ranking.organic.latestLabel
                )}`}
              >
                {summary.ranking.organic.latestLabel}
              </div>
              <div
                className={`${rankToneClass(summary.ranking.organic.trendLabel)} truncate text-[12px] font-medium`}
              >
                {summary.ranking.organic.trendLabel}
              </div>
            </div>
            <div className="min-w-0">
              <div className={`truncate ${metricLabelClass}`}>Sponsored</div>
              <div
                className={`truncate ${valueClass(
                  'current',
                  summary.ranking.sponsored.latestRank === null ? 'missing' : 'neutral',
                  summary.ranking.sponsored.latestLabel
                )}`}
              >
                {summary.ranking.sponsored.latestLabel}
              </div>
              <div
                className={`${rankToneClass(summary.ranking.sponsored.trendLabel)} truncate text-[12px] font-medium`}
              >
                {summary.ranking.sponsored.trendLabel}
              </div>
            </div>
          </div>
        </td>

        <td
          className="overflow-hidden px-3 py-3 align-top"
          style={columnStyle('role')}
        >
          <div className="w-full min-w-0 max-w-full space-y-2 overflow-hidden text-[11px] leading-4">
            <div className="min-w-0">
              <div className={metricLabelClass}>Current</div>
              <div className={`truncate ${secondaryValueClass(summary.role.currentLabel)}`}>
                {summary.role.currentLabel}
              </div>
            </div>
            <div className="min-w-0">
              <div className={metricLabelClass}>Next</div>
              <div className={`truncate ${secondaryValueClass(summary.role.nextLabel || '—')}`}>
                {summary.role.nextLabel || '—'}
              </div>
            </div>
          </div>
        </td>

        <td
          className="overflow-hidden px-3 py-3 align-top"
          style={columnStyle('change_summary')}
        >
          {changeItems.length === 0 ? (
            <div className="w-full min-w-0 max-w-full break-words text-[11px] text-muted">
              {summary.changeSummary.emptyMessage}
            </div>
          ) : (
            <div className="w-full min-w-0 max-w-full space-y-1.5 overflow-hidden text-[11px] leading-5">
              {changeItems.map((item) => (
                <div key={item} className="break-words text-foreground">
                  {item}
                </div>
              ))}
              {summary.changeSummary.overflowCount > 0 ? (
                <div className="break-words text-muted">
                  +{summary.changeSummary.overflowCount} more changes
                </div>
              ) : null}
            </div>
          )}
        </td>
      </tr>
      {props.expandedContent ? (
        <tr className="border-b border-border/60 bg-surface-2/35">
          <td colSpan={props.colSpan} className="px-3 pb-4 pt-0">
            {props.expandedContent}
          </td>
        </tr>
      ) : null}
    </>
  );
}
