import Link from 'next/link';

import TrendChart from '@/components/TrendChart';
import { getDashboardData } from '@/lib/dashboard/getDashboardData';

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

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

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const paramValue = (key: string): string | undefined => {
    const value = params?.[key];
    if (!value) return undefined;
    if (Array.isArray(value)) return value[0];
    return value;
  };

  const filters = {
    start: normalizeDate(paramValue('start')),
    end: normalizeDate(paramValue('end')),
    asin: paramValue('asin') && paramValue('asin') !== '' ? paramValue('asin') : undefined,
  };

  const data = await getDashboardData(filters);
  const hasSeries = data.dailySeries.length > 0;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Dashboard filters
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-900">
              {data.filters.start} → {data.filters.end}
            </div>
          </div>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col text-xs uppercase tracking-wide text-slate-500">
              Start
              <input
                type="date"
                name="start"
                defaultValue={data.filters.start}
                className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              />
            </label>
            <label className="flex flex-col text-xs uppercase tracking-wide text-slate-500">
              End
              <input
                type="date"
                name="end"
                defaultValue={data.filters.end}
                className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              />
            </label>
            <label className="flex flex-col text-xs uppercase tracking-wide text-slate-500">
              Product (ASIN)
              <select
                name="asin"
                defaultValue={data.filters.asin}
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
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <div className="text-xs uppercase tracking-[0.25em] text-slate-400">
            Total sales
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {formatCurrency(data.kpis.total_sales)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <div className="text-xs uppercase tracking-[0.25em] text-slate-400">
            PPC cost
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {formatCurrency(data.kpis.total_ppc_cost)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            TACoS {formatPercent(data.kpis.tacos)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <div className="text-xs uppercase tracking-[0.25em] text-slate-400">
            Orders
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {formatNumber(data.kpis.total_orders)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Units {formatNumber(data.kpis.total_units)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <div className="text-xs uppercase tracking-[0.25em] text-slate-400">
            Avg price
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {formatCurrency(data.kpis.avg_selling_price)}
          </div>
          {data.kpis.profit !== null ? (
            <div className="mt-1 text-xs text-slate-500">
              Profit {formatCurrency(data.kpis.profit)} · Margin{' '}
              {formatPercent(data.kpis.profit_margin)}
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Sales vs PPC cost
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              Daily trend
            </div>
          </div>
          <div className="text-xs text-slate-500">
            {data.dailySeries.length} days
          </div>
        </div>
        {hasSeries ? (
          <TrendChart data={data.dailySeries} />
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            No sales trend data for this range.
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Data notes
          </div>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <p>Last 2 days of PPC cost may be non-final due to export latency.</p>
            <p>
              Verify ingestion health in{' '}
              <Link href="/imports-health" className="font-semibold text-slate-900">
                Imports &amp; Health
              </Link>
              .
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Spend reconciliation
          </div>
          <div className="mt-3 text-sm text-slate-600">
            {data.spendReconciliation.enabled ? (
              'recent_flags_count' in data.spendReconciliation ? (
                <div>
                  <div className="text-xl font-semibold text-slate-900">
                    {data.spendReconciliation.recent_flags_count} flagged days
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Latest flag: {data.spendReconciliation.latest_flag_date ?? '—'}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500">
                  Spend reconciliation unavailable (timeout).
                </div>
              )
            ) : (
              <div className="text-sm text-slate-500">Spend reconciliation disabled.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
