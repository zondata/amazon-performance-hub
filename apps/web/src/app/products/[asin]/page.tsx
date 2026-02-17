import Link from 'next/link';

import KpiCards from '@/components/KpiCards';
import Tabs from '@/components/Tabs';
import TrendChart from '@/components/TrendChart';
import { env } from '@/lib/env';
import { getProductDetailData } from '@/lib/products/getProductDetailData';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const normalizeDate = (value?: string): string | undefined => {
  if (!value) return undefined;
  if (!DATE_RE.test(value)) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return value;
};

const toDateString = (value: Date): string => value.toISOString().slice(0, 10);

const defaultDateRange = () => {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 30);
  return { start: toDateString(start), end: toDateString(end) };
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

type ProductDetailPageProps = {
  params: Promise<{ asin: string }> | { asin: string };
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const buildTabHref = (asin: string, tab: string, start: string, end: string) =>
  `/products/${asin}?start=${start}&end=${end}&tab=${tab}`;

export default async function ProductDetailPage({
  params,
  searchParams,
}: ProductDetailPageProps) {
  const resolvedParams = params instanceof Promise ? await params : params;
  const asin = resolvedParams.asin.trim().toUpperCase();
  const paramsMap = searchParams ? await searchParams : undefined;
  const paramValue = (key: string): string | undefined => {
    const value = paramsMap?.[key];
    if (!value) return undefined;
    return Array.isArray(value) ? value[0] : value;
  };

  const defaults = defaultDateRange();
  let start = normalizeDate(paramValue('start')) ?? defaults.start;
  let end = normalizeDate(paramValue('end')) ?? defaults.end;
  const tab = paramValue('tab') ?? 'overview';

  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }

  const data = await getProductDetailData({
    accountId: env.accountId,
    marketplace: env.marketplace,
    asin,
    start,
    end,
  });

  const kpiItems = [
    {
      label: 'Sales',
      value: formatCurrency(data.kpis.total_sales),
    },
    {
      label: 'Orders',
      value: formatNumber(data.kpis.total_orders),
      subvalue: `Units ${formatNumber(data.kpis.total_units)}`,
    },
    {
      label: 'PPC cost',
      value: formatCurrency(data.kpis.total_ppc_cost),
      subvalue: `TACOS ${formatPercent(data.kpis.tacos)}`,
    },
    {
      label: 'Avg price',
      value: formatCurrency(data.kpis.avg_selling_price),
    },
  ];

  const tabs = [
    { label: 'Overview', value: 'overview' },
    { label: 'Sales', value: 'sales' },
    { label: 'Logbook', value: 'logbook' },
    { label: 'Costs', value: 'costs' },
    { label: 'Ads', value: 'ads' },
    { label: 'SQP', value: 'sqp' },
    { label: 'Ranking', value: 'ranking' },
  ].map((item) => ({
    ...item,
    href: buildTabHref(asin, item.value, start, end),
  }));

  const trendSeries = data.salesSeries.map((row) => ({
    date: row.date ?? '',
    sales: Number(row.sales ?? 0),
    ppc_cost: Number(row.ppc_cost ?? 0),
    orders: Number(row.orders ?? 0),
    units: Number(row.units ?? 0),
  }));

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Product detail
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">
              {data.productMeta.title ?? asin}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              ASIN {asin} · {start} → {end}
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-4 text-sm text-slate-500">
            <form method="get" className="flex flex-wrap items-end gap-3">
              {tab ? <input type="hidden" name="tab" value={tab} /> : null}
              <label className="flex flex-col text-xs uppercase tracking-wide text-slate-500">
                Start
                <input
                  type="date"
                  name="start"
                  defaultValue={start}
                  className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                />
              </label>
              <label className="flex flex-col text-xs uppercase tracking-wide text-slate-500">
                End
                <input
                  type="date"
                  name="end"
                  defaultValue={end}
                  className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                />
              </label>
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Apply
              </button>
            </form>
            <Link href={`/imports-health`} className="font-semibold text-slate-900">
              View Imports &amp; Health
            </Link>
          </div>
        </div>
        <div className="mt-4 text-xs text-slate-500">
          Data is delayed 48h while ads finalize.
        </div>
      </section>

      <Tabs items={tabs} current={tab} />

      {tab === 'overview' ? (
        <div className="space-y-6">
          <KpiCards items={kpiItems} />
          <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
            <div className="mb-4">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Sales vs PPC cost
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                Daily trend
              </div>
            </div>
            {trendSeries.length > 0 ? (
              <TrendChart data={trendSeries} />
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No sales trend data for this range.
              </div>
            )}
          </section>
        </div>
      ) : null}

      {tab === 'sales' ? (
        <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <div className="mb-4 text-lg font-semibold text-slate-900">Daily sales</div>
          {data.salesSeries.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              No sales data for this range.
            </div>
          ) : (
            <div className="max-h-[480px] overflow-auto">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="sticky top-0 bg-white text-xs uppercase tracking-wider text-slate-400 shadow-sm">
                  <tr>
                    <th className="w-28 pb-2">Date</th>
                    <th className="w-28 pb-2">Sales</th>
                    <th className="w-24 pb-2">Orders</th>
                    <th className="w-24 pb-2">Units</th>
                    <th className="w-28 pb-2">PPC Cost</th>
                    <th className="w-28 pb-2">Avg Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.salesSeries.map((row, index) => (
                    <tr
                      key={row.date ?? `row-${index}`}
                      className="hover:bg-slate-50"
                    >
                      <td className="py-3 text-slate-600">{row.date ?? '—'}</td>
                      <td className="py-3 text-slate-600">
                        {formatCurrency(Number(row.sales ?? 0))}
                      </td>
                      <td className="py-3 text-slate-600">
                        {formatNumber(Number(row.orders ?? 0))}
                      </td>
                      <td className="py-3 text-slate-600">
                        {formatNumber(Number(row.units ?? 0))}
                      </td>
                      <td className="py-3 text-slate-600">
                        {formatCurrency(Number(row.ppc_cost ?? 0))}
                      </td>
                      <td className="py-3 text-slate-600">
                        {formatCurrency(Number(row.avg_sales_price ?? 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {tab === 'logbook' ? (
        <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <div className="mb-4 text-lg font-semibold text-slate-900">Logbook</div>
          {data.logbook.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              No logbook entries for this product.
            </div>
          ) : (
            <div className="space-y-3">
              {data.logbook.map((entry, index) => (
                <div
                  key={`${entry.change_id}-${index}`}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="font-semibold text-slate-900">
                      {entry.change_type}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(entry.occurred_at).toLocaleString('en-US')}
                    </div>
                  </div>
                  <div className="mt-1 text-sm text-slate-600">{entry.summary}</div>
                  {entry.why ? (
                    <div className="mt-1 text-xs text-slate-500">Why: {entry.why}</div>
                  ) : null}
                  <div className="mt-1 text-xs text-slate-400">
                    Source: {entry.source}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {tab === 'costs' ? (
        <section className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
            <div className="mb-3 text-lg font-semibold text-slate-900">Current cost</div>
            {data.currentCosts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No current cost records.
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full table-fixed text-left text-sm">
                  <thead className="text-xs uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="w-40 pb-2">SKU</th>
                      <th className="w-28 pb-2">Currency</th>
                      <th className="w-32 pb-2">Landed cost</th>
                      <th className="w-32 pb-2">Valid from</th>
                      <th className="w-32 pb-2">Valid to</th>
                      <th className="w-40 pb-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.currentCosts.map((row, idx) => (
                      <tr key={`${row.sku ?? 'sku'}-${idx}`}>
                        <td className="py-3 text-slate-600">{row.sku ?? '—'}</td>
                        <td className="py-3 text-slate-600">{row.currency ?? '—'}</td>
                        <td className="py-3 text-slate-600">
                          {formatCurrency(Number(row.landed_cost_per_unit ?? 0))}
                        </td>
                        <td className="py-3 text-slate-600">{row.valid_from ?? '—'}</td>
                        <td className="py-3 text-slate-600">{row.valid_to ?? '—'}</td>
                        <td className="py-3 text-slate-600">{row.notes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
            <div className="mb-3 text-lg font-semibold text-slate-900">Cost history</div>
            {data.costHistory.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No cost history records.
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full table-fixed text-left text-sm">
                  <thead className="text-xs uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="w-40 pb-2">SKU ID</th>
                      <th className="w-32 pb-2">Valid from</th>
                      <th className="w-32 pb-2">Valid to</th>
                      <th className="w-28 pb-2">Currency</th>
                      <th className="w-32 pb-2">Landed cost</th>
                      <th className="w-32 pb-2">Supplier</th>
                      <th className="w-40 pb-2">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.costHistory.map((row, idx) => (
                      <tr key={`${row.sku_id ?? 'sku'}-${idx}`}>
                        <td className="py-3 text-slate-600">{row.sku_id ?? '—'}</td>
                        <td className="py-3 text-slate-600">{row.valid_from ?? '—'}</td>
                        <td className="py-3 text-slate-600">{row.valid_to ?? '—'}</td>
                        <td className="py-3 text-slate-600">{row.currency ?? '—'}</td>
                        <td className="py-3 text-slate-600">
                          {formatCurrency(Number(row.landed_cost_per_unit ?? 0))}
                        </td>
                        <td className="py-3 text-slate-600">
                          {formatCurrency(Number(row.supplier_cost ?? 0))}
                        </td>
                        <td className="py-3 text-slate-600">{row.created_at ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {tab === 'ads' || tab === 'sqp' || tab === 'ranking' ? (
        <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <div className="text-lg font-semibold text-slate-900">Coming soon</div>
          <div className="mt-2 text-sm text-slate-500">
            This section will be wired once the next facts layer is ready.
          </div>
        </section>
      ) : null}
    </div>
  );
}
