import type { AdsOptimizerOverviewData } from '@/lib/ads-optimizer/overview';

type OptimizerOverviewPanelProps = {
  asin: string;
  start: string;
  end: string;
  data: AdsOptimizerOverviewData | null;
};

const formatCurrency = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
};

const formatNumber = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US');
};

const formatPercent = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
};

const coverageBadgeClass = (status: AdsOptimizerOverviewData['visibility']['rankingCoverage']['status']) => {
  if (status === 'ready') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'partial') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-border bg-surface-2 text-muted';
};

const stateBadgeClass = (state: AdsOptimizerOverviewData['state']['value']) => {
  if (state === 'profitable') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (state === 'break_even') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (state === 'loss') return 'border-rose-200 bg-rose-50 text-rose-800';
  return 'border-border bg-surface-2 text-muted';
};

const objectiveBadgeClass = (objective: AdsOptimizerOverviewData['objective']['value']) => {
  if (objective === 'Scale Profit' || objective === 'Harvest Profit') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }
  if (objective === 'Rank Growth' || objective === 'Rank Defense') {
    return 'border-sky-200 bg-sky-50 text-sky-800';
  }
  if (objective === 'Break Even') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }
  return 'border-border bg-surface-2 text-muted';
};

const MetricCard = (props: { label: string; value: string; detail?: string }) => (
  <div className="rounded-xl border border-border bg-surface px-4 py-3">
    <div className="text-xs uppercase tracking-wide text-muted">{props.label}</div>
    <div className="mt-2 text-lg font-semibold text-foreground">{props.value}</div>
    {props.detail ? <div className="mt-1 text-sm text-muted">{props.detail}</div> : null}
  </div>
);

const CoverageCard = (props: {
  label: string;
  status: AdsOptimizerOverviewData['visibility']['rankingCoverage']['status'];
  headline: string;
  detail: string;
}) => (
  <div className="rounded-xl border border-border bg-surface p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="text-xs uppercase tracking-wide text-muted">{props.label}</div>
      <div
        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${coverageBadgeClass(
          props.status
        )}`}
      >
        {props.status}
      </div>
    </div>
    <div className="mt-3 text-base font-semibold text-foreground">{props.headline}</div>
    <div className="mt-2 text-sm text-muted">{props.detail}</div>
  </div>
);

export default function OptimizerOverviewPanel(props: OptimizerOverviewPanelProps) {
  if (!props.data) {
    return (
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="text-xs uppercase tracking-[0.3em] text-muted">Overview scope</div>
        <div className="mt-2 text-lg font-semibold text-foreground">
          Select one ASIN to load the Phase 3 product command-center.
        </div>
        <div className="mt-2 max-w-3xl text-sm text-muted">
          Current Build Plan Phase 3 is product-scoped. The optimizer overview computes product
          inputs, product state, and objective for one selected ASIN only.
        </div>
        <div className="mt-4 rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
          Scope is currently set to all advertised ASINs. Choose a single ASIN above, then apply
          the filters to render the command-center for {props.start} → {props.end}.
        </div>
      </section>
    );
  }

  const { data } = props;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted">Product command-center</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{data.product.displayName}</div>
            <div className="mt-2 text-sm text-muted">
              ASIN {data.product.asin} · {props.start} → {props.end}
            </div>
            {data.product.shortName && data.product.title ? (
              <div className="mt-1 text-sm text-muted">{data.product.title}</div>
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
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface px-4 py-4">
            <div className="text-xs uppercase tracking-wide text-muted">Product state</div>
            <div className="mt-2 text-sm text-foreground">{data.state.reason}</div>
          </div>
          <div className="rounded-xl border border-border bg-surface px-4 py-4">
            <div className="text-xs uppercase tracking-wide text-muted">Recommended objective</div>
            <div className="mt-2 text-sm text-foreground">{data.objective.reason}</div>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-800">
          Phase 3 loads product-level inputs only. No target profiles, scoring, roles,
          recommendations, or execution handoff are active yet.
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="text-xs uppercase tracking-[0.3em] text-muted">Economics inputs</div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Sales" value={formatCurrency(data.economics.sales)} />
          <MetricCard
            label="Orders"
            value={formatNumber(data.economics.orders)}
            detail={`Units ${formatNumber(data.economics.units)}`}
          />
          <MetricCard
            label="Ad spend"
            value={formatCurrency(data.economics.adSpend)}
            detail={`Ad sales ${formatCurrency(data.economics.adSales)}`}
          />
          <MetricCard
            label="TACOS"
            value={formatPercent(data.economics.tacos)}
            detail={`Average price ${formatCurrency(data.economics.averagePrice)}`}
          />
          <MetricCard
            label="Cost coverage"
            value={formatPercent(data.economics.costCoverage)}
            detail="Coverage of payout, fees, and COGS inputs across the selected window."
          />
          <MetricCard
            label="Break-even ACoS"
            value={formatPercent(data.economics.breakEvenAcos)}
            detail="Derived from product-level contribution before ads."
          />
          <MetricCard
            label="Contribution Before Ads / Unit"
            value={formatCurrency(data.economics.contributionBeforeAdsPerUnit)}
          />
          <MetricCard
            label="Contribution After Ads"
            value={formatCurrency(data.economics.contributionAfterAds)}
            detail="Product-level only. No target allocation is applied in Phase 3."
          />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="text-xs uppercase tracking-[0.3em] text-muted">Visibility inputs</div>
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <CoverageCard
            label="Organic rank coverage"
            status={data.visibility.rankingCoverage.status}
            headline={`${formatNumber(data.visibility.rankingCoverage.trackedKeywords)} tracked keyword(s)`}
            detail={data.visibility.rankingCoverage.detail}
          />
          <CoverageCard
            label="Hero-query rank trend"
            status={data.visibility.heroQueryTrend.status}
            headline={
              data.visibility.heroQueryTrend.keyword
                ? `${data.visibility.heroQueryTrend.keyword} · rank ${formatNumber(
                    data.visibility.heroQueryTrend.latestOrganicRank
                  )}`
                : 'No hero query resolved'
            }
            detail={data.visibility.heroQueryTrend.detail}
          />
          <CoverageCard
            label="SQP demand coverage"
            status={data.visibility.sqpCoverage.status}
            headline={
              data.visibility.sqpCoverage.selectedWeekEnd
                ? `Week ${data.visibility.sqpCoverage.selectedWeekEnd}`
                : 'No SQP week available'
            }
            detail={
              data.visibility.sqpCoverage.status === 'missing'
                ? data.visibility.sqpCoverage.detail
                : `${data.visibility.sqpCoverage.detail} Top query ${data.visibility.sqpCoverage.topQuery ?? '—'} · search volume ${formatNumber(
                    data.visibility.sqpCoverage.totalSearchVolume
                  )}.`
            }
          />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="text-xs uppercase tracking-[0.3em] text-muted">Coverage notes</div>
        {data.warnings.length === 0 ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
            Required Phase 3 inputs were available for this ASIN without any explicit coverage gaps.
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {data.warnings.map((warning) => (
              <li key={warning} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {warning}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
