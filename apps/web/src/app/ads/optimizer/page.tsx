import { notFound } from 'next/navigation';

import OptimizerConfigManager from '@/components/ads-optimizer/OptimizerConfigManager';
import OptimizerHistoryPanel from '@/components/ads-optimizer/OptimizerHistoryPanel';
import OptimizerOverviewPanel from '@/components/ads-optimizer/OptimizerOverviewPanel';
import OptimizerTargetsPanel from '@/components/ads-optimizer/OptimizerTargetsPanel';
import Tabs from '@/components/Tabs';
import {
  activateAdsOptimizerRulePackVersionAction,
  createAdsOptimizerDraftVersionAction,
  handoffAdsOptimizerToWorkspaceAction,
  runAdsOptimizerNowAction,
} from '@/app/ads/optimizer/actions';
import { isAdsOptimizerEnabled } from '@/lib/ads-optimizer/featureFlag';
import { getAdsOptimizerOverviewData } from '@/lib/ads-optimizer/overview';
import { getAdsOptimizerConfigViewData } from '@/lib/ads-optimizer/repoConfig';
import {
  getAdsOptimizerHistoryViewData,
  getAdsOptimizerTargetsViewData,
} from '@/lib/ads-optimizer/runtime';
import {
  ADS_OPTIMIZER_VIEWS,
  normalizeAdsOptimizerView,
  type AdsOptimizerView,
} from '@/lib/ads-optimizer/shell';
import { env } from '@/lib/env';
import { fetchAsinOptions } from '@/lib/products/fetchAsinOptions';
import { getDefaultMarketplaceDateRange } from '@/lib/time/defaultDateRange';
import { formatUiDateRange } from '@/lib/time/formatUiDate';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const normalizeDate = (value?: string): string | undefined => {
  if (!value || !DATE_RE.test(value)) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return value;
};

const buildOptimizerHref = (params: {
  start: string;
  end: string;
  asin: string;
  view: AdsOptimizerView;
}) => {
  const usp = new URLSearchParams({
    start: params.start,
    end: params.end,
    asin: params.asin,
    view: params.view,
  });
  return `/ads/optimizer?${usp.toString()}`;
};

const EMPTY_STATE_COPY: Record<
  AdsOptimizerView,
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
  config: {
    eyebrow: 'Config placeholder',
    title: 'No optimizer config tables are wired yet.',
    body:
      'Rule-pack versions, product settings, and manual overrides are Phase 2 work. This shell intentionally avoids pretending that config storage already exists.',
  },
  history: {
    eyebrow: 'History placeholder',
    title: 'No optimizer run history exists yet.',
    body:
      'Manual runs, snapshot persistence, and audit history are later phases. The route is showing the final shell location only.',
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
  const view = normalizeAdsOptimizerView(paramValue('view'));
  const notice = pickSearchParam(params?.notice);
  const error = pickSearchParam(params?.error);
  const asinOptions = await fetchAsinOptions(env.accountId, env.marketplace);
  const selectedAsin = asinOptions.find((option) => option.asin === asin) ?? null;
  const viewTabs = ADS_OPTIMIZER_VIEWS.map((item) => ({
    label: item.label,
    value: item.value,
    href: buildOptimizerHref({ start, end, asin, view: item.value }),
  }));
  const emptyState = EMPTY_STATE_COPY[view];
  const returnTo = buildOptimizerHref({ start, end, asin, view });
  const overviewData =
    view === 'overview' && asin !== 'all'
      ? await getAdsOptimizerOverviewData({
          accountId: env.accountId,
          marketplace: env.marketplace,
          asin,
          start,
          end,
        })
      : null;
  const configData = view === 'config' ? await getAdsOptimizerConfigViewData() : null;
  const historyData = view === 'history' ? await getAdsOptimizerHistoryViewData(asin) : null;
  const targetsData =
    view === 'targets' && asin !== 'all'
      ? await getAdsOptimizerTargetsViewData({
          asin,
          start,
          end,
        })
      : null;
  const phaseBadge =
    view === 'config'
      ? 'Config foundation only'
      : view === 'overview'
        ? 'Read-only optimizer active'
        : view === 'targets'
          ? 'Review + comparison queue'
          : view === 'history'
            ? 'Recommendation engine'
            : 'Recommendation shell only';

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.3em] text-muted">
              Ads optimizer
            </div>
            <div className="mt-2 text-lg font-semibold text-foreground">
              {formatUiDateRange(start, end)}
            </div>
            <div className="mt-2 max-w-3xl text-sm text-muted">
              Feature-flagged SP optimizer route. Recommendations are reviewed here first, and any
              supported handoff still stages into the existing Ads Workspace rather than executing
              directly from the optimizer.
            </div>
          </div>
          <form
            method="get"
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_auto] xl:items-end"
          >
            <input type="hidden" name="view" value={view} />
            <label className="flex min-w-0 flex-col text-xs uppercase tracking-wide text-muted">
              Start
              <input
                type="date"
                name="start"
                defaultValue={start}
                className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="flex min-w-0 flex-col text-xs uppercase tracking-wide text-muted">
              End
              <input
                type="date"
                name="end"
                defaultValue={end}
                className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="flex min-w-0 flex-col text-xs uppercase tracking-wide text-muted sm:col-span-2 xl:col-span-1">
              Product
              <select
                name="asin"
                defaultValue={asin}
                className="mt-1 w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
              >
                <option value="all">All advertised ASINs</option>
                {asinOptions.map((option) => (
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
              Apply
            </button>
          </form>
        </div>
      </section>

      <section className="space-y-4">
        <Tabs items={viewTabs} current={view} />
      </section>

      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted">Account</div>
            <div className="mt-2 text-sm font-medium text-foreground">{env.accountId}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted">Marketplace</div>
            <div className="mt-2 text-sm font-medium text-foreground">{env.marketplace}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted">ASIN scope</div>
            <div className="mt-2 text-sm font-medium text-foreground">
              {asin === 'all' ? 'All advertised ASINs' : selectedAsin?.label ?? asin}
            </div>
          </div>
        </div>
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

      {view === 'overview' ? (
        <OptimizerOverviewPanel asin={asin} start={start} end={end} data={overviewData} />
      ) : view === 'config' ? (
        <OptimizerConfigManager
          returnTo={returnTo}
          rulePack={configData?.rulePack ?? null}
          activeVersion={configData?.activeVersion ?? null}
          versions={configData?.versions ?? []}
          seeded={configData?.seeded ?? false}
          seedMessage={configData?.seedMessage ?? null}
          notice={notice}
          error={error}
          createDraftAction={createAdsOptimizerDraftVersionAction}
          activateVersionAction={activateAdsOptimizerRulePackVersionAction}
        />
      ) : view === 'history' ? (
        <OptimizerHistoryPanel
          asin={asin}
          start={start}
          end={end}
          returnTo={returnTo}
          activeVersionLabel={historyData?.activeVersionLabel ?? '—'}
          runs={historyData?.runs ?? []}
          notice={notice}
          error={error}
          runNowAction={runAdsOptimizerNowAction}
        />
      ) : view === 'targets' ? (
            <OptimizerTargetsPanel
              asin={asin}
              start={start}
              end={end}
              historyHref={buildOptimizerHref({ start, end, asin, view: 'history' })}
              returnTo={buildOptimizerHref({ start, end, asin, view: 'targets' })}
              workspaceQueueHref={`/ads/performance?${new URLSearchParams({
                panel: 'queue',
                channel: 'sp',
                level: 'targets',
                view: 'table',
                asin,
                start,
                end,
              }).toString()}`}
              run={targetsData?.run ?? null}
              latestCompletedRun={targetsData?.latestCompletedRun ?? null}
              productState={targetsData?.productState ?? null}
              comparison={targetsData?.comparison ?? null}
              rows={targetsData?.rows ?? []}
              handoffAction={handoffAdsOptimizerToWorkspaceAction}
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
