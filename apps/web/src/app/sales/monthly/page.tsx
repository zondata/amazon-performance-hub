import InlineFilters from '@/components/InlineFilters';
import KpiCards from '@/components/KpiCards';
import SalesMonthlyChart from '@/components/SalesMonthlyChart';
import Table from '@/components/Table';
import { env } from '@/lib/env';
import { getSalesMonthly } from '@/lib/sales/getSalesMonthly';

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

type SalesMonthlyPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SalesMonthlyPage({ searchParams }: SalesMonthlyPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const paramValue = (key: string): string | undefined => {
    const value = params?.[key];
    if (!value) return undefined;
    return Array.isArray(value) ? value[0] : value;
  };

  const defaults = defaultDateRange();
  let start = normalizeDate(paramValue('start')) ?? defaults.start;
  let end = normalizeDate(paramValue('end')) ?? defaults.end;
  const asin = paramValue('asin') ?? 'all';

  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }

  const data = await getSalesMonthly({
    accountId: env.accountId,
    marketplace: env.marketplace,
    start,
    end,
    asin,
  });

  const kpis = [
    { label: 'Sales', value: formatCurrency(data.kpis.sales) },
    { label: 'Orders', value: formatNumber(data.kpis.orders) },
    { label: 'Units', value: formatNumber(data.kpis.units) },
    { label: 'PPC Cost', value: formatCurrency(data.kpis.ppc_cost) },
    { label: 'TACOS', value: formatPercent(data.kpis.tacos) },
    { label: 'Avg Price', value: formatCurrency(data.kpis.avg_price) },
  ];

  const chartSeries = data.monthlySeries.map((row) => ({
    month: row.month,
    sales: row.sales,
    ppc_cost: row.ppc_cost,
  }));

  const tableRows = data.monthlySeries.map((row) => [
    row.month,
    formatCurrency(row.sales),
    formatNumber(row.orders),
    formatNumber(row.units),
    formatCurrency(row.ppc_cost),
    formatPercent(row.tacos),
    formatCurrency(row.avg_price),
  ]);

  return (
    <div className="space-y-8">
      <InlineFilters>
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Monthly rollup
          </div>
          <div className="mt-2 text-lg font-semibold text-slate-900">
            {start} → {end}
          </div>
        </div>
        <form method="get" className="flex flex-wrap items-end gap-3">
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
          <label className="flex flex-col text-xs uppercase tracking-wide text-slate-500">
            Product (ASIN)
            <select
              name="asin"
              defaultValue={asin}
              className="mt-1 min-w-[220px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <option value="all">All products</option>
              {data.asinOptions.map((option) => (
                <option key={option.asin} value={option.asin}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Apply
          </button>
        </form>
      </InlineFilters>

      <KpiCards items={kpis} />

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Monthly trend
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {data.monthlySeries.length} months
            </div>
          </div>
        </div>
        {chartSeries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            No monthly data for this range.
          </div>
        ) : (
          <SalesMonthlyChart data={chartSeries} />
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Monthly detail
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {data.monthlySeries.length} months
            </div>
          </div>
        </div>
        <Table
          headers={[
            'Month',
            'Sales',
            'Orders',
            'Units',
            'PPC Cost',
            'TACOS',
            'Avg Price',
          ]}
          rows={tableRows}
          emptyMessage="No monthly data for this range."
        />
      </section>
    </div>
  );
}
