import Link from 'next/link';
import type { ReactNode } from 'react';

import { getOutcomePillClassName } from '@/lib/logbook/outcomePill';
import type {
  AdsOptimizerOutcomeReviewDetailReadyData,
  AdsOptimizerOutcomeReviewMetricSummary,
} from '@/lib/ads-optimizer/outcomeReviewTypes';
import { formatUiDateRange } from '@/lib/time/formatUiDate';

type OptimizerOutcomeReviewDetailProps = {
  data: AdsOptimizerOutcomeReviewDetailReadyData;
};

const formatCurrency = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return 'Not captured';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2,
  });
};

const formatPercent = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return 'Not captured';
  return `${(value * 100).toFixed(1)}%`;
};

const formatNumber = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return 'Not captured';
  return value.toLocaleString('en-US', {
    maximumFractionDigits: value >= 100 ? 0 : 1,
  });
};

const metricLabel = (key: keyof AdsOptimizerOutcomeReviewMetricSummary) => {
  if (key === 'contribution_after_ads') return 'Contribution after ads';
  if (key === 'tacos') return 'TACOS';
  if (key === 'ad_spend') return 'Ad spend';
  if (key === 'ad_sales') return 'Ad sales';
  if (key === 'total_sales') return 'Total sales';
  return 'Orders';
};

const formatMetricValue = (
  key: keyof AdsOptimizerOutcomeReviewMetricSummary,
  value: number | null
) => {
  if (key === 'contribution_after_ads' || key === 'ad_spend' || key === 'ad_sales' || key === 'total_sales') {
    return formatCurrency(value);
  }
  if (key === 'tacos') {
    return formatPercent(value);
  }
  return formatNumber(value);
};

const formatDelta = (
  key: keyof AdsOptimizerOutcomeReviewMetricSummary,
  before: number | null,
  after: number | null
) => {
  if (before === null || after === null || !Number.isFinite(before) || !Number.isFinite(after)) {
    return 'Not captured';
  }

  const delta = after - before;
  if (key === 'tacos') {
    return `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)} pts`;
  }
  if (
    key === 'contribution_after_ads' ||
    key === 'ad_spend' ||
    key === 'ad_sales' ||
    key === 'total_sales'
  ) {
    return `${delta >= 0 ? '+' : ''}${formatCurrency(delta)}`;
  }
  return `${delta >= 0 ? '+' : ''}${formatNumber(delta)}`;
};

const formatLabel = (value: string) => value.replace(/_/g, ' ');

const formatDateWindow = (startDate: string | null, endDate: string | null) =>
  startDate && endDate ? formatUiDateRange(startDate, endDate) : 'Not captured';

const Section = (props: { title: string; children: ReactNode; detail?: string }) => (
  <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
    <div className="text-xs uppercase tracking-[0.3em] text-muted">{props.title}</div>
    {props.detail ? <div className="mt-2 max-w-4xl text-sm text-muted">{props.detail}</div> : null}
    <div className="mt-4">{props.children}</div>
  </section>
);

export default function OptimizerOutcomeReviewDetail(
  props: OptimizerOutcomeReviewDetailProps
) {
  const beforeWindow = props.data.windows.find((window) => window.key === 'before') ?? null;
  const scorePillClass = getOutcomePillClassName(props.data.score.score);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted">Outcome review detail</div>
            <div className="mt-2 text-xl font-semibold text-foreground">{props.data.changeSetName}</div>
            <div className="mt-2 text-sm text-muted">
              ASIN {props.data.asin} · optimizer run {props.data.runId ?? 'Not captured'} · horizon{' '}
              {props.data.horizon} days
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${scorePillClass}`}
            >
              {formatLabel(props.data.score.label)} · {props.data.score.score}/100
            </span>
            <Link href={props.data.returnHref} className="text-sm font-semibold text-primary underline">
              Back to outcome review
            </Link>
          </div>
        </div>
      </section>

      <Section
        title="What changed"
        detail="These are the persisted Ads Workspace draft items staged from the optimizer handoff for this phase. Review-only items remain notes only."
      >
        <div className="space-y-3">
          {props.data.stagedChanges.length > 0 ? (
            props.data.stagedChanges.map((change) => (
              <div key={change.itemId} className="rounded-xl border border-border bg-surface px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{change.summary}</div>
                    <div className="mt-1 text-xs uppercase tracking-wide text-muted">
                      {change.entityLevel} · {change.actionType.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <div className="text-sm text-muted">
                    {change.campaignId ? <span>Campaign {change.campaignId}</span> : null}
                    {change.targetId ? <span> · Target {change.targetId}</span> : null}
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-border bg-surface-2 px-3 py-3">
                    <div className="text-xs uppercase tracking-wide text-muted">Before</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{change.beforeLabel}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface-2 px-3 py-3">
                    <div className="text-xs uppercase tracking-wide text-muted">After</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{change.afterLabel}</div>
                  </div>
                </div>
                {change.notes ? <div className="mt-3 text-sm text-muted">{change.notes}</div> : null}
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-surface-2 px-4 py-4 text-sm text-muted">
              No staged Ads Workspace actions were found for this phase.
            </div>
          )}

          {props.data.reviewOnlyNotes.map((note) => (
            <div
              key={note}
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              {note}
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Objective context"
        detail="The score is anchored to the objective captured at change time. Latest objective context is shown separately so objective drift is explicit."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface px-4 py-4">
            <div className="text-xs uppercase tracking-wide text-muted">Objective at change time</div>
            <div className="mt-2 text-lg font-semibold text-foreground">
              {props.data.objectiveContext.atChange.value ?? 'Not captured'}
            </div>
            <div className="mt-1 text-sm text-muted">
              {props.data.objectiveContext.atChange.reason ?? 'No persisted change-time objective was captured.'}
            </div>
            <div className="mt-3 text-xs uppercase tracking-wide text-muted">
              {props.data.objectiveContext.atChange.source.replace(/_/g, ' ')}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface px-4 py-4">
            <div className="text-xs uppercase tracking-wide text-muted">Current / latest objective</div>
            <div className="mt-2 text-lg font-semibold text-foreground">
              {props.data.objectiveContext.latest.value ?? 'Not captured'}
            </div>
            <div className="mt-1 text-sm text-muted">
              {props.data.objectiveContext.latest.reason ?? 'No current objective context was available.'}
            </div>
            <div className="mt-3 text-xs uppercase tracking-wide text-muted">
              {props.data.objectiveContext.latest.source.replace(/_/g, ' ')}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface px-4 py-4">
            <div className="text-xs uppercase tracking-wide text-muted">Objective changed since phase</div>
            <div className="mt-2 text-lg font-semibold text-foreground">
              {props.data.objectiveContext.changedSincePhase ? 'Yes' : 'No'}
            </div>
            <div className="mt-1 text-sm text-muted">
              Archetype {props.data.objectiveContext.archetype ?? 'Not captured'}
            </div>
            <div className="mt-3 text-sm text-muted">
              Change-time window:{' '}
              {formatDateWindow(
                props.data.objectiveContext.atChange.windowStart,
                props.data.objectiveContext.atChange.windowEnd
              )}
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Before vs after vs latest"
        detail="Baseline is the selected horizon before the validated effective date. Post is capped before the next validated phase when needed."
      >
        <div className="grid gap-4 xl:grid-cols-3">
          {props.data.windows.map((window) => (
            <div key={window.key} className="rounded-xl border border-border bg-surface px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-foreground">{window.label}</div>
                <div className="text-xs uppercase tracking-wide text-muted">
                  {window.observedDays}/{window.expectedDays} day(s)
                </div>
              </div>
              <div className="mt-1 text-sm text-muted">
                {window.startDate && window.endDate
                  ? formatUiDateRange(window.startDate, window.endDate)
                  : 'Window unavailable'}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {(Object.keys(window.metrics) as Array<keyof AdsOptimizerOutcomeReviewMetricSummary>).map((key) => (
                  <div key={`${window.key}-${key}`} className="rounded-lg border border-border bg-surface-2 px-3 py-3">
                    <div className="text-xs uppercase tracking-wide text-muted">{metricLabel(key)}</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">
                      {formatMetricValue(key, window.metrics[key])}
                    </div>
                    {window.key !== 'before' && beforeWindow ? (
                      <div className="mt-1 text-xs text-muted">
                        vs before {formatDelta(key, beforeWindow.metrics[key], window.metrics[key])}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {props.data.postWindowCappedByNextPhase && props.data.nextPhaseValidatedEffectiveDate ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            The post window stops before the next validated phase on {props.data.nextPhaseValidatedEffectiveDate}.
          </div>
        ) : null}
      </Section>

      <Section
        title="Outcome score"
        detail="The score is deterministic, objective-aware, and uses before/after/latest windows. Missing visibility evidence lowers confidence instead of inventing rank outcomes."
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${scorePillClass}`}
            >
              {formatLabel(props.data.score.label)} · {props.data.score.score}/100
            </div>
            <div className="mt-3 text-sm text-foreground">{props.data.score.explanation}</div>
            <div className="mt-2 text-sm text-muted">
              Confidence {props.data.score.confidence} · objective used{' '}
              {props.data.score.objectiveUsed ?? 'Not captured'}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface px-4 py-4 text-sm">
            <div className="text-xs uppercase tracking-wide text-muted">Validation summary</div>
            <div className="mt-2 text-foreground">
              {props.data.phase.validationSummary.validated} validated ·{' '}
              {props.data.phase.validationSummary.pending} pending ·{' '}
              {props.data.phase.validationSummary.mismatch} mismatch ·{' '}
              {props.data.phase.validationSummary.notFound} not found
            </div>
            <div className="mt-2 text-muted">
              Effective date {props.data.phase.validatedEffectiveDate ?? 'Pending'} · first validated{' '}
              {props.data.phase.firstValidatedDate ?? 'Not captured'}
            </div>
          </div>
        </div>
        {props.data.score.evidenceNotes.length > 0 ? (
          <div className="mt-4 space-y-2">
            {props.data.score.evidenceNotes.map((note) => (
              <div key={note} className="rounded-lg border border-border bg-surface-2 px-3 py-3 text-sm text-muted">
                {note}
              </div>
            ))}
          </div>
        ) : null}
      </Section>

      <Section
        title="Expandable details"
        detail="Raw inputs and component weights stay visible here so the phase assessment remains auditable."
      >
        <div className="space-y-3">
          <details className="rounded-xl border border-border bg-surface px-4 py-4">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">
              Score calculation inputs
            </summary>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {props.data.score.components.map((component) => (
                <div key={component.id} className="rounded-lg border border-border bg-surface-2 px-3 py-3">
                  <div className="text-xs uppercase tracking-wide text-muted">{component.label}</div>
                  <div className="mt-1 text-sm font-semibold text-foreground">
                    {component.score !== null ? `${Math.round(component.score)}/100` : 'Not captured'}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    Weight {(component.weight * 100).toFixed(0)}% · {component.direction.replace(/_/g, ' ')}
                  </div>
                  <div className="mt-2 text-sm text-muted">{component.detail}</div>
                </div>
              ))}
            </div>
          </details>

          <details className="rounded-xl border border-border bg-surface px-4 py-4">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">
              Raw staged change payloads
            </summary>
            <div className="mt-4 space-y-3">
              {props.data.stagedChanges.map((change) => (
                <div key={`raw-${change.itemId}`} className="rounded-lg border border-border bg-surface-2 px-3 py-3">
                  <div className="text-sm font-semibold text-foreground">{change.summary}</div>
                  <pre className="mt-3 overflow-x-auto text-xs text-muted">
{JSON.stringify(
  {
    before_json: change.beforeJson,
    after_json: change.afterJson,
    ui_context_json: change.uiContextJson,
  },
  null,
  2
)}
                  </pre>
                </div>
              ))}
            </div>
          </details>

          <details className="rounded-xl border border-border bg-surface px-4 py-4">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">
              Raw window summaries
            </summary>
            <pre className="mt-4 overflow-x-auto text-xs text-muted">
{JSON.stringify(
  {
    windows: props.data.windows,
    visibility_signal: props.data.score.visibilitySignal,
  },
  null,
  2
)}
            </pre>
          </details>
        </div>
      </Section>
    </div>
  );
}
