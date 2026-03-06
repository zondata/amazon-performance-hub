import Tabs from '@/components/Tabs';
import KpiCards from '@/components/KpiCards';
import SpTargetsTable from '@/components/ads/SpTargetsTable';
import { getSpTargetsWorkspaceData } from '@/lib/ads/getSpTargetsWorkspaceData';
import { env } from '@/lib/env';
import { fetchAsinOptions } from '@/lib/products/fetchAsinOptions';
import { getDefaultMarketplaceDateRange } from '@/lib/time/defaultDateRange';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const normalizeDate = (value?: string): string | undefined => {
  if (!value) return undefined;
  if (!DATE_RE.test(value)) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return value;
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

type AdsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const buildHref = (params: {
  start: string;
  end: string;
  asin: string;
  channel: string;
  level: string;
  view: string;
}) => {
  const usp = new URLSearchParams({
    start: params.start,
    end: params.end,
    asin: params.asin,
    channel: params.channel,
    level: params.level,
    view: params.view,
  });
  return `/ads/performance?${usp.toString()}`;
};

export default async function AdsPerformancePage({ searchParams }: AdsPageProps) {
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
  const asin = paramValue('asin') ?? 'all';
  const requestedChannel = (paramValue('channel') ?? 'sp').toLowerCase();
  const requestedLevel = (paramValue('level') ?? 'targets').toLowerCase();
  const requestedView = (paramValue('view') ?? 'table').toLowerCase();

  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }

  const channelValue = 'sp';
  const levelValue =
    requestedLevel === 'campaigns' ||
    requestedLevel === 'adgroups' ||
    requestedLevel === 'targets' ||
    requestedLevel === 'placements' ||
    requestedLevel === 'searchterms'
      ? requestedLevel
      : 'targets';
  const viewValue = requestedView === 'trend' ? 'trend' : 'table';
  const shouldLoadTargets = levelValue === 'targets' && viewValue === 'table';

  const workspaceData = shouldLoadTargets
    ? await getSpTargetsWorkspaceData({
        accountId: env.accountId,
        marketplace: env.marketplace,
        start,
        end,
        asinFilter: asin,
      })
    : null;
  const asinOptions =
    workspaceData?.asinOptions ??
    (await fetchAsinOptions(env.accountId, env.marketplace));

  const warnings = [...(workspaceData?.warnings ?? [])];
  if (requestedChannel !== 'sp') {
    warnings.unshift(
      'Only Sponsored Products is enabled in Ads Workspace v1. SB and SD stay visible in the shell but remain disabled.'
    );
  }

  const channelTabs = [
    { label: 'SP', value: 'sp' },
    {
      label: 'SB',
      value: 'sb',
      disabled: true,
      title: 'Sponsored Brands arrives in a later phase.',
    },
    {
      label: 'SD',
      value: 'sd',
      disabled: true,
      title: 'Sponsored Display remains KIV in v1.',
    },
  ].map((item) => ({
    ...item,
    href: buildHref({
      start,
      end,
      asin,
      channel: item.value,
      level: levelValue,
      view: viewValue,
    }),
  }));

  const viewTabs = [
    { label: 'Table', value: 'table' },
    { label: 'Trend', value: 'trend' },
  ].map((item) => ({
    ...item,
    href: buildHref({
      start,
      end,
      asin,
      channel: channelValue,
      level: levelValue,
      view: item.value,
    }),
  }));

  const levelTabs = [
    { label: 'Campaigns', value: 'campaigns' },
    { label: 'Ad Groups', value: 'adgroups' },
    { label: 'Targets', value: 'targets' },
    { label: 'Placements', value: 'placements' },
    { label: 'Search Terms', value: 'searchterms' },
  ].map((item) => ({
    ...item,
    href: buildHref({
      start,
      end,
      asin,
      channel: channelValue,
      level: item.value,
      view: viewValue,
    }),
  }));

  const kpiItems = workspaceData
    ? [
        {
          label: 'Targets',
          value: formatNumber(workspaceData.totals.targets),
          subvalue: `Clicks ${formatNumber(workspaceData.totals.clicks)}`,
        },
        {
          label: 'Spend',
          value: formatCurrency(workspaceData.totals.spend),
          subvalue: `CPC ${formatCurrency(workspaceData.totals.cpc)}`,
        },
        {
          label: 'Sales',
          value: formatCurrency(workspaceData.totals.sales),
          subvalue: `ROAS ${formatNumber(workspaceData.totals.roas)}`,
        },
        {
          label: 'ACOS',
          value: formatPercent(workspaceData.totals.acos),
          subvalue: `Conv. ${formatPercent(workspaceData.totals.conversion)}`,
        },
      ]
    : [];

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted">
              Ads workspace
            </div>
            <div className="mt-2 text-lg font-semibold text-foreground">
              {start} → {end}
            </div>
            <div className="mt-2 max-w-3xl text-sm text-muted">
              SP-first shell. Targets is the first operational tab, while other views stay visible for workspace continuity and land in later phases.
            </div>
          </div>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="channel" value={channelValue} />
            <input type="hidden" name="level" value={levelValue} />
            <input type="hidden" name="view" value={viewValue} />
            <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
              Start
              <input
                type="date"
                name="start"
                defaultValue={start}
                className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
              End
              <input
                type="date"
                name="end"
                defaultValue={end}
                className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
              Product
              <select
                name="asin"
                defaultValue={asin}
                className="mt-1 min-w-[260px] rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
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
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Apply
            </button>
          </form>
        </div>
      </section>

      <section className="space-y-4">
        <Tabs items={channelTabs} current={channelValue} />
        <Tabs items={viewTabs} current={viewValue} />
        <Tabs items={levelTabs} current={levelValue} />
      </section>

      {warnings.length > 0 ? (
        <section className="space-y-3">
          {warnings.map((warning) => (
            <div
              key={warning}
              className="rounded-2xl border border-border bg-surface/80 px-5 py-4 text-sm text-muted shadow-sm"
            >
              {warning}
            </div>
          ))}
        </section>
      ) : null}

      {levelValue !== 'targets' ? (
        <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
          <div className="text-lg font-semibold text-foreground">Coming soon</div>
          <div className="mt-2 text-sm text-muted">
            Targets is the first operational tab in the Ads Workspace. This level stays visible for shell continuity and is intentionally deferred to a later phase.
          </div>
        </section>
      ) : viewValue !== 'table' ? (
        <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
          <div className="text-lg font-semibold text-foreground">
            Trend mode is diagnostic-only and lands later.
          </div>
          <div className="mt-2 text-sm text-muted">
            Table mode remains the default editing surface in SP v1. This phase stops at the initial Targets table.
          </div>
        </section>
      ) : (
        <section className="space-y-6">
          <KpiCards items={kpiItems} />
          <div className="rounded-2xl border border-border bg-surface/80 p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-muted">
                  Targets
                </div>
                <div className="mt-1 text-lg font-semibold text-foreground">
                  {workspaceData?.rows.length.toLocaleString('en-US') ?? 0} target row(s)
                </div>
              </div>
              <div className="max-w-xl text-sm text-muted">
                Draft staging and the Change Composer save flow start in Phase 3. This phase stops at the SP workspace shell plus the initial Targets operational table.
              </div>
            </div>
          </div>
          <SpTargetsTable rows={workspaceData?.rows ?? []} />
        </section>
      )}
    </div>
  );
}
