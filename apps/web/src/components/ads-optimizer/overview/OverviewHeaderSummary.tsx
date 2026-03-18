import type { AdsOptimizerOverviewData } from '@/lib/ads-optimizer/overview';
import {
  OverviewInfoCard,
  buildWindowSummary,
  objectiveBadgeClass,
  overviewSectionClassName,
  stateBadgeClass,
} from './overviewShared';

type OverviewHeaderSummaryProps = {
  data: AdsOptimizerOverviewData;
  start: string;
  end: string;
  trendEnabled: boolean;
};

export default function OverviewHeaderSummary(props: OverviewHeaderSummaryProps) {
  const { data, trendEnabled } = props;
  const windowSummary = buildWindowSummary(data, props.start, props.end);

  return (
    <section className={overviewSectionClassName}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.3em] text-muted">Product command-center</div>
          <div className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">
            {data.product.displayName}
          </div>
          <div className="mt-1.5 text-sm text-muted">ASIN {data.product.asin}</div>
          {data.product.title ? (
            <div className="mt-1 max-w-3xl text-sm text-muted">{data.product.title}</div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <div
            className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${stateBadgeClass(
              data.state.value
            )}`}
          >
            {data.state.label}
          </div>
          <div
            className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${objectiveBadgeClass(
              data.objective.value
            )}`}
          >
            {data.objective.value}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1.2fr_1.2fr_0.8fr_0.8fr]">
        <OverviewInfoCard
          label="Product state"
          value={data.state.label}
          detail={data.state.reason}
          valueClassName="text-foreground"
        />
        <OverviewInfoCard
          label="Recommended objective"
          value={data.objective.value}
          detail={data.objective.reason}
          valueClassName="text-foreground"
        />
        <OverviewInfoCard
          label="Current window"
          value={windowSummary.currentRange}
          detail={
            windowSummary.currentDays !== null
              ? `${windowSummary.currentDays} day(s) selected by the current date range.`
              : 'Date range comes directly from the page filters.'
          }
        />
        <OverviewInfoCard
          label="Previous window"
          value={windowSummary.previousRange}
          detail={
            windowSummary.previousDays !== null
              ? `${windowSummary.previousDays} day(s), auto-derived as the equal-length prior period.`
              : 'Previous comparison window is unavailable until a product scope is selected.'
          }
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[0.9fr_1.6fr]">
        <div className="rounded-xl border border-sky-200 bg-sky-50/60 px-3.5 py-3.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
            Trend mode
          </div>
          <div className="mt-1.5 text-lg font-semibold text-foreground">
            {trendEnabled ? 'On' : 'Off'}
          </div>
          <div className="mt-1.5 text-sm text-muted">
            {trendEnabled
              ? data.trend?.detail ??
                'Trend display uses the selected date range only. The previous period stays auto-derived.'
              : 'Trend display is disabled. The selected date range still drives the current window, and the previous period stays auto-derived.'}
          </div>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50/60 px-3.5 py-3.5 text-sm text-sky-900">
          Ads Workspace remains the only staging and execution boundary. Overview is still a
          read-only operator surface for product inputs, state, objective, and comparative signals.
        </div>
      </div>
    </section>
  );
}
