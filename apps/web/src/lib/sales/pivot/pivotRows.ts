import type { BucketTotals, SummaryTotals } from './bucketAggregate';
import {
  DISPLAY_ORDER,
  PROFITS_BREAKDOWN,
  SALES_METRICS,
  type SalesMetricKey,
} from '../salesMetrics';

export type PivotMetricRow = {
  type: 'metric';
  metricKey: SalesMetricKey;
  label: string;
  summaryValue: number | null;
  bucketValues: Array<number | null>;
  sparkValues: Array<number | null>;
};

export type PivotGroupRow = {
  type: 'group';
  metricKey: SalesMetricKey;
  label: string;
  summaryValue: number | null;
  bucketValues: Array<number | null>;
  sparkValues: Array<number | null>;
  children: PivotMetricRow[];
};

export type PivotRow = PivotMetricRow | PivotGroupRow;

const hasAnyValue = (summaryValue: number | null, bucketValues: Array<number | null>) =>
  summaryValue !== null || bucketValues.some((value) => value !== null);

export const buildPivotRows = (
  bucketTotals: BucketTotals,
  summaryTotals: SummaryTotals,
  options: { metrics?: typeof SALES_METRICS; enabledMetrics?: SalesMetricKey[] } = {}
): PivotRow[] => {
  const metrics = options.metrics ?? SALES_METRICS;
  const metricByKey = new Map(metrics.map((metric) => [metric.key, metric]));
  const enabled = options.enabledMetrics ? new Set(options.enabledMetrics) : null;
  const bucketCount = Object.values(bucketTotals)[0]?.length ?? 0;
  const emptyBuckets = Array.from({ length: bucketCount }, () => null);

  const buildMetricRow = (
    key: SalesMetricKey,
    options: { allowEmpty?: boolean } = {}
  ): PivotMetricRow | null => {
    const metric = metricByKey.get(key);
    if (!metric) return null;
    if (enabled && !enabled.has(key)) return null;
    const summaryValue = summaryTotals[key] ?? null;
    const bucketValues = bucketTotals[key] ?? emptyBuckets;
    if (!options.allowEmpty && !hasAnyValue(summaryValue, bucketValues)) return null;
    return {
      type: 'metric',
      metricKey: key,
      label: metric.label,
      summaryValue,
      bucketValues,
      sparkValues: bucketValues,
    };
  };

  const orderKeys = DISPLAY_ORDER.filter((key) => metricByKey.has(key));
  const rows: PivotRow[] = [];
  const childKeys = new Set<SalesMetricKey>(PROFITS_BREAKDOWN.childKeys);

  orderKeys.forEach((key) => {
    if (key === PROFITS_BREAKDOWN.parentKey) {
      const parentMetric = metricByKey.get(key);
      if (!parentMetric) return;
      const parentSummary = summaryTotals[key] ?? null;
      const parentBuckets = bucketTotals[key] ?? [];
      const parentHasData = hasAnyValue(parentSummary, parentBuckets);
      const parentEnabled = !enabled || enabled.has(key);

      const children = PROFITS_BREAKDOWN.childKeys
        .map((childKey) => buildMetricRow(childKey, { allowEmpty: true }))
        .filter((row): row is PivotMetricRow => Boolean(row));

      if (!parentEnabled && children.length === 0) return;
      if (!parentHasData && children.length === 0) return;

      rows.push({
        type: 'group',
        metricKey: key,
        label: parentMetric.label,
        summaryValue: parentHasData ? parentSummary : null,
        bucketValues: parentHasData ? parentBuckets : parentBuckets.map(() => null),
        sparkValues: parentHasData ? parentBuckets : parentBuckets.map(() => null),
        children,
      });
      return;
    }

    if (childKeys.has(key)) return;

    const row = buildMetricRow(key);
    if (row) rows.push(row);
  });

  return rows;
};
