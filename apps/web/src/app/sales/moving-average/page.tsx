import InlineFilters from '@/components/InlineFilters';
import MovingAverageChart from '@/components/MovingAverageChart';
import { env } from '@/lib/env';
import { computeMovingAverages } from '@/lib/sales/computeMovingAverages';
import { getSalesDaily } from '@/lib/sales/getSalesDaily';

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

type SalesMovingAveragePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SalesMovingAveragePage({
  searchParams,
}: SalesMovingAveragePageProps) {
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

  const data = await getSalesDaily({
    accountId: env.accountId,
    marketplace: env.marketplace,
    start,
    end,
    asin,
  });

  const movingAverageSeries = computeMovingAverages(data.dailySeries).map((row) => ({
    date: row.date,
    sales_7d: row.sales_7d,
    sales_14d: row.sales_14d,
    ppc_cost_7d: row.ppc_cost_7d,
    ppc_cost_14d: row.ppc_cost_14d,
  }));

  return (
    <div className="space-y-8">
      <InlineFilters>
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Moving averages
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

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Smoothed trend
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              7-day and 14-day moving averages
            </div>
          </div>
          <div className="text-xs text-slate-500">
            {movingAverageSeries.length} days
          </div>
        </div>
        {movingAverageSeries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            No sales data for this range.
          </div>
        ) : (
          <MovingAverageChart data={movingAverageSeries} />
        )}
        <p className="mt-4 text-sm text-slate-500">
          Moving averages smooth out daily spikes so you can see underlying trends in
          sales and ad spend.
        </p>
      </section>
    </div>
  );
}
