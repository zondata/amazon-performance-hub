import SalesTrendInteractive from '@/components/sales/SalesTrendInteractive';
import { env } from '@/lib/env';
import { getCalendarBuckets, type SalesGranularity } from '@/lib/sales/buckets/getCalendarBuckets';
import { getSalesDaily } from '@/lib/sales/getSalesDaily';
import { getDefaultMarketplaceDateRange } from '@/lib/time/defaultDateRange';
import { getPageSettings } from '@/lib/uiSettings/getPageSettings';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const normalizeDate = (value?: string): string | undefined => {
  if (!value) return undefined;
  if (!DATE_RE.test(value)) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return value;
};

const GRANULARITIES: SalesGranularity[] = [
  'daily',
  'weekly',
  'monthly',
  'quarterly',
];

const parseGranularity = (value?: string): SalesGranularity | undefined =>
  GRANULARITIES.includes(value as SalesGranularity)
    ? (value as SalesGranularity)
    : undefined;

const clampCols = (value: number, min = 1, max = 120): number =>
  Math.min(Math.max(value, min), max);

const diffDaysInclusive = (start: string, end: string): number => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diff = endDate.getTime() - startDate.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000)) + 1;
};

type SalesTrendPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SalesTrendPage({ searchParams }: SalesTrendPageProps) {
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
  const startParam = normalizeDate(paramValue('start'));
  const endParam = normalizeDate(paramValue('end'));
  let start = startParam ?? defaults.start;
  let end = endParam ?? defaults.end;
  const asin = paramValue('asin') ?? 'all';

  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }

  const granularityParam = parseGranularity(paramValue('granularity'));
  const colsParamRaw = paramValue('cols');
  const colsParam = colsParamRaw ? Number.parseInt(colsParamRaw, 10) : undefined;
  const lastParam = normalizeDate(paramValue('last'));

  const hasBucketParams =
    granularityParam !== undefined ||
    colsParam !== undefined ||
    lastParam !== undefined;

  let granularity: SalesGranularity;
  let cols: number;
  let last: string;

  if (hasBucketParams) {
    granularity = granularityParam ?? 'weekly';
    cols = clampCols(Number.isFinite(colsParam) ? (colsParam as number) : 12);
    last = lastParam ?? end;
  } else if (!startParam && !endParam) {
    granularity = 'weekly';
    cols = 12;
    last = end;
  } else {
    granularity = 'daily';
    cols = clampCols(diffDaysInclusive(start, end));
    last = end;
  }

  const buckets = getCalendarBuckets({ last, cols, granularity });
  if (buckets.length > 0) {
    start = buckets[0].start;
    end = last;
  }

  const data = await getSalesDaily({
    accountId: env.accountId,
    marketplace: env.marketplace,
    start,
    end,
    asin,
  });

  const defaultSettings = await getPageSettings({
    accountId: env.accountId,
    marketplace: env.marketplace,
    pageKey: 'sales.trend',
  });

  return (
    <SalesTrendInteractive
      dailyRows={data.dailySeries}
      kpiTotals={data.kpis}
      filters={{ start, end, asin }}
      bucketConfig={{ granularity, cols, last }}
      buckets={buckets}
      asinOptions={data.asinOptions}
      defaultSettings={defaultSettings as Record<string, unknown> | null}
    />
  );
}
