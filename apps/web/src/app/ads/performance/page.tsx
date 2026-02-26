import { env } from '@/lib/env';
import { getAdsCampaignsData } from '@/lib/ads/getAdsCampaignsData';
import { getDefaultMarketplaceDateRange } from '@/lib/time/defaultDateRange';
import Tabs from '@/components/Tabs';

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
}) => {
  const usp = new URLSearchParams({
    start: params.start,
    end: params.end,
    asin: params.asin,
    channel: params.channel,
    level: params.level,
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
  const channel = (paramValue('channel') ?? 'sp').toLowerCase();
  const level = (paramValue('level') ?? 'campaigns').toLowerCase();

  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }

  const channelValue = channel === 'sb' || channel === 'sd' ? channel : 'sp';
  const levelValue =
    level === 'adgroups' ||
    level === 'targets' ||
    level === 'placements' ||
    level === 'searchterms'
      ? level
      : 'campaigns';

  const data = await getAdsCampaignsData({
    accountId: env.accountId,
    marketplace: env.marketplace,
    channel: channelValue,
    start,
    end,
    asinFilter: asin,
  });

  const channelTabs = [
    { label: 'SP', value: 'sp' },
    { label: 'SB', value: 'sb' },
    { label: 'SD', value: 'sd' },
  ].map((item) => ({
    ...item,
    href: buildHref({
      start,
      end,
      asin,
      channel: item.value,
      level: levelValue,
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
    }),
  }));

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted">
              Ads performance
            </div>
            <div className="mt-2 text-lg font-semibold text-foreground">
              {start} → {end}
            </div>
          </div>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="channel" value={channelValue} />
            <input type="hidden" name="level" value={levelValue} />
            <input type="hidden" name="asin" value={asin} />
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
        <Tabs items={levelTabs} current={levelValue} />
      </section>

      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="space-y-2 text-sm text-muted">
          {data.notes.asinFilterIgnored ? (
            <div>ASIN filter is not applied for Ads yet.</div>
          ) : null}
          <div>{data.notes.dataDelayNote}</div>
        </div>
      </section>

      {levelValue !== 'campaigns' ? (
        <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
          <div className="text-lg font-semibold text-foreground">Coming soon</div>
          <div className="mt-2 text-sm text-muted">
            This level will be wired once the next facts layer is ready.
          </div>
        </section>
      ) : (
        <section className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-4">
            <div className="rounded-2xl border border-border bg-surface/80 p-5 shadow-sm">
              <div className="text-xs uppercase tracking-[0.25em] text-muted">
                Spend
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {formatCurrency(data.totals.spend)}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-surface/80 p-5 shadow-sm">
              <div className="text-xs uppercase tracking-[0.25em] text-muted">
                Sales
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {formatCurrency(data.totals.sales)}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-surface/80 p-5 shadow-sm">
              <div className="text-xs uppercase tracking-[0.25em] text-muted">
                ACOS
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {formatPercent(data.totals.acos)}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-surface/80 p-5 shadow-sm">
              <div className="text-xs uppercase tracking-[0.25em] text-muted">
                ROAS
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {formatNumber(data.totals.roas)}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-muted">
                  Campaigns
                </div>
                <div className="mt-1 text-lg font-semibold text-foreground">
                  {data.rows.length} campaigns
                </div>
              </div>
            </div>

            {data.rows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
                No campaign data for this range.
              </div>
            ) : (
              <div className="max-h-[520px] overflow-y-auto">
                <div data-aph-hscroll data-aph-hscroll-axis="x" className="overflow-x-auto">
                  <table className="w-full table-fixed text-left text-sm">
                    <thead className="sticky top-0 bg-surface text-xs uppercase tracking-wider text-muted shadow-sm">
                      <tr>
                        <th className="w-40 pb-2">Campaign</th>
                        <th className="w-32 pb-2">Spend</th>
                        <th className="w-32 pb-2">Sales</th>
                        <th className="w-24 pb-2">Orders</th>
                        <th className="w-24 pb-2">Units</th>
                        <th className="w-24 pb-2">CTR</th>
                        <th className="w-24 pb-2">CPC</th>
                        <th className="w-24 pb-2">ACOS</th>
                        <th className="w-24 pb-2">ROAS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.rows.map((row) => (
                        <tr key={row.campaign_id} className="hover:bg-surface-2/70">
                          <td className="py-3 text-foreground">
                            <div
                              className="truncate font-medium"
                              title={row.campaign_name ?? row.campaign_id}
                            >
                              {row.campaign_name ?? row.campaign_id}
                            </div>
                          </td>
                          <td className="py-3 text-muted">
                            {formatCurrency(row.spend)}
                          </td>
                          <td className="py-3 text-muted">
                            {formatCurrency(row.sales)}
                          </td>
                          <td className="py-3 text-muted">
                            {formatNumber(row.orders)}
                          </td>
                          <td className="py-3 text-muted">
                            {formatNumber(row.units)}
                          </td>
                          <td className="py-3 text-muted">
                            {formatPercent(row.ctr)}
                          </td>
                          <td className="py-3 text-muted">
                            {formatCurrency(row.cpc)}
                          </td>
                          <td className="py-3 text-muted">
                            {formatPercent(row.acos)}
                          </td>
                          <td className="py-3 text-muted">
                            {formatNumber(row.roas)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
