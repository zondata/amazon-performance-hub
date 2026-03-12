'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { getOutcomePillClassName } from '@/lib/logbook/outcomePill';

import type {
  AdsOptimizerOutcomeReviewData,
  AdsOptimizerOutcomeReviewMetric,
  AdsOptimizerOutcomeReviewSegmentFilter,
  AdsOptimizerOutcomeReviewPhaseStatus,
  AdsOptimizerOutcomeReviewPhaseSummary,
  AdsOptimizerOutcomeReviewTrendPoint,
} from '@/lib/ads-optimizer/outcomeReviewTypes';
import {
  ADS_OPTIMIZER_OUTCOME_REVIEW_HORIZONS,
  ADS_OPTIMIZER_OUTCOME_REVIEW_METRIC_LABELS,
  ADS_OPTIMIZER_OUTCOME_REVIEW_METRICS,
} from '@/lib/ads-optimizer/outcomeReviewTypes';
import { filterAdsOptimizerOutcomeReviewSegments } from '@/lib/ads-optimizer/outcomeReviewScoring';
import { formatUiDateRange, formatUiDateTime } from '@/lib/time/formatUiDate';

type OptimizerOutcomeReviewPanelProps = {
  asin: string;
  start: string;
  end: string;
  data: AdsOptimizerOutcomeReviewData;
};

const METRIC_KIND: Record<AdsOptimizerOutcomeReviewMetric, 'currency' | 'percent' | 'number'> = {
  contribution_after_ads: 'currency',
  tacos: 'percent',
  ad_spend: 'currency',
  ad_sales: 'currency',
  total_sales: 'currency',
  orders: 'number',
};

const formatCurrency = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2,
  });
};

const formatNumber = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    maximumFractionDigits: value >= 100 ? 0 : 1,
  });
};

const formatPercent = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
};

const formatMetricValue = (metric: AdsOptimizerOutcomeReviewMetric, value: number | null) => {
  const kind = METRIC_KIND[metric];
  if (kind === 'currency') return formatCurrency(value);
  if (kind === 'percent') return formatPercent(value);
  return formatNumber(value);
};

const formatDateLabel = (value: string) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const getPhaseStatusClass = (status: AdsOptimizerOutcomeReviewPhaseStatus) => {
  if (status === 'validated') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'partial') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'mixed_validation') return 'border-rose-200 bg-rose-50 text-rose-800';
  return 'border-border bg-surface-2 text-muted';
};

const SEGMENT_FILTER_OPTIONS: Array<{
  value: AdsOptimizerOutcomeReviewSegmentFilter;
  label: string;
}> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'improving', label: 'Improving' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'confirmed_win', label: 'Confirmed win' },
  { value: 'confirmed_loss', label: 'Confirmed loss' },
];

const formatScoreLabel = (value: string) => value.replace(/_/g, ' ');

const getCautionClass = (cautionCount: number) =>
  cautionCount > 0
    ? 'border-amber-200 bg-amber-50 text-amber-900'
    : 'border-border bg-surface-2 text-muted';

const buildTrendBars = (
  points: AdsOptimizerOutcomeReviewTrendPoint[],
  metric: AdsOptimizerOutcomeReviewMetric
) => {
  const values = points.map((point) => point[metric]);
  const finite = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (finite.length === 0) {
    return {
      baselinePct: 100,
      heights: values.map(() => 0),
      direction: values.map(() => 'missing' as const),
    };
  }

  const max = Math.max(...finite);
  const min = Math.min(...finite);
  const hasNegative = min < 0;
  const positiveMax = Math.max(max, 0);
  const negativeMax = Math.max(Math.abs(min), 0);
  const denominator = Math.max(positiveMax + negativeMax, 1);
  const baselinePct = hasNegative ? (positiveMax / denominator) * 100 : 100;

  return {
    baselinePct,
    heights: values.map((value) => {
      if (value === null || !Number.isFinite(value)) return 0;
      if (value < 0) {
        return (Math.abs(value) / Math.max(negativeMax, 1)) * (100 - baselinePct);
      }
      return (value / Math.max(positiveMax, 1)) * baselinePct;
    }),
    direction: values.map((value) => {
      if (value === null || !Number.isFinite(value)) return 'missing' as const;
      return value < 0 ? ('negative' as const) : ('positive' as const);
    }),
  };
};

const KpiCard = (props: { label: string; value: string; detail?: string; active?: boolean }) => (
  <div
    className={`rounded-xl border px-4 py-4 ${
      props.active ? 'border-primary bg-primary/5' : 'border-border bg-surface'
    }`}
  >
    <div className="text-xs uppercase tracking-[0.2em] text-muted">{props.label}</div>
    <div className="mt-2 text-lg font-semibold text-foreground">{props.value}</div>
    {props.detail ? <div className="mt-1 text-sm text-muted">{props.detail}</div> : null}
  </div>
);

export default function OptimizerOutcomeReviewPanel(
  props: OptimizerOutcomeReviewPanelProps
) {
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(
    props.data.phases.find((phase) => phase.validatedEffectiveDate)?.changeSetId ??
      props.data.phases[0]?.changeSetId ??
      null
  );
  const [segmentFilter, setSegmentFilter] =
    useState<AdsOptimizerOutcomeReviewSegmentFilter>('all');

  const selectedPhase =
    props.data.phases.find((phase) => phase.changeSetId === selectedPhaseId) ?? null;
  const selectedSegment =
    props.data.segments.find((segment) => segment.phaseChangeSetId === selectedPhaseId) ?? null;
  const phasesByDate = useMemo(() => {
    const map = new Map<string, AdsOptimizerOutcomeReviewPhaseSummary[]>();
    props.data.phases.forEach((phase) => {
      if (!phase.validatedEffectiveDate) return;
      const bucket = map.get(phase.validatedEffectiveDate) ?? [];
      bucket.push(phase);
      map.set(phase.validatedEffectiveDate, bucket);
    });
    return map;
  }, [props.data.phases]);
  const trendBars = useMemo(
    () => buildTrendBars(props.data.displayedTrendPoints, props.data.metric),
    [props.data.displayedTrendPoints, props.data.metric]
  );
  const filteredSegments = useMemo(
    () => filterAdsOptimizerOutcomeReviewSegments(props.data.segments, segmentFilter),
    [props.data.segments, segmentFilter]
  );

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="text-xs uppercase tracking-[0.3em] text-muted">Outcome Review</div>
        <div className="mt-2 text-lg font-semibold text-foreground">
          Review validated optimizer lineage for {props.asin}
        </div>
        <div className="mt-2 max-w-4xl text-sm text-muted">
          Read optimizer-originated handoff phases against validated logbook lineage, then review
          segment scores across the selected window. This surface stays read-only and keeps score
          confidence lower whenever validation, KPI coverage, or visibility evidence is thin.
        </div>
        <details className="mt-4 rounded-xl border border-border bg-surface px-4 py-4">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">
            How to read this page
          </summary>
          <div className="mt-4 space-y-3 text-sm text-muted">
            <div>
              <span className="font-semibold text-foreground">What this page is:</span> a read-only
              review of optimizer-originated Ads Workspace phases, validated dates, and KPI movement.
            </div>
            <div>
              <span className="font-semibold text-foreground">How to read phase markers:</span>{' '}
              marker buttons sit on validated effective dates; click one to highlight its linked
              phase and segment summary.
            </div>
            <div>
              <span className="font-semibold text-foreground">What the score means:</span> it is a
              deterministic 0-100 objective-aware score built from before, after, and latest KPI
              windows.
            </div>
            <div>
              <span className="font-semibold text-foreground">Why some phases are too early:</span>{' '}
              incomplete validation, short post-phase windows, or missing KPI/rank evidence keep the
              score provisional.
            </div>
          </div>
        </details>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <KpiCard
          label="Contribution after ads"
          value={formatCurrency(props.data.displayedSummary.contribution_after_ads)}
          detail={`Last ${props.data.horizon} days in the selected range`}
          active={props.data.metric === 'contribution_after_ads'}
        />
        <KpiCard
          label="TACOS"
          value={formatPercent(props.data.displayedSummary.tacos)}
          detail={`Last ${props.data.horizon} days in the selected range`}
          active={props.data.metric === 'tacos'}
        />
        <KpiCard
          label="Ad spend"
          value={formatCurrency(props.data.displayedSummary.ad_spend)}
          detail={`Last ${props.data.horizon} days in the selected range`}
          active={props.data.metric === 'ad_spend'}
        />
        <KpiCard
          label="Ad sales"
          value={formatCurrency(props.data.displayedSummary.ad_sales)}
          detail={`Last ${props.data.horizon} days in the selected range`}
          active={props.data.metric === 'ad_sales'}
        />
        <KpiCard
          label="Total sales"
          value={formatCurrency(props.data.displayedSummary.total_sales)}
          detail={`Last ${props.data.horizon} days in the selected range`}
          active={props.data.metric === 'total_sales'}
        />
        <KpiCard
          label="Orders"
          value={formatNumber(props.data.displayedSummary.orders)}
          detail={`${formatNumber(props.data.validatedPhaseCount)} validated phase(s) in range`}
          active={props.data.metric === 'orders'}
        />
      </section>

      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted">Trend focus</div>
            <div className="mt-2 text-sm text-foreground">
              Showing {ADS_OPTIMIZER_OUTCOME_REVIEW_METRIC_LABELS[props.data.metric].toLowerCase()}{' '}
              across the last {props.data.horizon} days inside{' '}
              {formatUiDateRange(props.start, props.end)}. Validated phase markers sit on the
              effective validated date only.
            </div>
          </div>
          <form method="get" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[160px_220px_auto]">
            <input type="hidden" name="view" value="outcomes" />
            <input type="hidden" name="asin" value={props.asin} />
            <input type="hidden" name="start" value={props.start} />
            <input type="hidden" name="end" value={props.end} />
            <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
              Horizon
              <select
                name="horizon"
                defaultValue={props.data.horizon}
                className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
              >
                {ADS_OPTIMIZER_OUTCOME_REVIEW_HORIZONS.map((horizon) => (
                  <option key={horizon} value={horizon}>
                    Last {horizon} days
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
              Active metric
              <select
                name="metric"
                defaultValue={props.data.metric}
                className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
              >
                {ADS_OPTIMIZER_OUTCOME_REVIEW_METRICS.map((metric) => (
                  <option key={metric} value={metric}>
                    {ADS_OPTIMIZER_OUTCOME_REVIEW_METRIC_LABELS[metric]}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground xl:self-end"
            >
              Apply
            </button>
          </form>
        </div>

        {props.data.displayedTrendPoints.length > 0 ? (
          <div className="mt-6 space-y-4">
            <div className="overflow-x-auto" data-aph-hscroll data-aph-hscroll-axis="x">
              <div
                className="grid min-w-[900px] gap-2"
                style={{
                  gridTemplateColumns: `repeat(${props.data.displayedTrendPoints.length}, minmax(0, 1fr))`,
                }}
              >
                {props.data.displayedTrendPoints.map((point, index) => {
                  const phases = phasesByDate.get(point.date) ?? [];
                  const value = point[props.data.metric];
                  return (
                    <div key={point.date} className="flex min-w-0 flex-col gap-2">
                      <div className="flex min-h-10 flex-wrap items-start gap-1">
                        {phases.map((phase) => (
                          <button
                            key={phase.changeSetId}
                            type="button"
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              selectedPhaseId === phase.changeSetId ? 'ring-2 ring-primary/40' : ''
                            } ${getPhaseStatusClass(phase.status)}`}
                            onClick={() => setSelectedPhaseId(phase.changeSetId)}
                            title={`${phase.changeSetName} · ${phase.validatedEffectiveDate ?? 'Unvalidated'}`}
                          >
                            {phase.status === 'validated' ? 'Validated' : 'Review'}
                          </button>
                        ))}
                      </div>
                      <div className="relative h-52 rounded-xl border border-border bg-surface-2 px-2 py-3">
                        {trendBars.baselinePct < 100 ? (
                          <div
                            className="absolute inset-x-0 border-t border-dashed border-border/80"
                            style={{ top: `${trendBars.baselinePct}%` }}
                          />
                        ) : null}
                        <div className="flex h-full items-end justify-center">
                          {trendBars.direction[index] === 'positive' ? (
                            <div
                              className="w-full rounded-t-md bg-primary/80"
                              style={{ height: `${Math.max(trendBars.heights[index] ?? 0, 4)}%` }}
                              title={`${formatDateLabel(point.date)} · ${formatMetricValue(
                                props.data.metric,
                                value
                              )}`}
                            />
                          ) : trendBars.direction[index] === 'negative' ? (
                            <div className="flex h-full w-full flex-col justify-end">
                              <div
                                className="w-full rounded-b-md bg-rose-500/80"
                                style={{ height: `${Math.max(trendBars.heights[index] ?? 0, 4)}%` }}
                                title={`${formatDateLabel(point.date)} · ${formatMetricValue(
                                  props.data.metric,
                                  value
                                )}`}
                              />
                            </div>
                          ) : (
                            <div className="text-xs text-muted">No data</div>
                          )}
                        </div>
                      </div>
                      <div className="text-center text-xs font-semibold text-foreground">
                        {formatMetricValue(props.data.metric, value)}
                      </div>
                      <div className="text-center text-[11px] text-muted">
                        {formatDateLabel(point.date)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedPhase ? (
              <div className="rounded-xl border border-border bg-surface px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.3em] text-muted">
                      Phase summary
                    </div>
                    <div className="mt-2 text-lg font-semibold text-foreground">
                      {selectedPhase.changeSetName}
                    </div>
                    <div className="mt-1 text-sm text-muted">
                      Optimizer run {selectedPhase.optimizerRunId ?? 'Not captured'} · change set{' '}
                      {selectedPhase.changeSetId}
                    </div>
                    {selectedSegment ? (
                      <div className="mt-2 text-sm text-muted">
                        Linked segment {selectedSegment.segmentLabel} · {selectedSegment.segmentDateWindowLabel}
                      </div>
                    ) : null}
                  </div>
                  <div
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getPhaseStatusClass(
                      selectedPhase.status
                    )}`}
                  >
                    {selectedPhase.status.replace(/_/g, ' ')}
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <KpiCard
                    label="Effective date"
                    value={selectedPhase.validatedEffectiveDate ?? 'Pending'}
                    detail={`First validated ${selectedPhase.firstValidatedDate ?? 'Not captured'}`}
                  />
                  <KpiCard
                    label="Validation summary"
                    value={`${selectedPhase.validationSummary.validated} validated`}
                    detail={`${selectedPhase.validationSummary.pending} pending · ${selectedPhase.validationSummary.mismatch} mismatch · ${selectedPhase.validationSummary.notFound} not found`}
                  />
                  <KpiCard
                    label="Staged actions"
                    value={formatNumber(selectedPhase.stagedActionCount)}
                    detail={`${formatNumber(selectedPhase.targetCount)} target row(s)`}
                  />
                  {selectedSegment ? (
                    <KpiCard
                      label="Segment score"
                      value={`${selectedSegment.score}/100`}
                      detail={`${formatScoreLabel(selectedSegment.scoreLabel)} · ${selectedSegment.confidence} confidence`}
                    />
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted">
                  <span>Created {formatUiDateTime(selectedPhase.createdAt)}</span>
                  <Link
                    href={`/ads/optimizer/outcomes/${selectedPhase.changeSetId}?asin=${encodeURIComponent(
                      props.asin
                    )}&start=${encodeURIComponent(props.start)}&end=${encodeURIComponent(
                      props.end
                    )}&horizon=${encodeURIComponent(props.data.horizon)}&metric=${encodeURIComponent(
                      props.data.metric
                    )}`}
                    prefetch={false}
                    className="font-semibold text-primary underline"
                  >
                    Open phase detail
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-surface-2 px-4 py-4 text-sm text-muted">
                Select a validated phase marker or phase row below to inspect its lineage summary.
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-border bg-surface-2 px-4 py-4 text-sm text-muted">
            No daily product trend data was found for the selected ASIN and date range.
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted">Segment review</div>
            <div className="mt-2 text-sm text-foreground">
              Each segment row summarizes one optimizer phase against its post-phase window, capped
              before the next phase when needed.
            </div>
          </div>
          <label className="flex min-w-[180px] flex-col text-xs uppercase tracking-wide text-muted">
            Score filter
            <select
              value={segmentFilter}
              onChange={(event) =>
                setSegmentFilter(event.target.value as AdsOptimizerOutcomeReviewSegmentFilter)
              }
              className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
            >
              {SEGMENT_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {props.data.segments.length > 0 ? (
          <div className="mt-4 overflow-x-auto" data-aph-hscroll data-aph-hscroll-axis="x">
            <table className="min-w-[1120px] table-auto border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2">Segment</th>
                  <th className="px-3 py-2">Date window</th>
                  <th className="px-3 py-2">Objective</th>
                  <th className="px-3 py-2">Outcome score</th>
                  <th className="px-3 py-2">Confidence</th>
                  <th className="px-3 py-2">KPI movement</th>
                  <th className="px-3 py-2">Cautions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSegments.map((segment) => {
                  const scoreClass = getOutcomePillClassName(segment.score);
                  const isSelected = selectedPhaseId === segment.phaseChangeSetId;

                  return (
                    <tr
                      key={segment.segmentId}
                      className={`border-b border-border/60 ${
                        isSelected ? 'bg-primary/5' : ''
                      }`}
                    >
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => setSelectedPhaseId(segment.phaseChangeSetId)}
                        >
                          <div className="font-semibold text-foreground">{segment.segmentLabel}</div>
                          <div className="mt-1 text-xs text-muted">
                            {segment.hasMarker ? 'Linked to validated marker' : 'No validated marker yet'}
                          </div>
                        </button>
                      </td>
                      <td className="px-3 py-3 text-muted">{segment.segmentDateWindowLabel}</td>
                      <td className="px-3 py-3 text-muted">{segment.objectiveContextLabel}</td>
                      <td className="px-3 py-3">
                        <div
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${scoreClass}`}
                        >
                          {formatScoreLabel(segment.scoreLabel)} · {segment.score}/100
                        </div>
                      </td>
                      <td className="px-3 py-3 text-foreground">{segment.confidence}</td>
                      <td className="px-3 py-3 text-muted">{segment.shortKpiSummary}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          {segment.cautions.length > 0 ? (
                            segment.cautions.map((caution) => (
                              <span
                                key={`${segment.segmentId}:${caution.id}`}
                                className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900"
                              >
                                {caution.label}
                              </span>
                            ))
                          ) : (
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getCautionClass(
                                segment.cautions.length
                              )}`}
                            >
                              No caution
                            </span>
                          )}
                          <Link
                            href={segment.detailHref}
                            prefetch={false}
                            className="inline-flex items-center text-xs font-semibold text-primary underline"
                          >
                            Detail
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-border bg-surface-2 px-4 py-4 text-sm text-muted">
            No segment summaries are available for this ASIN and selected date range.
          </div>
        )}

        {props.data.segments.length > 0 && filteredSegments.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border bg-surface-2 px-4 py-4 text-sm text-muted">
            No segments matched the current filter.
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted">Phase list</div>
            <div className="mt-2 text-sm text-foreground">
              Each phase is one optimizer-originated Ads Workspace handoff change set. Validated
              phases use the latest validated snapshot date from linked bulkgen logbook changes.
            </div>
          </div>
          <div className="text-sm text-muted">
            {formatNumber(props.data.phaseCount)} phase(s) · {formatNumber(props.data.stagedActionCount)}{' '}
            staged action(s)
          </div>
        </div>

        {props.data.phases.length > 0 ? (
          <div className="mt-4 overflow-x-auto" data-aph-hscroll data-aph-hscroll-axis="x">
            <table className="min-w-[860px] table-auto border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2">Phase</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Validated effective</th>
                  <th className="px-3 py-2">Validation summary</th>
                  <th className="px-3 py-2">Staged actions</th>
                  <th className="px-3 py-2">Targets</th>
                  <th className="px-3 py-2">Optimizer run</th>
                </tr>
              </thead>
              <tbody>
                {props.data.phases.map((phase) => (
                  <tr
                    key={phase.changeSetId}
                    className={`border-b border-border/60 ${
                      selectedPhaseId === phase.changeSetId ? 'bg-primary/5' : ''
                    }`}
                  >
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => setSelectedPhaseId(phase.changeSetId)}
                      >
                        <div className="font-semibold text-foreground">{phase.changeSetName}</div>
                        <div className="mt-1 text-xs text-muted">{phase.changeSetId}</div>
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <div
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${getPhaseStatusClass(
                          phase.status
                        )}`}
                      >
                        {phase.status.replace(/_/g, ' ')}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-foreground">
                      {phase.validatedEffectiveDate ?? 'Pending'}
                    </td>
                    <td className="px-3 py-3 text-muted">
                      {phase.validationSummary.validated} validated ·{' '}
                      {phase.validationSummary.pending} pending ·{' '}
                      {phase.validationSummary.mismatch} mismatch ·{' '}
                      {phase.validationSummary.notFound} not found
                    </td>
                    <td className="px-3 py-3 text-foreground">
                      {formatNumber(phase.stagedActionCount)}
                    </td>
                    <td className="px-3 py-3 text-foreground">{formatNumber(phase.targetCount)}</td>
                    <td className="px-3 py-3 text-muted">
                      {phase.optimizerRunId ?? 'Not captured'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-border bg-surface-2 px-4 py-4 text-sm text-muted">
            No optimizer-originated handoff phases were found for this ASIN and selected date range.
          </div>
        )}
      </section>
    </section>
  );
}
