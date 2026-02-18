import Link from 'next/link';

import { env } from '@/lib/env';
import { getProductsData } from '@/lib/products/getProductsData';

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

type ProductsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const paramValue = (key: string): string | undefined => {
    const value = params?.[key];
    if (!value) return undefined;
    return Array.isArray(value) ? value[0] : value;
  };

  const defaults = defaultDateRange();
  let start = normalizeDate(paramValue('start')) ?? defaults.start;
  let end = normalizeDate(paramValue('end')) ?? defaults.end;
  const asinFilter = paramValue('asin') ?? 'all';

  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }

  const data = await getProductsData({
    accountId: env.accountId,
    marketplace: env.marketplace,
    start,
    end,
    asinFilter,
  });

  const rows = data.products;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Products
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
                defaultValue={asinFilter}
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

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Product performance
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {rows.length} products
            </div>
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            No products found for this range.
          </div>
        ) : (
          <div className="max-h-[520px] overflow-y-auto">
            <div data-aph-hscroll data-aph-hscroll-axis="x" className="overflow-x-auto">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="sticky top-0 bg-white text-xs uppercase tracking-wider text-slate-400 shadow-sm">
                  <tr>
                    <th className="w-32 pb-2">ASIN</th>
                    <th className="w-72 pb-2">Title</th>
                    <th className="w-28 pb-2">Sales</th>
                    <th className="w-24 pb-2">Orders</th>
                    <th className="w-24 pb-2">Units</th>
                    <th className="w-28 pb-2">PPC Cost</th>
                    <th className="w-20 pb-2">TACOS</th>
                    <th className="w-28 pb-2">Avg Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const href = `/products/${row.asin}?start=${start}&end=${end}`;
                    return (
                      <tr key={row.asin} className="hover:bg-slate-50">
                        <td className="py-3 font-medium text-slate-900">
                          <Link href={href} className="hover:underline">
                            {row.asin}
                          </Link>
                        </td>
                        <td className="py-3 text-slate-600">
                          <span className="block truncate" title={row.title ?? undefined}>
                            {row.title ?? '—'}
                          </span>
                        </td>
                        <td className="py-3 text-slate-600">
                          {formatCurrency(row.sales)}
                        </td>
                        <td className="py-3 text-slate-600">
                          {formatNumber(row.orders)}
                        </td>
                        <td className="py-3 text-slate-600">
                          {formatNumber(row.units)}
                        </td>
                        <td className="py-3 text-slate-600">
                          {formatCurrency(row.ppc_cost)}
                        </td>
                        <td className="py-3 text-slate-600">
                          {formatPercent(row.tacos)}
                        </td>
                        <td className="py-3 text-slate-600">
                          {formatCurrency(row.avg_sales_price)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
