import { notFound } from 'next/navigation';

import OptimizerConfigManager from '@/components/ads-optimizer/OptimizerConfigManager';
import OptimizerHistoryPanel from '@/components/ads-optimizer/OptimizerHistoryPanel';
import OptimizerOverviewPanel from '@/components/ads-optimizer/OptimizerOverviewPanel';
import OptimizerOutcomeReviewPanel from '@/components/ads-optimizer/OptimizerOutcomeReviewPanel';
import OptimizerRunScopeHeader from '@/components/ads-optimizer/OptimizerRunScopeHeader';
import OptimizerTargetsPanel from '@/components/ads-optimizer/OptimizerTargetsPanel';
import OptimizerUtilityNav from '@/components/ads-optimizer/OptimizerUtilityNav';
import Tabs from '@/components/Tabs';
import {
  activateAdsOptimizerRulePackVersionAction,
  createAdsOptimizerDraftVersionAction,
  handoffAdsOptimizerToWorkspaceAction,
  resetAdsOptimizerHeroQueryAction,
  runAdsOptimizerNowAction,
  saveAdsOptimizerDraftVersionAction,
  saveAdsOptimizerProductSettingsAction,
  saveAdsOptimizerHeroQueryAction,
  saveAdsOptimizerRecommendationOverrideAction,
  seedAdsOptimizerStarterVersionsAction,
} from '@/app/ads/optimizer/actions';
import { isAdsOptimizerEnabled } from '@/lib/ads-optimizer/featureFlag';
import {
  getAdsOptimizerOverviewData,
  normalizeAdsOptimizerOverviewTrendEnabled,
  normalizeAdsOptimizerOverviewTrendMode,
} from '@/lib/ads-optimizer/overview';
import { getAdsOptimizerOutcomeReviewData } from '@/lib/ads-optimizer/outcomeReview';
import {
  getAdsOptimizerConfigViewData,
  getProductOptimizerSettingsByProductId,
} from '@/lib/ads-optimizer/repoConfig';
import {
  findOptimizerProductByAsin,
  resolveAdsOptimizerRuntimeContextForAsin,
} from '@/lib/ads-optimizer/repoRuntime';
import {
  getAdsOptimizerHeaderRunContext,
  getAdsOptimizerHistoryViewData,
  getAdsOptimizerTargetsViewData,
} from '@/lib/ads-optimizer/runtime';
import {
  ADS_OPTIMIZER_UTILITIES,
  ADS_OPTIMIZER_VIEWS,
  buildAdsOptimizerHref,
  normalizeAdsOptimizerOutcomeHorizon,
  normalizeAdsOptimizerOutcomeMetric,
  normalizeAdsOptimizerShell,
  type AdsOptimizerLegacyView,
} from '@/lib/ads-optimizer/shell';
import { env } from '@/lib/env';
import { fetchAsinOptions } from '@/lib/products/fetchAsinOptions';
import { getDefaultMarketplaceDateRange } from '@/lib/time/defaultDateRange';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const normalizeDate = (value?: string): string | undefined => {
  if (!value || !DATE_RE.test(value)) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return value;
};

const EMPTY_STATE_COPY: Record<
  AdsOptimizerLegacyView,
  {
    eyebrow: string;
    title: string;
    body: string;
  }
> = {
  overview: {
    eyebrow: 'Overview scope',
    title: 'Select one ASIN to load the product command-center.',
    body:
      'Current Build Plan Phase 3 is product-scoped. Select one ASIN above to compute product inputs, state classification, and objective guidance.',
  },
  targets: {
    eyebrow: 'Targets scope',
    title: 'Select one ASIN and capture a run to review the target queue.',
    body:
      'Phase 12 reads persisted target profile, state, role, diagnostics, comparison cues, and recommendation snapshots into an ASIN command center, target queue, and trust layer. Supported actions can be handed off into Ads Workspace draft staging, but execution still stays there.',
  },
  outcomes: {
    eyebrow: 'Outcome review scope',
    title: 'Select one ASIN to review validated optimizer outcome lineage.',
    body:
      'Phase 1 Outcome Review is product-scoped and read-only. It links optimizer-originated Ads Workspace handoffs to bulkgen logbook validations, shows KPI trend context, and keeps unvalidated phases visible without pretending an outcome score already exists.',
  },
  config: {
    eyebrow: 'Config runtime',
    title: 'Optimizer config is live for manual runs.',
    body:
      'Rule-pack versions and product settings now drive manual-run version resolution inside Ads Optimizer. Product assignment wins when enabled, and the account active version remains the explicit fallback.',
  },
  history: {
    eyebrow: 'History runtime',
    title: 'Manual runs capture versioned optimizer history.',
    body:
      'Each manual run records the effective rule-pack version that actually drove the run, including explicit fallback context when a product assignment is absent or disabled.',
  },
};

type AdsOptimizerPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const pickSearchParam = (value: string | string[] | undefined) => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

export default async function AdsOptimizerPage({ searchParams }: AdsOptimizerPageProps) {
  if (!isAdsOptimizerEnabled()) {
    notFound();
  }

  const params = searchParams ? await searchParams : undefined;
  const paramValue = (key: string): string | undefined => {
    const value = params?.[key];
    if (!value) return undefined;
    return Array.isArray(value) ? value[0] : value;
  };

  const defaults = getDefaultMarketplaceDateRange({
    marketplace: env.marketplace,
    daysBack: 31,
    delayDays: 0,
  });

  let start = normalizeDate(paramValue('start')) ?? defaults.start;
  let end = normalizeDate(paramValue('end')) ?? defaults.end;
  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }

  const asin = paramValue('asin') ?? 'all';
  const requestedRunId = paramValue('runId')?.trim() || null;
  const shell = normalizeAdsOptimizerShell({
    view: paramValue('view'),
    utility: paramValue('utility'),
  });
  const view = shell.view;
  const utility = shell.utility;
  const outcomeHorizon = normalizeAdsOptimizerOutcomeHorizon(paramValue('horizon'));
  const outcomeMetric = normalizeAdsOptimizerOutcomeMetric(paramValue('metric'));
  const rawOverviewTrend = paramValue('trend');
  const rawOverviewTrendMode =
    paramValue('trend_mode') ??
    (rawOverviewTrend && /^\d+$/.test(rawOverviewTrend) ? rawOverviewTrend : undefined);
  const overviewTrendEnabled = normalizeAdsOptimizerOverviewTrendEnabled(rawOverviewTrend);
  const overviewTrendMode = normalizeAdsOptimizerOverviewTrendMode(rawOverviewTrendMode);
  const notice = pickSearchParam(params?.notice);
  const error = pickSearchParam(params?.error);
  const overrideError = paramValue('override_error') === '1';
  const overviewData =
    view === 'overview' && utility === null && asin !== 'all'
      ? await getAdsOptimizerOverviewData({
          accountId: env.accountId,
          marketplace: env.marketplace,
          asin,
          start,
          end,
          trendEnabled: overviewTrendEnabled,
          trendMode: overviewTrendMode,
        })
      : null;
  const configData = utility === 'config' ? await getAdsOptimizerConfigViewData() : null;
  const selectedConfigProduct =
    utility === 'config' && asin !== 'all' ? await findOptimizerProductByAsin(asin) : null;
  const selectedProductSettings =
    utility === 'config' && selectedConfigProduct?.productId
      ? await getProductOptimizerSettingsByProductId(selectedConfigProduct.productId)
      : null;
  const selectedConfigRuntimeContext =
    utility === 'config' && asin !== 'all'
      ? await resolveAdsOptimizerRuntimeContextForAsin({ asin })
      : null;
  const historyData = utility === 'history' ? await getAdsOptimizerHistoryViewData(asin) : null;
  const targetsData =
    view === 'targets' && utility === null && (asin !== 'all' || requestedRunId !== null)
      ? await getAdsOptimizerTargetsViewData({
          asin,
          start,
          end,
          runId: requestedRunId,
        })
      : null;
  const outcomeReviewData =
    utility === 'outcomes' && asin !== 'all'
      ? await getAdsOptimizerOutcomeReviewData({
          asin,
          start,
          end,
          horizon: outcomeHorizon,
          metric: outcomeMetric,
        })
      : null;
  const headerRunContext =
    view === 'targets' && utility === null
      ? {
          requestedRunId,
          requestedRun:
            requestedRunId && targetsData?.resolvedContextSource === 'run_id'
              ? targetsData.run
              : null,
          requestedRunError: requestedRunId ? targetsData?.runLookupError ?? null : null,
          matchingWindowRun:
            targetsData?.resolvedContextSource === 'window' ? targetsData.run : null,
          latestCompletedRun: targetsData?.latestCompletedRun ?? null,
        }
      : await getAdsOptimizerHeaderRunContext({
          asin,
          start,
          end,
          runId: requestedRunId,
        });
  const effectiveAsin = view === 'targets' ? targetsData?.run?.selected_asin ?? asin : asin;
  const effectiveStart = view === 'targets' ? targetsData?.run?.date_start ?? start : start;
  const effectiveEnd = view === 'targets' ? targetsData?.run?.date_end ?? end : end;
  const effectiveRunId =
    view === 'targets' ? targetsData?.run?.run_id ?? requestedRunId : requestedRunId;
  const asinOptions = await fetchAsinOptions(env.accountId, env.marketplace);
  const selectedAsin = asinOptions.find((option) => option.asin === effectiveAsin) ?? null;
  const withOverviewTrendParams = (href: string) => {
    const url = new URL(href, 'http://localhost');
    url.searchParams.set('trend', overviewTrendEnabled ? 'on' : 'off');
    if (rawOverviewTrendMode) {
      url.searchParams.set('trend_mode', overviewTrendMode);
    }
    return `${url.pathname}?${url.searchParams.toString()}`;
  };
  const viewTabs = ADS_OPTIMIZER_VIEWS.map((item) => ({
    label: item.label,
    value: item.value,
    href: withOverviewTrendParams(
      buildAdsOptimizerHref({
        start: effectiveStart,
        end: effectiveEnd,
        asin: effectiveAsin,
        view: item.value,
        runId: effectiveRunId,
      })
    ),
  }));
  const utilityLinks = ADS_OPTIMIZER_UTILITIES.map((item) => ({
    label: item.label,
    value: item.value,
    href: withOverviewTrendParams(
      buildAdsOptimizerHref({
        start: effectiveStart,
        end: effectiveEnd,
        asin: effectiveAsin,
        view: item.parentView,
        utility: item.value,
        runId: effectiveRunId,
        horizon: item.value === 'outcomes' ? outcomeHorizon : null,
        metric: item.value === 'outcomes' ? outcomeMetric : null,
      })
    ),
  }));
  const emptyState = EMPTY_STATE_COPY[(utility ?? view) as AdsOptimizerLegacyView];
  const returnTo = withOverviewTrendParams(
    buildAdsOptimizerHref({
      start: effectiveStart,
      end: effectiveEnd,
      asin: effectiveAsin,
      view,
      utility,
      runId: effectiveRunId,
      horizon: utility === 'outcomes' ? outcomeHorizon : null,
      metric: utility === 'outcomes' ? outcomeMetric : null,
    })
  );
  const clearUtilityHref = withOverviewTrendParams(
    buildAdsOptimizerHref({
      start: effectiveStart,
      end: effectiveEnd,
      asin: effectiveAsin,
      view,
      runId: effectiveRunId,
    })
  );
  const phaseBadge =
    utility === 'config'
      ? 'Live versioned config'
      : utility === 'outcomes'
        ? 'Outcome review lineage'
        : utility === 'history'
          ? 'Recommendation engine'
      : view === 'overview'
        ? 'Read-only optimizer active'
        : view === 'targets'
          ? 'Review + comparison queue'
          : 'Recommendation shell only';

  return (
    <div className="space-y-8">
      <OptimizerRunScopeHeader
        accountId={env.accountId}
        marketplace={env.marketplace}
        asin={effectiveAsin}
        start={effectiveStart}
        end={effectiveEnd}
        selectedAsinLabel={selectedAsin?.label ?? null}
        asinOptions={asinOptions}
        view={view}
        utility={utility}
        persistentRunId={effectiveRunId}
        trendEnabled={overviewTrendEnabled}
        trendMode={overviewTrendMode}
        outcomeHorizon={outcomeHorizon}
        outcomeMetric={outcomeMetric}
        returnTo={returnTo}
        runContext={headerRunContext}
        runNowAction={runAdsOptimizerNowAction}
      />

      <section className="space-y-4">
        <Tabs items={viewTabs} current={view} />
        <OptimizerUtilityNav
          items={utilityLinks}
          activeUtility={utility}
          clearHref={clearUtilityHref}
        />
      </section>

      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted">Scope guardrail</div>
            <div className="mt-2 text-lg font-semibold text-foreground">SP only in V1</div>
            <div className="mt-2 max-w-3xl text-sm text-muted">
              Sponsored Products is the only supported channel for the optimizer in V1. SB, SD,
              execution flows, and optimizer-owned tables remain out of scope in this phase.
            </div>
          </div>
          <div className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
            {phaseBadge}
          </div>
        </div>
      </section>

      {utility === 'config' ? (
        <OptimizerConfigManager
          returnTo={returnTo}
          rulePack={configData?.rulePack ?? null}
          activeVersion={configData?.activeVersion ?? null}
          versions={configData?.versions ?? []}
          missingStarterProfiles={configData?.missingStarterProfiles ?? []}
          versionStrategyProfiles={configData?.versionStrategyProfiles ?? {}}
          seeded={configData?.seeded ?? false}
          seedMessage={configData?.seedMessage ?? null}
          notice={notice}
          error={error}
          selectedProductId={selectedConfigProduct?.productId ?? null}
          selectedProductAsin={selectedConfigProduct?.asin ?? (asin !== 'all' ? asin : null)}
          selectedProductLabel={
            asin !== 'all' ? (selectedAsin?.label ?? selectedConfigProduct?.asin ?? asin) : null
          }
          selectedProductTitle={selectedConfigProduct?.title ?? null}
          productSettings={selectedProductSettings}
          effectiveVersionContext={selectedConfigRuntimeContext?.effectiveVersionContext ?? null}
          createDraftAction={createAdsOptimizerDraftVersionAction}
          activateVersionAction={activateAdsOptimizerRulePackVersionAction}
          saveDraftAction={saveAdsOptimizerDraftVersionAction}
          saveProductSettingsAction={saveAdsOptimizerProductSettingsAction}
          seedStarterVersionsAction={seedAdsOptimizerStarterVersionsAction}
        />
      ) : utility === 'history' ? (
        <OptimizerHistoryPanel
          asin={asin}
          start={start}
          end={end}
          returnTo={returnTo}
          activeVersionLabel={historyData?.activeVersionLabel ?? '—'}
          runNowVersionContext={historyData?.runNowVersionContext ?? null}
          runs={historyData?.runs ?? []}
          notice={notice}
          error={error}
          runNowAction={runAdsOptimizerNowAction}
        />
      ) : utility === 'outcomes' && outcomeReviewData ? (
        <OptimizerOutcomeReviewPanel
          asin={effectiveAsin}
          start={effectiveStart}
          end={effectiveEnd}
          data={outcomeReviewData}
        />
      ) : view === 'overview' ? (
        <OptimizerOverviewPanel
          asin={asin}
          start={start}
          end={end}
          trendEnabled={overviewTrendEnabled}
          data={overviewData}
          returnTo={returnTo}
          saveHeroQueryAction={saveAdsOptimizerHeroQueryAction}
          resetHeroQueryAction={resetAdsOptimizerHeroQueryAction}
        />
      ) : view === 'targets' ? (
        <OptimizerTargetsPanel
          asin={effectiveAsin}
          start={effectiveStart}
          end={effectiveEnd}
          requestedRunId={targetsData?.requestedRunId ?? requestedRunId}
          resolvedContextSource={targetsData?.resolvedContextSource ?? null}
          runLookupError={targetsData?.runLookupError ?? null}
          historyHref={buildAdsOptimizerHref({
            start: effectiveStart,
            end: effectiveEnd,
            asin: effectiveAsin,
            view: 'targets',
            utility: 'history',
          })}
          returnTo={buildAdsOptimizerHref({
            start: effectiveStart,
            end: effectiveEnd,
            asin: effectiveAsin,
            view: 'targets',
            runId: effectiveRunId,
          })}
          workspaceQueueHref={`/ads/performance?${new URLSearchParams({
            panel: 'queue',
            channel: 'sp',
            level: 'targets',
            view: 'table',
            asin: effectiveAsin,
            start: effectiveStart,
            end: effectiveEnd,
          }).toString()}`}
          run={targetsData?.run ?? null}
          latestCompletedRun={targetsData?.latestCompletedRun ?? null}
          productState={targetsData?.productState ?? null}
          comparison={targetsData?.comparison ?? null}
          productId={targetsData?.productId ?? null}
          rows={targetsData?.rows ?? []}
          notice={notice}
          error={error}
          overrideError={overrideError}
          handoffAction={handoffAdsOptimizerToWorkspaceAction}
          saveRecommendationOverrideAction={saveAdsOptimizerRecommendationOverrideAction}
        />
      ) : (
        <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
          <div className="text-xs uppercase tracking-[0.3em] text-muted">{emptyState.eyebrow}</div>
          <div className="mt-2 text-lg font-semibold text-foreground">{emptyState.title}</div>
          <div className="mt-2 max-w-3xl text-sm text-muted">{emptyState.body}</div>
          <div className="mt-4 rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
            No optimizer tables or recommendation rows are queried in this view yet. The selected
            view remains interactive via URL state only so later loaders and engines can plug into
            this shell without changing the route contract.
          </div>
        </section>
      )}
    </div>
  );
}
