import type { BucketTotals, SummaryTotals } from './bucketAggregate';
import { SALES_METRICS, type SalesMetricKey } from '../salesMetrics';

export type PivotRow = {
  metricKey: SalesMetricKey;
  label: string;
  summaryValue: number | null;
  bucketValues: Array<number | null>;
  sparkValues: Array<number | null>;
};

export const buildPivotRows = (
  bucketTotals: BucketTotals,
  summaryTotals: SummaryTotals,
  metrics = SALES_METRICS
): PivotRow[] =>
  metrics.map((metric) => ({
    metricKey: metric.key,
    label: metric.label,
    summaryValue: summaryTotals[metric.key] ?? null,
    bucketValues: bucketTotals[metric.key] ?? [],
    sparkValues: bucketTotals[metric.key] ?? [],
  }));
