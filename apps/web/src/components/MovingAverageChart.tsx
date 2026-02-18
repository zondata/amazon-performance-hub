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

export type MovingAverageChartPoint = {
  date: string;
  sales_7d: number | null;
  sales_14d: number | null;
  ppc_cost_7d: number | null;
  ppc_cost_14d: number | null;
};

type MovingAverageChartProps = {
  data: MovingAverageChartPoint[];
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

export default function MovingAverageChart({ data }: MovingAverageChartProps) {
  return (
    <div className="h-80 w-full min-h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" tickFormatter={formatDate} stroke="#94a3b8" />
          <YAxis tickFormatter={(value) => formatCurrency(Number(value))} stroke="#94a3b8" />
          <Tooltip
            labelFormatter={(label) => (typeof label === 'string' ? formatDate(label) : '')}
            formatter={(value) => formatCurrency(Number(value))}
          />
          <Line
            type="monotone"
            dataKey="sales_7d"
            stroke="#0f172a"
            strokeWidth={2}
            dot={false}
            name="Sales (7d MA)"
          />
          <Line
            type="monotone"
            dataKey="sales_14d"
            stroke="#64748b"
            strokeWidth={2}
            dot={false}
            name="Sales (14d MA)"
          />
          <Line
            type="monotone"
            dataKey="ppc_cost_7d"
            stroke="#f97316"
            strokeWidth={2}
            dot={false}
            name="PPC Cost (7d MA)"
          />
          <Line
            type="monotone"
            dataKey="ppc_cost_14d"
            stroke="#fdba74"
            strokeWidth={2}
            dot={false}
            name="PPC Cost (14d MA)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
