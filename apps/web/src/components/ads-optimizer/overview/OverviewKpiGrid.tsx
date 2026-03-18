import type { AdsOptimizerOverviewData } from '@/lib/ads-optimizer/overview';
import {
  OverviewInfoCard,
  OverviewMetricCard,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatSignedCurrency,
  formatSignedPercentPoints,
  overviewSectionClassName,
} from './overviewShared';

type OverviewKpiGridProps = {
  data: AdsOptimizerOverviewData;
};

export default function OverviewKpiGrid(props: OverviewKpiGridProps) {
  const { data } = props;
  const profitAfterAdsDetail = data.comparison?.contributionAfterAds.detail
    ? `Selected period value for the active date range. ${data.comparison.contributionAfterAds.detail} This card uses the existing contribution-after-ads metric, so positive values read as profit and negative values read as loss.`
    : 'Selected period value for the active date range. This card uses the existing contribution-after-ads metric, so positive values read as profit and negative values read as loss.';

  return (
    <section className={overviewSectionClassName}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted">KPI cards</div>
          <div className="mt-1.5 text-lg font-semibold text-foreground">Economics snapshot</div>
        </div>
        <div className="max-w-sm text-sm text-muted">
          Current, previous, and delta stay aligned to the selected window and its equal-length
          prior period.
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <OverviewMetricCard
          label="Profit after ads"
          eyebrow="Selected period"
          current={data.comparison?.contributionAfterAds.current ?? data.economics.contributionAfterAds}
          previous={data.comparison?.contributionAfterAds.previous}
          delta={data.comparison?.contributionAfterAds.delta}
          deltaPct={data.comparison?.contributionAfterAds.deltaPct}
          formatter={formatCurrency}
          deltaFormatter={formatSignedCurrency}
          evaluation={data.comparison?.contributionAfterAds.evaluation}
          detail={profitAfterAdsDetail}
        />
        <OverviewMetricCard
          label="Sales"
          current={data.comparison?.sales.current ?? data.economics.sales}
          previous={data.comparison?.sales.previous}
          delta={data.comparison?.sales.delta}
          deltaPct={data.comparison?.sales.deltaPct}
          formatter={formatCurrency}
          deltaFormatter={formatSignedCurrency}
          evaluation={data.comparison?.sales.evaluation}
          detail={data.comparison?.sales.detail}
        />
        <OverviewMetricCard
          label="Ad spend"
          current={data.comparison?.adSpend.current ?? data.economics.adSpend}
          previous={data.comparison?.adSpend.previous}
          delta={data.comparison?.adSpend.delta}
          deltaPct={data.comparison?.adSpend.deltaPct}
          formatter={formatCurrency}
          deltaFormatter={formatSignedCurrency}
          evaluation={data.comparison?.adSpend.evaluation}
          detail={
            data.comparison?.adSpend.detail ??
            `Ad sales landed at ${formatCurrency(data.economics.adSales)} in the current window.`
          }
        />
        <OverviewMetricCard
          label="TACOS"
          current={data.comparison?.tacos.current ?? data.economics.tacos}
          previous={data.comparison?.tacos.previous}
          delta={data.comparison?.tacos.delta}
          deltaPct={data.comparison?.tacos.deltaPct}
          formatter={formatPercent}
          deltaFormatter={formatSignedPercentPoints}
          evaluation={data.comparison?.tacos.evaluation}
          detail={
            data.comparison?.tacos.detail ??
            `Average price held at ${formatCurrency(data.economics.averagePrice)} in the current window.`
          }
        />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <OverviewInfoCard
          label="Orders and units"
          value={`${formatNumber(data.economics.orders)} / ${formatNumber(data.economics.units)}`}
          detail="Orders are paired with shipped units, not averaged across the window."
        />
        <OverviewInfoCard
          label="Ad sales"
          value={formatCurrency(data.economics.adSales)}
          detail="Attributed ad sales for the current selected window."
        />
        <OverviewInfoCard
          label="Average price"
          value={formatCurrency(data.economics.averagePrice)}
          detail="Average realized sales price per unit."
        />
        <OverviewInfoCard
          label="Break-even ACoS"
          value={formatPercent(data.economics.breakEvenAcos)}
          detail="Derived from product-level contribution before ads."
        />
        <OverviewInfoCard
          label="Cost coverage"
          value={formatPercent(data.economics.costCoverage)}
          detail="Coverage of payout, fees, and COGS inputs across the current window."
        />
      </div>
    </section>
  );
}
