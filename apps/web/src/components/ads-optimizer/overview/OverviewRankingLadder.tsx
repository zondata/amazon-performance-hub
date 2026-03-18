import type { AdsOptimizerOverviewData } from '@/lib/ads-optimizer/overview';
import {
  CoverageStatusBadge,
  OverviewCoverageCard,
  formatSqpWeekEndingLabel,
  formatNumber,
  formatSignedCount,
  overviewSectionClassName,
} from './overviewShared';

type OverviewRankingLadderProps = {
  data: AdsOptimizerOverviewData;
  returnTo: string;
  saveHeroQueryAction: (formData: FormData) => Promise<void>;
  resetHeroQueryAction: (formData: FormData) => Promise<void>;
};

export default function OverviewRankingLadder(props: OverviewRankingLadderProps) {
  const { data } = props;
  const rankingLadder = data.visibility.rankingLadder;
  const heroQuerySelection = data.visibility.heroQuerySelection;
  const heroQueryTrend = data.visibility.heroQueryTrend;
  const heroQuerySelectValue =
    heroQuerySelection.savedManualQuery ??
    heroQueryTrend.keyword ??
    heroQuerySelection.candidates[0]?.query ??
    '';
  const heroQueryModeBadgeClass =
    heroQuerySelection.mode === 'manual'
      ? 'border-sky-200 bg-sky-50 text-sky-800'
      : 'border-border bg-surface-2 text-muted';

  const bucketCardClassName = (label: string) => {
    if (label === '1-2' || label === '3-5') {
      return 'border-emerald-200 bg-emerald-50/70';
    }
    if (label === '6-10' || label === '11-20') {
      return 'border-sky-200 bg-sky-50/70';
    }
    if (label === '21-45' || label === 'Page 2') {
      return 'border-amber-200 bg-amber-50/70';
    }
    return 'border-rose-200 bg-rose-50/60';
  };

  return (
    <section className={overviewSectionClassName}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted">Ranking ladder</div>
          <div className="mt-2 text-lg font-semibold text-foreground">
            Organic visibility at a glance
          </div>
        </div>
        {rankingLadder ? <CoverageStatusBadge status={rankingLadder.status} /> : null}
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <OverviewCoverageCard
          label="Organic rank coverage"
          status={data.visibility.rankingCoverage.status}
          headline={`${formatNumber(data.visibility.rankingCoverage.trackedKeywords)} tracked keyword(s)`}
          detail={data.visibility.rankingCoverage.detail}
        />
        <div className="rounded-xl border border-sky-200 bg-sky-50/70 px-3.5 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
              Hero query
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${heroQueryModeBadgeClass}`}
              >
                {heroQuerySelection.mode === 'manual' ? 'Manual' : 'Auto'}
              </span>
              <CoverageStatusBadge status={heroQueryTrend.status} />
            </div>
          </div>
          <div className="mt-2.5 text-base font-semibold text-sky-950">
            {heroQueryTrend.keyword
              ? heroQueryTrend.latestOrganicRank !== null
                ? `${heroQueryTrend.keyword} · rank ${formatNumber(heroQueryTrend.latestOrganicRank)}`
                : heroQueryTrend.keyword
              : 'No hero query resolved'}
          </div>
          <div className="mt-1.5 text-sm text-sky-900">{heroQuerySelection.detail}</div>
          <div className="mt-1 text-sm text-sky-900">{heroQueryTrend.detail}</div>
          {heroQuerySelection.mode === 'manual' &&
          !heroQuerySelection.savedManualQueryAvailableInCandidates ? (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Saved manual query is not present in the current ranking candidates. Overview keeps
              using the saved query until you reset to auto or choose a different default.
            </div>
          ) : null}
          {data.product.productId ? (
            <div className="mt-3 rounded-lg border border-border bg-surface/90 p-3">
              {heroQuerySelectValue ? (
                <form action={props.saveHeroQueryAction} className="space-y-2.5">
                  <input type="hidden" name="return_to" value={props.returnTo} />
                  <input type="hidden" name="product_id" value={data.product.productId} />
                  <input type="hidden" name="product_asin" value={data.product.asin} />
                  <label className="flex flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
                    Save default hero query for this ASIN
                    <select
                      name="hero_query"
                      defaultValue={heroQuerySelectValue}
                      className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium normal-case tracking-normal text-foreground"
                      required
                    >
                      {heroQuerySelection.mode === 'manual' &&
                      heroQuerySelection.savedManualQuery &&
                      !heroQuerySelection.savedManualQueryAvailableInCandidates ? (
                        <option value={heroQuerySelection.savedManualQuery}>
                          {heroQuerySelection.savedManualQuery} (saved, not in current candidates)
                        </option>
                      ) : null}
                      {heroQuerySelection.candidates.map((candidate) => (
                        <option key={candidate.query} value={candidate.query}>
                          {candidate.query} | rank {formatNumber(candidate.latestOrganicRank)} |
                          vol {formatNumber(candidate.searchVolume)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                    >
                      Save as default
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-sm text-muted">
                  No hero-query candidates are available in the selected ranking window yet, so a
                  manual default cannot be saved from Overview.
                </div>
              )}
              {heroQuerySelection.mode === 'manual' ? (
                <form action={props.resetHeroQueryAction} className="mt-2">
                  <input type="hidden" name="return_to" value={props.returnTo} />
                  <input type="hidden" name="product_id" value={data.product.productId} />
                  <input type="hidden" name="product_asin" value={data.product.asin} />
                  <button
                    type="submit"
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground"
                  >
                    Reset to auto
                  </button>
                </form>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-border bg-surface/90 px-3 py-2 text-sm text-muted">
              Hero query can be changed only after a product record is available for this ASIN.
            </div>
          )}
        </div>
        <OverviewCoverageCard
          label="SQP alignment"
          status={data.visibility.sqpCoverage.status}
          headline={
            data.visibility.sqpCoverage.selectedWeekEnd
              ? formatSqpWeekEndingLabel(data.visibility.sqpCoverage.selectedWeekEnd)
              : 'No SQP week available'
          }
          detail={data.visibility.sqpCoverage.detail}
        />
      </div>

      {rankingLadder ? (
        <div className="mt-3 rounded-xl border border-border bg-surface px-3.5 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-foreground">Current bucket counts</div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                Each bucket shows current, previous, and change without movement semantics
              </div>
            </div>
            <div className="text-right text-sm text-muted">
              {rankingLadder.latestObservedDate
                ? `Latest observed ${rankingLadder.latestObservedDate}`
                : 'Latest observed date unavailable'}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {rankingLadder.bands.map((band) => (
              <div key={band.label} className={`min-w-[148px] flex-1 rounded-xl border px-3 py-3 ${bucketCardClassName(band.label)}`}>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {band.label}
                </div>
                <div className="mt-3 space-y-1.5 rounded-lg border border-border/70 bg-surface/90 p-2.5">
                  <div className="flex items-center justify-between gap-3 rounded-md bg-surface-2/70 px-2 py-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Current
                    </div>
                    <div className="text-sm font-semibold text-foreground">
                      {formatNumber(band.currentCount)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-md bg-surface-2/70 px-2 py-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Previous
                    </div>
                    <div className="text-sm font-semibold text-muted">
                      {band.deltaCount === null ? '—' : formatNumber(band.currentCount - band.deltaCount)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-md bg-surface-2/70 px-2 py-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Change
                    </div>
                    <div className="text-sm font-semibold text-foreground">
                      {formatSignedCount(band.deltaCount)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2.5 text-sm text-muted">{rankingLadder.detail}</div>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-border bg-surface-2 px-3.5 py-3.5 text-sm text-muted">
          Ranking ladder output is unavailable for this ASIN and date window.{' '}
          {data.visibility.rankingCoverage.detail}
        </div>
      )}
    </section>
  );
}
