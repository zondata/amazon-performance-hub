import type { AdsOptimizerOutcomeReviewHorizon, AdsOptimizerOutcomeReviewMetric } from '@/lib/ads-optimizer/outcomeReviewTypes';
import type { AdsOptimizerHeaderRunContext } from '@/lib/ads-optimizer/runtime';
import type { AdsOptimizerRun } from '@/lib/ads-optimizer/runtimeTypes';
import {
  buildAdsOptimizerHref,
  type AdsOptimizerUtility,
  type AdsOptimizerView,
} from '@/lib/ads-optimizer/shell';
import {
  formatUiDateRange,
  formatUiDateTime,
} from '@/lib/time/formatUiDate';

type OptimizerRunScopeHeaderProps = {
  accountId: string;
  marketplace: string;
  asin: string;
  start: string;
  end: string;
  selectedAsinLabel: string | null;
  asinOptions: Array<{ asin: string; label: string }>;
  view: AdsOptimizerView;
  utility: AdsOptimizerUtility | null;
  persistentRunId: string | null;
  trendEnabled: boolean;
  trendMode: string;
  outcomeHorizon: AdsOptimizerOutcomeReviewHorizon;
  outcomeMetric: AdsOptimizerOutcomeReviewMetric;
  returnTo: string;
  runContext: AdsOptimizerHeaderRunContext;
  runNowAction: (formData: FormData) => Promise<void>;
};

const MetricChip = (props: { label: string; value: string }) => (
  <div className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted">
    <span className="font-semibold text-foreground">{props.label}:</span> {props.value}
  </div>
);

const formatRunStamp = (run: AdsOptimizerRun) =>
  `${run.selected_asin} · ${formatUiDateRange(run.date_start, run.date_end)}`;

const buildTargetsHref = (run: AdsOptimizerRun) =>
  buildAdsOptimizerHref({
    asin: run.selected_asin,
    start: run.date_start,
    end: run.date_end,
    view: 'targets',
    runId: run.run_id,
  });

const buildTrendToggleHref = (
  props: OptimizerRunScopeHeaderProps,
  nextTrendEnabled: boolean
) => {
  const href = buildAdsOptimizerHref({
    asin: props.asin,
    start: props.start,
    end: props.end,
    view: props.view,
    utility: props.utility,
    runId: props.persistentRunId,
    horizon: props.outcomeHorizon,
    metric: props.outcomeMetric,
  });
  const url = new URL(href, 'https://optimizer.local');
  url.searchParams.set('trend', nextTrendEnabled ? 'on' : 'off');
  if (props.trendMode !== '30') {
    url.searchParams.set('trend_mode', props.trendMode);
  }
  return `${url.pathname}?${url.searchParams.toString()}`;
};

export default function OptimizerRunScopeHeader(props: OptimizerRunScopeHeaderProps) {
  const runDisabled = props.asin === 'all';
  const focusRun = props.runContext.requestedRun ?? props.runContext.matchingWindowRun ?? null;
  const focusRunLabel = props.runContext.requestedRun
    ? 'Current Targets run'
    : props.runContext.matchingWindowRun
      ? 'Current scope run'
      : null;
  const latestIsFocusRun =
    focusRun && props.runContext.latestCompletedRun
      ? focusRun.run_id === props.runContext.latestCompletedRun.run_id
      : false;
  const openLatestRunHref = props.runContext.latestCompletedRun
    ? buildTargetsHref(props.runContext.latestCompletedRun)
    : null;

  return (
    <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.3em] text-muted">Ads optimizer</div>
          <div className="mt-2 text-lg font-semibold text-foreground">
            {formatUiDateRange(props.start, props.end)}
          </div>
          <div className="mt-2 max-w-3xl text-sm text-muted">
            Overview stays ASIN + date-range driven. Targets stays the persisted run-review
            surface, and any supported handoff still stages into Ads Workspace.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <MetricChip label="Account" value={props.accountId} />
          <MetricChip label="Marketplace" value={props.marketplace} />
          <MetricChip
            label="ASIN"
            value={props.selectedAsinLabel ?? (props.asin === 'all' ? 'All advertised ASINs' : props.asin)}
          />
          <MetricChip label="Primary view" value={props.view === 'targets' ? 'Targets' : 'Overview'} />
          {props.persistentRunId ? <MetricChip label="Pinned run" value={props.persistentRunId} /> : null}
          {props.view === 'overview' && props.utility === null ? (
            <MetricChip label="Trend" value={props.trendEnabled ? 'On' : 'Off'} />
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <form
          method="get"
          className="grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_auto]"
        >
          <input type="hidden" name="view" value={props.view} />
          {props.utility ? <input type="hidden" name="utility" value={props.utility} /> : null}
          <input type="hidden" name="trend" value={props.trendEnabled ? 'on' : 'off'} />
          {props.trendMode !== '30' ? (
            <input type="hidden" name="trend_mode" value={props.trendMode} />
          ) : null}
          {props.utility === 'outcomes' ? (
            <>
              <input type="hidden" name="horizon" value={props.outcomeHorizon} />
              <input type="hidden" name="metric" value={props.outcomeMetric} />
            </>
          ) : null}
          <label className="flex min-w-0 flex-col text-xs uppercase tracking-wide text-muted">
            Start
            <input
              type="date"
              name="start"
              defaultValue={props.start}
              className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="flex min-w-0 flex-col text-xs uppercase tracking-wide text-muted">
            End
            <input
              type="date"
              name="end"
              defaultValue={props.end}
              className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="flex min-w-0 flex-col text-xs uppercase tracking-wide text-muted sm:col-span-2 xl:col-span-1">
            Product
            <select
              name="asin"
              defaultValue={props.asin}
              className="mt-1 w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
            >
              <option value="all">All advertised ASINs</option>
              {props.asinOptions.map((option) => (
                <option key={option.asin} value={option.asin}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground xl:self-end"
          >
            Apply scope
          </button>
        </form>

        {props.view === 'overview' && props.utility === null ? (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="text-xs uppercase tracking-[0.3em] text-muted">Trend display</div>
            <div className="mt-2 text-sm text-muted">
              Selected date range defines the current analysis window. The previous period is
              auto-derived as the equal-length range immediately before it. Trend mode only shows
              the trend for that selected window and applies immediately.
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { label: 'On', enabled: true },
                { label: 'Off', enabled: false },
              ].map((item) => (
                <a
                  key={item.label}
                  href={buildTrendToggleHref(props, item.enabled)}
                  aria-current={props.trendEnabled === item.enabled ? 'page' : undefined}
                  className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                    props.trendEnabled === item.enabled
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-surface text-foreground hover:border-primary/40 hover:text-primary'
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-[0.3em] text-muted">Run context</div>
          <div className="mt-2 text-sm text-muted">
            Run control is now available from the shared header, so daily use no longer depends on
            opening History first.
          </div>

          {props.runContext.requestedRunError ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {props.runContext.requestedRunError}
            </div>
          ) : null}

          {focusRunLabel && focusRun ? (
            <div className="mt-4 rounded-xl border border-border bg-surface-2 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-muted">{focusRunLabel}</div>
              <div className="mt-1 text-sm font-semibold text-foreground">{formatRunStamp(focusRun)}</div>
              <div className="mt-1 text-sm text-muted">
                Run {focusRun.run_id} · completed {formatUiDateTime(focusRun.completed_at)}
              </div>
              <a
                href={buildTargetsHref(focusRun)}
                className="mt-3 inline-flex rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"
              >
                Open in Targets
              </a>
            </div>
          ) : null}

          {props.runContext.latestCompletedRun ? (
            <div className="mt-4 rounded-xl border border-border bg-surface-2 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-muted">Latest completed run</div>
              <div className="mt-1 text-sm font-semibold text-foreground">
                {formatRunStamp(props.runContext.latestCompletedRun)}
              </div>
              <div className="mt-1 text-sm text-muted">
                Run {props.runContext.latestCompletedRun.run_id} · created{' '}
                {formatUiDateTime(props.runContext.latestCompletedRun.created_at)}
                {latestIsFocusRun ? ' · already matches the current review context.' : ''}
              </div>
              {openLatestRunHref ? (
                <a
                  href={openLatestRunHref}
                  className="mt-3 inline-flex rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"
                >
                  Open latest in Targets
                </a>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-surface-2 px-4 py-4 text-sm text-muted">
              No completed optimizer run exists yet for this scope.
            </div>
          )}

          <form action={props.runNowAction} className="mt-4 space-y-3">
            <input type="hidden" name="return_to" value={props.returnTo} />
            <input type="hidden" name="asin" value={props.asin} />
            <input type="hidden" name="start" value={props.start} />
            <input type="hidden" name="end" value={props.end} />
            <input type="hidden" name="success_trend" value={props.trendEnabled ? 'on' : 'off'} />
            <input type="hidden" name="success_view" value="targets" />
            {runDisabled ? (
              <div className="rounded-xl border border-dashed border-border bg-surface-2 px-4 py-3 text-sm text-muted">
                Select one ASIN to run the optimizer. Overview stays broad; Targets remains the
                review destination for persisted runs.
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={runDisabled}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                Run now
              </button>
              <div className="text-sm text-muted">
                {runDisabled
                  ? 'Run now is disabled until one ASIN is selected.'
                  : `Creates a new persisted run for ${props.asin} and opens it in Targets.`}
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
