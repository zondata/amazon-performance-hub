import type { AdsOptimizerOverviewData } from '@/lib/ads-optimizer/overview';
import {
  CoverageStatusBadge,
  OverviewMetricCard,
  formatSqpWeekEndingLabel,
  formatNumber,
  formatSignedCount,
  overviewSectionClassName,
} from './overviewShared';

type OverviewTrafficSectionProps = {
  data: AdsOptimizerOverviewData;
};

export default function OverviewTrafficSection(props: OverviewTrafficSectionProps) {
  const { data } = props;
  const coverage = data.traffic?.coverage;
  const heroQueryDemand = data.traffic?.heroQueryDemand;
  const trackedSqpDemand = data.traffic?.sqpDemand;
  const heroQueryHasCurrent =
    heroQueryDemand?.current !== null && heroQueryDemand?.current !== undefined;
  const heroQueryHasPrevious =
    heroQueryDemand?.previous !== null && heroQueryDemand?.previous !== undefined;
  const showHeroQueryDemandMetrics = heroQueryHasCurrent && heroQueryHasPrevious;

  const heroQueryUnavailableReason = (() => {
    if (!heroQueryDemand) {
      return 'Hero-query-specific SQP demand was not loaded for this ASIN.';
    }
    if (!heroQueryDemand.query) {
      return 'No hero query was resolved from ranking coverage, so SQP demand cannot be tied to a specific query.';
    }
    if (!heroQueryHasCurrent && !heroQueryHasPrevious) {
      if (heroQueryDemand.currentWeekEnd && heroQueryDemand.previousWeekEnd) {
        return `Unable to match "${heroQueryDemand.query}" to SQP rows in ${formatSqpWeekEndingLabel(
          heroQueryDemand.currentWeekEnd
        )} or ${formatSqpWeekEndingLabel(heroQueryDemand.previousWeekEnd)}.`;
      }
      if (heroQueryDemand.currentWeekEnd) {
        return `Unable to match "${heroQueryDemand.query}" to SQP rows in ${formatSqpWeekEndingLabel(
          heroQueryDemand.currentWeekEnd
        )}, and no aligned previous SQP week was available.`;
      }
      if (heroQueryDemand.previousWeekEnd) {
        return `No aligned current SQP week was available, and "${heroQueryDemand.query}" could not be matched in ${formatSqpWeekEndingLabel(
          heroQueryDemand.previousWeekEnd
        )}.`;
      }
      return 'No aligned SQP weeks were available for the current or previous window.';
    }
    if (!heroQueryHasCurrent) {
      return heroQueryDemand.currentWeekEnd
        ? `Unavailable in ${formatSqpWeekEndingLabel(heroQueryDemand.currentWeekEnd)} for "${heroQueryDemand.query}".`
        : 'No aligned current SQP week was available.';
    }
    if (!heroQueryHasPrevious) {
      return heroQueryDemand.previousWeekEnd
        ? `Unavailable in ${formatSqpWeekEndingLabel(heroQueryDemand.previousWeekEnd)} for "${heroQueryDemand.query}".`
        : 'No aligned previous SQP week was available.';
    }
    return heroQueryDemand.detail;
  })();

  return (
    <section className={overviewSectionClassName}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted">Traffic</div>
          <div className="mt-1.5 text-lg font-semibold text-foreground">Reach and demand inputs</div>
        </div>
        {coverage ? <CoverageStatusBadge status={coverage.status} /> : null}
      </div>

      <div className="mt-1.5 text-sm text-muted">
        {coverage?.detail ??
          'Traffic inputs are missing for the selected scope, so current-versus-previous comparisons are incomplete.'}
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <OverviewMetricCard
          label="Sessions"
          current={data.traffic?.sessions.current}
          previous={data.traffic?.sessions.previous}
          delta={data.traffic?.sessions.delta}
          deltaPct={data.traffic?.sessions.deltaPct}
          formatter={formatNumber}
          deltaFormatter={formatSignedCount}
          evaluation={data.traffic?.sessions.evaluation}
          detail={data.traffic?.sessions.detail}
        />
        <OverviewMetricCard
          label="SP impressions"
          current={data.traffic?.spImpressions.current}
          previous={data.traffic?.spImpressions.previous}
          delta={data.traffic?.spImpressions.delta}
          deltaPct={data.traffic?.spImpressions.deltaPct}
          formatter={formatNumber}
          deltaFormatter={formatSignedCount}
          evaluation={data.traffic?.spImpressions.evaluation}
          detail={data.traffic?.spImpressions.detail}
        />
        <div className="rounded-xl border border-sky-200 bg-sky-50/55 px-4 py-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
                SQP demand
              </div>
              <div className="text-sm font-semibold text-foreground">Hero query demand</div>
            </div>
            <CoverageStatusBadge
              status={heroQueryDemand?.status ?? trackedSqpDemand?.status ?? 'missing'}
            />
          </div>

          <div className="mt-3 rounded-lg border border-border bg-surface/90 px-3 py-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
              Hero query
            </div>
            <div className="mt-1 text-sm font-semibold text-foreground">
              {heroQueryDemand?.query ?? 'No hero query resolved'}
            </div>
            <div className="mt-1 text-xs text-muted">
              {formatSqpWeekEndingLabel(heroQueryDemand?.currentWeekEnd)}
            </div>
          </div>

          {showHeroQueryDemandMetrics ? (
            <>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                {formatNumber(heroQueryDemand?.current)}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-border bg-surface/85 p-2.5">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Current
                  </div>
                  <div className="mt-1 text-sm font-semibold text-foreground">
                    {formatNumber(heroQueryDemand?.current)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Previous
                  </div>
                  <div className="mt-1 text-sm font-semibold text-muted">
                    {formatNumber(heroQueryDemand?.previous)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Delta
                  </div>
                  <div className="mt-1 text-sm font-semibold text-foreground">
                    {formatSignedCount(heroQueryDemand?.delta)}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-border bg-surface/90 px-3 py-3">
              <div className="text-sm font-semibold text-foreground">Hero query demand unavailable</div>
              <div className="mt-1.5 text-sm text-muted">{heroQueryUnavailableReason}</div>
            </div>
          )}
          <div className="mt-2.5 text-sm text-muted">
            {heroQueryDemand?.detail ??
              'Hero-query-specific SQP demand is unavailable for the selected ASIN and aligned SQP week.'}
          </div>

          <div className="mt-3 rounded-xl border border-border bg-surface/90 px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
              Tracked total SQP demand
            </div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {formatNumber(trackedSqpDemand?.current)}
            </div>
            <div className="mt-1 text-xs text-muted">
              {formatSqpWeekEndingLabel(trackedSqpDemand?.currentWeekEnd)}
            </div>
            <div className="mt-2 flex items-center gap-3 text-xs text-muted">
              <span>Prev {formatNumber(trackedSqpDemand?.previous)}</span>
              <span>Δ {formatSignedCount(trackedSqpDemand?.delta)}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
