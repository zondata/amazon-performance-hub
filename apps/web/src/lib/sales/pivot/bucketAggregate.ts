import type { CalendarBucket } from '../buckets/getCalendarBuckets';
import { SALES_METRICS, type SalesMetricKey } from '../salesMetrics';

type DailyRow = {
  date: string;
} & Record<string, number | string | null | undefined>;

export type BucketTotals = Record<SalesMetricKey, Array<number | null>>;
export type SummaryTotals = Record<SalesMetricKey, number | null>;

const numberValue = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return null;
  return numeric;
};

export const bucketAggregate = (
  dailyRows: DailyRow[],
  buckets: CalendarBucket[],
  metrics = SALES_METRICS
): {
  bucketTotals: BucketTotals;
  summaryTotals: SummaryTotals;
} => {
  const sumKeys = new Set<SalesMetricKey>();
  metrics.forEach((metric) => {
    if (metric.kind === 'sum') {
      sumKeys.add(metric.key);
    } else if (metric.numeratorKey && metric.denominatorKey) {
      sumKeys.add(metric.numeratorKey);
      sumKeys.add(metric.denominatorKey);
    }
  });

  const bucketSums = {} as Record<SalesMetricKey, number[]>;
  const summarySums = {} as Record<SalesMetricKey, number>;
  const seenValues = {} as Record<SalesMetricKey, boolean>;

  Array.from(sumKeys).forEach((key) => {
    bucketSums[key] = buckets.map(() => 0);
    summarySums[key] = 0;
    seenValues[key] = false;
  });

  let bucketIndex = 0;

  dailyRows.forEach((row) => {
    const date = row.date;
    if (!date) return;

    while (bucketIndex < buckets.length && date > buckets[bucketIndex].end) {
      bucketIndex += 1;
    }
    if (bucketIndex >= buckets.length) return;
    if (date < buckets[bucketIndex].start) return;

    sumKeys.forEach((key) => {
      const value = numberValue(row[key]);
      if (value === null) return;
      seenValues[key] = true;
      bucketSums[key][bucketIndex] += value;
      summarySums[key] += value;
    });
  });

  const bucketTotals = {} as BucketTotals;
  const summaryTotals = {} as SummaryTotals;

  metrics.forEach((metric) => {
    if (metric.kind === 'sum') {
      if (!seenValues[metric.key]) {
        bucketTotals[metric.key] = buckets.map(() => null);
        summaryTotals[metric.key] = null;
        return;
      }
      bucketTotals[metric.key] = bucketSums[metric.key].map((value) => value);
      summaryTotals[metric.key] = summarySums[metric.key];
      return;
    }

    const numeratorKey = metric.numeratorKey;
    const denominatorKey = metric.denominatorKey;
    if (!numeratorKey || !denominatorKey) {
      bucketTotals[metric.key] = buckets.map(() => null);
      summaryTotals[metric.key] = null;
      return;
    }

    if (!seenValues[numeratorKey] || !seenValues[denominatorKey]) {
      bucketTotals[metric.key] = buckets.map(() => null);
      summaryTotals[metric.key] = null;
      return;
    }

    bucketTotals[metric.key] = bucketSums[numeratorKey].map((numerator, index) => {
      const denominator = bucketSums[denominatorKey][index];
      if (denominator <= 0) return null;
      return numerator / denominator;
    });

    const summaryDenominator = summarySums[denominatorKey];
    summaryTotals[metric.key] =
      summaryDenominator > 0 ? summarySums[numeratorKey] / summaryDenominator : null;
  });

  return { bucketTotals, summaryTotals };
};
