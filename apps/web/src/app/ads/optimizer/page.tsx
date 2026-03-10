import { notFound } from 'next/navigation';

import Tabs from '@/components/Tabs';
import { isAdsOptimizerEnabled } from '@/lib/ads-optimizer/featureFlag';
import {
  ADS_OPTIMIZER_VIEWS,
  normalizeAdsOptimizerView,
  type AdsOptimizerView,
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
    eyebrow: 'Overview placeholder',
    title: 'No optimizer overview is available yet.',
    body:
      'Phase 1 only ships the shell. Product command-center metrics, objective classification, and recommendation summaries arrive in later phases.',
  },
  targets: {
    eyebrow: 'Targets placeholder',
    title: 'No target recommendations are loaded yet.',
    body:
      'Target snapshots, reason codes, and recommendation rows depend on the later optimizer runtime tables and engines. This view stays empty by design for now.',
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
  const asinOptions = await fetchAsinOptions(env.accountId, env.marketplace);
  const selectedAsin = asinOptions.find((option) => option.asin === asin) ?? null;
  const viewTabs = ADS_OPTIMIZER_VIEWS.map((item) => ({
    label: item.label,
    value: item.value,
    href: buildOptimizerHref({ start, end, asin, view: item.value }),
  }));
  const emptyState = EMPTY_STATE_COPY[view];

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.3em] text-muted">
              Ads optimizer
            </div>
            <div className="mt-2 text-lg font-semibold text-foreground">
              {start} → {end}
            </div>
            <div className="mt-2 max-w-3xl text-sm text-muted">
              Feature-flagged SP recommendation shell. This route is isolated from the current Ads
              Workspace and does not execute or stage optimizer actions yet.
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
            Recommendation shell only
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="text-xs uppercase tracking-[0.3em] text-muted">{emptyState.eyebrow}</div>
        <div className="mt-2 text-lg font-semibold text-foreground">{emptyState.title}</div>
        <div className="mt-2 max-w-3xl text-sm text-muted">{emptyState.body}</div>
        <div className="mt-4 rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
          No optimizer tables or recommendation rows are queried in Phase 1. The selected view
          remains interactive via URL state only so later loaders and engines can plug into this
          shell without changing the route contract.
        </div>
      </section>
    </div>
  );
}
