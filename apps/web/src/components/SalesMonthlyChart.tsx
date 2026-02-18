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

export type SalesMonthlyChartPoint = {
  month: string;
  sales: number;
  ppc_cost: number;
};

type SalesMonthlyChartProps = {
  data: SalesMonthlyChartPoint[];
};

const formatMonth = (value: string) => {
  const parsed = new Date(`${value}-01T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
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

export default function SalesMonthlyChart({ data }: SalesMonthlyChartProps) {
  return (
    <div className="h-72 w-full min-h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="month" tickFormatter={formatMonth} stroke="#94a3b8" />
          <YAxis tickFormatter={(value) => formatCurrency(Number(value))} stroke="#94a3b8" />
          <Tooltip
            labelFormatter={(label) => (typeof label === 'string' ? formatMonth(label) : '')}
            formatter={(value) => formatCurrency(Number(value))}
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
