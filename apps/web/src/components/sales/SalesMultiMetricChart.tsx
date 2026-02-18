'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { SalesMetricKey } from '@/lib/sales/salesMetrics';
import { SALES_METRICS } from '@/lib/sales/salesMetrics';

const metricByKey = Object.fromEntries(
  SALES_METRICS.map((metric) => [metric.key, metric])
) as Record<SalesMetricKey, (typeof SALES_METRICS)[number]>;

const COLORS = [
  '#0f172a',
  '#f97316',
  '#2563eb',
  '#16a34a',
  '#9333ea',
  '#facc15',
  '#0ea5e9',
  '#f43f5e',
];

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const formatCurrency = (value: number) => {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
};

const formatNumber = (value: number) => {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US');
};

const formatPercent = (value: number) => {
  if (!Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
};

const formatMetric = (key: SalesMetricKey, value: number) => {
  const metric = metricByKey[key];
  if (!metric) return String(value ?? '—');
  switch (metric.format) {
    case 'currency':
      return formatCurrency(value);
    case 'percent':
      return formatPercent(value);
    default:
      return formatNumber(value);
  }
};

type SalesMultiMetricChartProps = {
  data: Record<string, unknown>[];
  metrics: SalesMetricKey[];
};

export default function SalesMultiMetricChart({
  data,
  metrics,
}: SalesMultiMetricChartProps) {
  const axisGroups = new Set(
    metrics.map((key) => metricByKey[key]?.axisGroup).filter(Boolean)
  );

  const hasCurrency = axisGroups.has('currency');
  const hasCount = axisGroups.has('count');
  const hasPercent = axisGroups.has('percent');

  return (
    <div className="h-80 w-full min-h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" tickFormatter={formatDate} stroke="#94a3b8" />
          {hasCurrency ? (
            <YAxis
              yAxisId="currency"
              tickFormatter={(value) => formatCurrency(Number(value))}
              stroke="#94a3b8"
            />
          ) : null}
          {hasCount ? (
            <YAxis
              yAxisId="count"
              orientation="right"
              tickFormatter={(value) => formatNumber(Number(value))}
              stroke="#94a3b8"
            />
          ) : null}
          {hasPercent ? (
            <YAxis
              yAxisId="percent"
              orientation="right"
              tickFormatter={(value) => formatPercent(Number(value))}
              stroke="#94a3b8"
              width={hasCount ? 80 : 60}
            />
          ) : null}
          <Tooltip
            labelFormatter={(label) => (typeof label === 'string' ? formatDate(label) : '')}
            formatter={(value, name, props) => {
              const dataKey = props.dataKey as SalesMetricKey | undefined;
              if (!dataKey) return value as string;
              return formatMetric(dataKey, Number(value));
            }}
          />
          {metrics.map((key, index) => {
            const metric = metricByKey[key];
            if (!metric) return null;
            return (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                yAxisId={metric.axisGroup}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={2}
                dot={false}
                name={metric.label}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
