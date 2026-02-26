import Link from 'next/link';

import KpiCards from '@/components/KpiCards';
import { env } from '@/lib/env';
import { getProductsData } from '@/lib/products/getProductsData';
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

type ProductSortField = 'sales' | 'orders' | 'ppc_cost' | 'tacos' | 'acos';
type SortDir = 'asc' | 'desc';

const PRODUCT_SORT_FIELDS = new Set<ProductSortField>([
  'sales',
  'orders',
  'ppc_cost',
  'tacos',
  'acos',
]);

const normalizeSort = (value?: string): ProductSortField => {
  if (!value) return 'sales';
  const normalized = value.trim().toLowerCase() as ProductSortField;
  return PRODUCT_SORT_FIELDS.has(normalized) ? normalized : 'sales';
};

const normalizeDir = (value?: string): SortDir => {
  if (!value) return 'desc';
  return value.trim().toLowerCase() === 'asc' ? 'asc' : 'desc';
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

  const defaults = getDefaultMarketplaceDateRange({
    marketplace: env.marketplace,
    daysBack: 30,
    delayDays: 2,
  });
  let start = normalizeDate(paramValue('start')) ?? defaults.start;
  let end = normalizeDate(paramValue('end')) ?? defaults.end;
  const asinFilter = paramValue('asin') ?? 'all';
  const query = (paramValue('q') ?? '').trim();
  const sort = normalizeSort(paramValue('sort'));
  const dir = normalizeDir(paramValue('dir'));

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

  const queryNorm = query.toLowerCase();
  const filteredRows = data.products.filter((row) => {
    if (!queryNorm) return true;
    const title = row.title?.toLowerCase() ?? '';
    const shortName = row.short_name?.toLowerCase() ?? '';
    const asin = row.asin.toLowerCase();
    return asin.includes(queryNorm) || title.includes(queryNorm) || shortName.includes(queryNorm);
  });

  const valueForSort = (
    row: (typeof filteredRows)[number],
    field: ProductSortField
  ): number | null => {
    switch (field) {
      case 'sales':
        return row.sales;
      case 'orders':
        return row.orders;
      case 'ppc_cost':
        return row.ppc_cost;
      case 'tacos':
        return row.tacos;
      case 'acos':
        return row.acos;
      default:
        return row.sales;
    }
  };

  const rows = [...filteredRows].sort((left, right) => {
    const leftValue = valueForSort(left, sort);
    const rightValue = valueForSort(right, sort);

    const leftMissing = leftValue === null || !Number.isFinite(leftValue);
    const rightMissing = rightValue === null || !Number.isFinite(rightValue);
    if (leftMissing && rightMissing) return left.asin.localeCompare(right.asin);
    if (leftMissing) return 1;
    if (rightMissing) return -1;

    const delta = dir === 'asc' ? leftValue - rightValue : rightValue - leftValue;
    if (delta !== 0) return delta;
    return left.asin.localeCompare(right.asin);
  });

  const totals = rows.reduce(
    (acc, row) => {
      acc.sales += row.sales;
      acc.orders += row.orders;
      acc.units += row.units;
      acc.ppcCost += row.ppc_cost;
      acc.ppcSales += row.ppc_sales;
      return acc;
    },
    { sales: 0, orders: 0, units: 0, ppcCost: 0, ppcSales: 0 }
  );

  const blendedTacos = totals.sales > 0 ? totals.ppcCost / totals.sales : null;
  const blendedAcos = totals.ppcSales > 0 ? totals.ppcCost / totals.ppcSales : null;

  const kpiItems = [
    {
      label: 'Total sales',
      value: formatCurrency(totals.sales),
    },
    {
      label: 'Total orders',
      value: formatNumber(totals.orders),
      subvalue: `Units ${formatNumber(totals.units)}`,
    },
    {
      label: 'Total PPC cost',
      value: formatCurrency(totals.ppcCost),
      subvalue: `Blended TACOS ${formatPercent(blendedTacos)}`,
    },
    {
      label: 'PPC sales',
      value: formatCurrency(totals.ppcSales),
      subvalue: `Blended ACOS ${formatPercent(blendedAcos)}`,
    },
  ];

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted">
              Products
            </div>
            <div className="mt-2 text-lg font-semibold text-foreground">
              {start} → {end}
            </div>
          </div>
          <div className="space-y-3">
            <form method="get" className="flex flex-wrap items-end gap-3">
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
                Product (ASIN)
                <select
                  name="asin"
                  defaultValue={asinFilter}
                  className="mt-1 min-w-[220px] rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                >
                  <option value="all">All products</option>
                  {data.asinOptions.map((option) => (
                    <option key={option.asin} value={option.asin}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
                Search
                <input
                  type="search"
                  name="q"
                  defaultValue={query}
                  placeholder="ASIN, title, short name"
                  className="mt-1 min-w-[220px] rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                />
              </label>
              <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
                Sort
                <select
                  name="sort"
                  defaultValue={sort}
                  className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                >
                  <option value="sales">Sales</option>
                  <option value="orders">Orders</option>
                  <option value="ppc_cost">PPC cost</option>
                  <option value="tacos">TACOS</option>
                  <option value="acos">ACOS</option>
                </select>
              </label>
              <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
                Direction
                <select
                  name="dir"
                  defaultValue={dir}
                  className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                >
                  <option value="desc">Desc</option>
                  <option value="asc">Asc</option>
                </select>
              </label>
              <button
                type="submit"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Apply
              </button>
            </form>
            <div className="flex flex-wrap gap-2">
              <a
                href="/logbook/ai-baseline-prompt-pack"
                download
                className="inline-flex rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-2"
              >
                Download AI Baseline Prompt Pack
              </a>
              <a
                href="/logbook/ai-baseline-data-pack"
                download
                className="inline-flex rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-2"
              >
                Download AI Baseline Data Pack
              </a>
            </div>
          </div>
        </div>
      </section>

      {data.warnings.length > 0 ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="font-semibold">Data warning</div>
          <ul className="mt-2 list-disc pl-5">
            {data.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <KpiCards items={kpiItems} />

      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted">
              Product performance
            </div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {rows.length} products
              {rows.length !== data.products.length ? (
                <span className="ml-2 text-sm font-normal text-muted">
                  (filtered from {data.products.length})
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
            No products found for this range.
          </div>
        ) : (
          <div className="max-h-[520px] overflow-y-auto">
            <div data-aph-hscroll data-aph-hscroll-axis="x" className="overflow-x-auto">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="sticky top-0 bg-surface text-xs uppercase tracking-wider text-muted shadow-sm">
                  <tr>
                    <th className="w-32 pb-2">ASIN</th>
                    <th className="w-72 pb-2">Name</th>
                    <th className="w-28 pb-2">Sales</th>
                    <th className="w-24 pb-2">Orders</th>
                    <th className="w-28 pb-2">PPC Spend</th>
                    <th className="w-20 pb-2">TACOS</th>
                    <th className="w-20 pb-2">ACOS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => {
                    const href = `/products/${row.asin}?start=${start}&end=${end}`;
                    const displayName = row.display_name || row.short_name || row.title || '—';
                    return (
                      <tr key={row.asin} className="hover:bg-surface-2/70">
                        <td className="py-3 font-medium text-foreground">
                          <Link href={href} className="hover:underline">
                            {row.asin}
                          </Link>
                        </td>
                        <td className="py-3 text-muted">
                          <div className="text-sm font-semibold text-foreground">
                            {displayName}
                          </div>
                          <div className="mt-1 text-xs text-muted">{row.asin}</div>
                        </td>
                        <td className="py-3 text-muted">
                          {formatCurrency(row.sales)}
                        </td>
                        <td className="py-3 text-muted">
                          {formatNumber(row.orders)}
                        </td>
                        <td className="py-3 text-muted">
                          {formatCurrency(row.ppc_cost)}
                        </td>
                        <td className="py-3 text-muted">
                          {formatPercent(row.tacos)}
                        </td>
                        <td className="py-3 text-muted">
                          {formatPercent(row.acos)}
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
