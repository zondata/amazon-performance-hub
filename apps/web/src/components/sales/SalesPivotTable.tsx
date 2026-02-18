'use client';

import type { CSSProperties } from 'react';

import type { CalendarBucket } from '@/lib/sales/buckets/getCalendarBuckets';
import type { PivotRow } from '@/lib/sales/pivot/pivotRows';
import type { SalesMetricKey } from '@/lib/sales/salesMetrics';

const formatRange = (start: string, end: string) =>
  start === end ? start : `${start} - ${end}`;

const buildSparkPoints = (values: Array<number | null>, width: number, height: number) => {
  const valid = values
    .map((value, index) => ({ value, index }))
    .filter((point) => point.value !== null && Number.isFinite(point.value));

  if (valid.length === 0) return null;

  const min = Math.min(...valid.map((point) => point.value as number));
  const max = Math.max(...valid.map((point) => point.value as number));
  const range = max - min || 1;

  return valid
    .map((point) => {
      const x = (point.index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((point.value as number) - min) / range * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
};

type SalesPivotTableProps = {
  buckets: CalendarBucket[];
  rows: PivotRow[];
  formatValue: (key: SalesMetricKey, value?: number | null) => string;
};

export default function SalesPivotTable({
  buckets,
  rows,
  formatValue,
}: SalesPivotTableProps) {
  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white/90"
      style={
        {
          '--kpi-col-w': '220px',
          '--summary-col-w': '140px',
        } as CSSProperties
      }
    >
      <div className="overflow-x-auto">
        <table className="min-w-max w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="sticky top-0 bg-white text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="sticky left-0 z-30 w-[var(--kpi-col-w)] bg-white px-4 py-3 text-left shadow-sm">
                KPI
              </th>
              <th className="sticky left-[var(--kpi-col-w)] z-30 w-[var(--summary-col-w)] bg-white px-4 py-3 text-left shadow-sm">
                Summary
              </th>
              {buckets.map((bucket) => (
                <th key={bucket.key} className="px-4 py-3 text-left">
                  <div className="text-sm font-semibold text-slate-700">
                    {bucket.label}
                  </div>
                  <div className="mt-1 text-[11px] font-normal text-slate-400">
                    {formatRange(bucket.start, bucket.end)}
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 text-left">Analysis</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const sparkPoints = buildSparkPoints(row.sparkValues, 120, 36);
              return (
                <tr key={row.metricKey} className="hover:bg-slate-50">
                  <td className="sticky left-0 z-20 w-[var(--kpi-col-w)] bg-white px-4 py-3 font-semibold text-slate-700 shadow-[2px_0_0_rgba(226,232,240,0.8)]">
                    {row.label}
                  </td>
                  <td className="sticky left-[var(--kpi-col-w)] z-20 w-[var(--summary-col-w)] bg-white px-4 py-3 text-slate-700 shadow-[2px_0_0_rgba(226,232,240,0.8)]">
                    {formatValue(row.metricKey, row.summaryValue)}
                  </td>
                  {row.bucketValues.map((value, index) => (
                    <td key={`${row.metricKey}-${index}`} className="px-4 py-3 text-slate-600">
                      {formatValue(row.metricKey, value)}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    {sparkPoints ? (
                      <svg width="120" height="36" viewBox="0 0 120 36">
                        <polyline
                          fill="none"
                          stroke="#0f172a"
                          strokeWidth="2"
                          points={sparkPoints}
                        />
                      </svg>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
