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

type TrendPoint = {
  date: string;
  sales: number;
  ppc_cost: number;
  orders: number;
  units: number;
};

type TrendChartProps = {
  data: TrendPoint[];
};

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

const formatTooltipValue = (value: number | string | undefined) =>
  formatCurrency(Number(value));

const formatTooltipLabel = (label: unknown) =>
  typeof label === 'string' ? formatDate(label) : '';

export default function TrendChart({ data }: TrendChartProps) {
  return (
    <div className="h-80 w-full min-h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            stroke="#94a3b8"
            fontSize={12}
          />
          <YAxis
            tickFormatter={(value) => formatCurrency(Number(value))}
            stroke="#94a3b8"
            fontSize={12}
          />
          <Tooltip
            formatter={formatTooltipValue}
            labelFormatter={formatTooltipLabel}
          />
          <Line
            type="monotone"
            dataKey="sales"
            stroke="#0f172a"
            strokeWidth={2}
            dot={false}
            name="Sales"
          />
          <Line
            type="monotone"
            dataKey="ppc_cost"
            stroke="#f97316"
            strokeWidth={2}
            dot={false}
            name="PPC Cost"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
