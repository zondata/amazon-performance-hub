'use client';

import type { AdsOptimizerTargetReviewRow } from '@/lib/ads-optimizer/runtime';
import type { AdsOptimizerTargetRowSummary } from '@/lib/ads-optimizer/targetRowSummary';

const labelize = (value: string | null) =>
  value
    ? value
        .split(/[_\s]+/)
        .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : part))
        .join(' ')
    : 'Not captured';

const formatNumber = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

const coverageSummaryClass = (kind: 'ready' | 'partial' | 'missing', tone?: 'normal' | 'alert') => {
  if (kind === 'ready') return 'text-emerald-700';
  if (kind === 'partial') return 'text-muted';
  if (tone === 'normal') return 'text-amber-700';
  return 'text-rose-700';
};

const statePillClass = (
  kind: 'efficiency' | 'confidence' | 'importance',
  value: string | null
) => {
  if (kind === 'efficiency') {
    if (value === 'profitable') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    if (value === 'break_even') return 'border-amber-200 bg-amber-50 text-amber-800';
    if (value === 'converting_but_loss_making') {
      return 'border-rose-200 bg-rose-50 text-rose-800';
    }
    if (value === 'learning_no_sale') return 'border-sky-200 bg-sky-50 text-sky-800';
    return 'border-border bg-surface-2 text-muted';
  }

  if (kind === 'confidence') {
    if (value === 'confirmed') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    if (value === 'directional') return 'border-sky-200 bg-sky-50 text-sky-800';
    return 'border-border bg-surface-2 text-muted';
  }

  if (value === 'tier_1_dominant') return 'border-sky-200 bg-sky-50 text-sky-800';
  if (value === 'tier_2_core') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-border bg-surface-2 text-muted';
};

const rolePillClass = (value: string | null) => {
  if (value === 'Scale') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (value === 'Harvest') return 'border-sky-200 bg-sky-50 text-sky-800';
  if (value === 'Rank Push') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (value === 'Rank Defend') return 'border-violet-200 bg-violet-50 text-violet-800';
  if (value === 'Suppress') return 'border-rose-200 bg-rose-50 text-rose-800';
  if (value === 'Discover') return 'border-cyan-200 bg-cyan-50 text-cyan-800';
  return 'border-border bg-surface-2 text-muted';
};

const exceptionSeverityClass = (severity: 'high' | 'medium' | 'low') => {
  if (severity === 'high') return 'border-rose-200 bg-rose-50 text-rose-800';
  if (severity === 'medium') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-sky-200 bg-sky-50 text-sky-800';
};

type TargetSummaryRowProps = {
  row: AdsOptimizerTargetReviewRow;
  summary: AdsOptimizerTargetRowSummary;
  isActive: boolean;
  isSelected: boolean;
  isStageable: boolean;
  onSelect: () => void;
  onToggleSelect: (checked: boolean) => void;
};

export default function TargetSummaryRow(props: TargetSummaryRowProps) {
  const { row, summary } = props;
  const exceptionSignals = row.recommendation?.exceptionSignals ?? [];
  const coverageSummary = summary.coverage.summary;

  return (
    <tr
      className={`border-b border-border/60 align-top ${props.isActive ? 'bg-primary/5' : ''}`}
      data-target-row-id={summary.rowId}
      data-persisted-target-key={summary.persistedTargetKey}
    >
      <td className="px-3 py-2.5">
        <input
          type="checkbox"
          aria-label={`Select ${row.targetText} for Ads Workspace handoff`}
          checked={props.isSelected}
          disabled={!props.isStageable}
          onChange={(event) => props.onToggleSelect(event.target.checked)}
        />
      </td>
      <td
        className={`sticky left-0 z-10 px-3 py-2.5 shadow-[inset_-1px_0_0_theme(colors.border)] ${
          props.isActive ? 'bg-primary/5' : 'bg-surface'
        }`}
      >
        <button
          type="button"
          className="w-full text-left"
          aria-expanded={props.isActive}
          onClick={props.onSelect}
        >
          <div className="font-semibold text-foreground">{summary.targetText}</div>
          <div className="mt-0.5 line-clamp-1 text-xs text-muted">{summary.targetMeta}</div>
          <div className="mt-0.5 line-clamp-1 text-xs text-muted">{summary.parentMeta}</div>
          <div className="mt-2 grid gap-1 text-[11px] leading-tight text-muted">
            <div>{summary.economics.headline}</div>
            <div>{summary.economics.detail}</div>
            <div>{summary.role.summary}</div>
            <div>{summary.organicRank.label}</div>
            <div>{summary.searchTermDiagnosis.label}</div>
          </div>
        </button>
        <button
          type="button"
          className="mt-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"
          aria-expanded={props.isActive}
          onClick={props.onSelect}
        >
          {props.isActive ? 'Viewing' : 'Open'}
        </button>
        {summary.handoff.overrideBadgeLabel ? (
          <div className="mt-2 space-y-1">
            <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
              {summary.handoff.overrideBadgeLabel}
            </div>
            <div className="line-clamp-2 text-[11px] leading-tight text-muted">
              {summary.handoff.overrideNote}
            </div>
          </div>
        ) : null}
      </td>
      <td className="px-3 py-2.5 text-foreground">{summary.change.priorityLabel}</td>
      <td className="px-3 py-2.5">
        <div className="text-foreground">{formatNumber(summary.change.recommendationCount)}</div>
        <div className="mt-1 text-xs text-muted">{labelize(summary.change.primaryActionType)}</div>
      </td>
      <td className="px-3 py-2.5">
        <div className="text-foreground">{formatNumber(summary.handoff.workspaceActionCount)}</div>
        <div className="mt-1 text-xs text-muted">
          {summary.handoff.hasManualOverride
            ? 'Override bundle will stage'
            : summary.handoff.reviewOnlyActionCount > 0
              ? `${formatNumber(summary.handoff.reviewOnlyActionCount)} review-only`
              : 'Ready for handoff'}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div
          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${rolePillClass(
            summary.role.currentValue
          )}`}
        >
          {summary.role.currentLabel}
        </div>
        <div className="mt-1 text-[11px] text-muted">{summary.role.nextLabel}</div>
      </td>
      <td className="px-3 py-2.5">
        <div
          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statePillClass(
            'efficiency',
            summary.efficiency.value
          )}`}
        >
          {summary.efficiency.label}
        </div>
        <div className="mt-1 text-[11px] text-muted">{summary.contribution.label}</div>
      </td>
      <td className="px-3 py-2.5">
        <div
          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statePillClass(
            'confidence',
            summary.confidence.value
          )}`}
        >
          {summary.confidence.label}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div
          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statePillClass(
            'importance',
            summary.tier.value
          )}`}
        >
          {summary.tier.label}
        </div>
      </td>
      <td className="px-3 py-2.5 text-foreground">
        <div>{labelize(summary.change.spendDirection)}</div>
        <div className="mt-1 text-[11px] text-muted">{summary.change.summary}</div>
      </td>
      <td className="px-3 py-2.5">
        {exceptionSignals.length > 0 ? (
          <div className="space-y-2">
            <div className="text-foreground">{formatNumber(exceptionSignals.length)}</div>
            <div className="flex flex-wrap gap-1.5">
              {exceptionSignals.slice(0, 2).map((signal, index) => (
                <div
                  key={`${row.targetSnapshotId}:exception:${signal.type}:${index}`}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${exceptionSeverityClass(
                    signal.severity
                  )}`}
                >
                  {signal.severity}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted">No exceptions</div>
        )}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex max-w-[320px] flex-wrap gap-1.5">
          {summary.reasonCodeBadges.length > 0 ? (
            summary.reasonCodeBadges.map((code) => (
              <div
                key={`${row.targetSnapshotId}:${code}`}
                className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted"
              >
                {labelize(code)}
              </div>
            ))
          ) : (
            <span className="text-xs text-muted">No badges captured</span>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className="max-w-[260px] text-[11px] leading-tight">
          <span className={`font-semibold ${coverageSummaryClass('ready')}`}>
            Ready {coverageSummary.ready}
          </span>
          <span className="px-1 text-muted">·</span>
          <span className={`font-semibold ${coverageSummaryClass('partial')}`}>
            Partial {coverageSummary.partial}
          </span>
          <span className="px-1 text-muted">·</span>
          <span
            className={`font-semibold ${coverageSummaryClass(
              'missing',
              coverageSummary.missingSuspicious > 0 ? 'alert' : 'normal'
            )}`}
          >
            Missing {coverageSummary.missing}
          </span>
        </div>
        <details className="relative mt-1">
          <summary className="cursor-pointer list-none text-[11px] font-semibold leading-tight text-primary">
            Review coverage buckets
          </summary>
          <div className="absolute left-0 z-20 mt-2 w-[280px] rounded-xl border border-border bg-surface p-3 text-xs text-foreground shadow-lg">
            <div className="font-semibold">Coverage detail</div>
            <div className="mt-2 space-y-2 text-muted">
              <div>
                <span className="font-semibold text-foreground">Ready:</span>{' '}
                {coverageSummary.buckets.ready.join(', ') || 'None'}
              </div>
              <div>
                <span className="font-semibold text-foreground">Partial:</span>{' '}
                {coverageSummary.buckets.partial.join(', ') || 'None'}
              </div>
              <div>
                <span className="font-semibold text-foreground">Missing (normal):</span>{' '}
                {coverageSummary.buckets.expectedUnavailable.join(', ') || 'None'}
              </div>
              <div>
                <span className="font-semibold text-foreground">Missing (suspicious):</span>{' '}
                {coverageSummary.buckets.trueMissing.join(', ') || 'None'}
              </div>
            </div>
          </div>
        </details>
        {summary.coverage.criticalWarningCount > 0 ? (
          <div className="mt-1 text-[11px] leading-tight text-rose-700">
            {summary.coverage.criticalWarningCount} critical warning(s)
          </div>
        ) : summary.coverage.rowSpecificExceptionCount > 0 ? (
          <div className="mt-1 text-[11px] leading-tight text-amber-700">
            {summary.coverage.rowSpecificExceptionCount} row-specific exception(s)
          </div>
        ) : null}
      </td>
    </tr>
  );
}
