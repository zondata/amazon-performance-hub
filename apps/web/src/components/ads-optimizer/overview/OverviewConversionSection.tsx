import type { AdsOptimizerOverviewData } from '@/lib/ads-optimizer/overview';
import {
  CoverageStatusBadge,
  OverviewMetricCard,
  formatPercent,
  formatSignedPercentPoints,
  overviewSectionClassName,
} from './overviewShared';

type OverviewConversionSectionProps = {
  data: AdsOptimizerOverviewData;
};

export default function OverviewConversionSection(props: OverviewConversionSectionProps) {
  const { data } = props;
  const coverage = data.conversion?.coverage;

  return (
    <section className={overviewSectionClassName}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted">Conversion</div>
          <div className="mt-1.5 text-lg font-semibold text-foreground">How traffic is turning into orders</div>
        </div>
        {coverage ? <CoverageStatusBadge status={coverage.status} /> : null}
      </div>

      <div className="mt-1.5 text-sm text-muted">
        {coverage?.detail ??
          'Conversion inputs are missing for the selected scope, so current-versus-previous comparisons are incomplete.'}
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <OverviewMetricCard
          label="Unit session %"
          current={data.conversion?.unitSessionPercentage.current}
          previous={data.conversion?.unitSessionPercentage.previous}
          delta={data.conversion?.unitSessionPercentage.delta}
          deltaPct={data.conversion?.unitSessionPercentage.deltaPct}
          formatter={formatPercent}
          deltaFormatter={formatSignedPercentPoints}
          evaluation={data.conversion?.unitSessionPercentage.evaluation}
          detail={data.conversion?.unitSessionPercentage.detail}
        />
        <OverviewMetricCard
          label="Orders per session"
          current={data.conversion?.ordersPerSession.current}
          previous={data.conversion?.ordersPerSession.previous}
          delta={data.conversion?.ordersPerSession.delta}
          deltaPct={data.conversion?.ordersPerSession.deltaPct}
          formatter={formatPercent}
          deltaFormatter={formatSignedPercentPoints}
          evaluation={data.conversion?.ordersPerSession.evaluation}
          detail={data.conversion?.ordersPerSession.detail}
        />
      </div>
    </section>
  );
}
