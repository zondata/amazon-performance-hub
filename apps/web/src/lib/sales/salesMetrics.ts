export type SalesMetricKey =
  | 'sales'
  | 'orders'
  | 'units'
  | 'ppc_cost'
  | 'tacos'
  | 'avg_sales_price'
  | 'profits'
  | 'margin'
  | 'ppc_sales'
  | 'ppc_orders'
  | 'ppc_units'
  | 'ppc_clicks'
  | 'ppc_impressions'
  | 'acos'
  | 'ctr'
  | 'cost_per_click'
  | 'ppc_cost_per_order'
  | 'sessions'
  | 'organic_orders'
  | 'organic_units'
  | 'payout';

export type SalesMetricKind = 'sum' | 'ratio';

type SalesMetric = {
  key: SalesMetricKey;
  label: string;
  group: string;
  format: 'currency' | 'number' | 'percent';
  axisGroup: 'currency' | 'count' | 'percent';
  kind: SalesMetricKind;
  numeratorKey?: SalesMetricKey;
  denominatorKey?: SalesMetricKey;
};

export const SALES_METRICS: SalesMetric[] = [
  {
    key: 'sales',
    label: 'Sales',
    group: 'Revenue',
    format: 'currency',
    axisGroup: 'currency',
    kind: 'sum',
  },
  {
    key: 'avg_sales_price',
    label: 'Avg Sales Price',
    group: 'Revenue',
    format: 'currency',
    axisGroup: 'currency',
    kind: 'ratio',
    numeratorKey: 'sales',
    denominatorKey: 'units',
  },
  {
    key: 'orders',
    label: 'Orders',
    group: 'Revenue',
    format: 'number',
    axisGroup: 'count',
    kind: 'sum',
  },
  {
    key: 'units',
    label: 'Units',
    group: 'Revenue',
    format: 'number',
    axisGroup: 'count',
    kind: 'sum',
  },
  {
    key: 'profits',
    label: 'Profit',
    group: 'Revenue',
    format: 'currency',
    axisGroup: 'currency',
    kind: 'sum',
  },
  {
    key: 'margin',
    label: 'Margin',
    group: 'Revenue',
    format: 'percent',
    axisGroup: 'percent',
    kind: 'ratio',
    numeratorKey: 'profits',
    denominatorKey: 'sales',
  },
  {
    key: 'payout',
    label: 'Payout',
    group: 'Revenue',
    format: 'currency',
    axisGroup: 'currency',
    kind: 'sum',
  },
  {
    key: 'ppc_cost',
    label: 'PPC Cost',
    group: 'Advertising',
    format: 'currency',
    axisGroup: 'currency',
    kind: 'sum',
  },
  {
    key: 'ppc_sales',
    label: 'PPC Sales',
    group: 'Advertising',
    format: 'currency',
    axisGroup: 'currency',
    kind: 'sum',
  },
  {
    key: 'ppc_orders',
    label: 'PPC Orders',
    group: 'Advertising',
    format: 'number',
    axisGroup: 'count',
    kind: 'sum',
  },
  {
    key: 'ppc_units',
    label: 'PPC Units',
    group: 'Advertising',
    format: 'number',
    axisGroup: 'count',
    kind: 'sum',
  },
  {
    key: 'ppc_clicks',
    label: 'PPC Clicks',
    group: 'Advertising',
    format: 'number',
    axisGroup: 'count',
    kind: 'sum',
  },
  {
    key: 'ppc_impressions',
    label: 'PPC Impressions',
    group: 'Advertising',
    format: 'number',
    axisGroup: 'count',
    kind: 'sum',
  },
  {
    key: 'tacos',
    label: 'TACOS',
    group: 'Advertising',
    format: 'percent',
    axisGroup: 'percent',
    kind: 'ratio',
    numeratorKey: 'ppc_cost',
    denominatorKey: 'sales',
  },
  {
    key: 'acos',
    label: 'ACOS',
    group: 'Advertising',
    format: 'percent',
    axisGroup: 'percent',
    kind: 'ratio',
    numeratorKey: 'ppc_cost',
    denominatorKey: 'ppc_sales',
  },
  {
    key: 'ctr',
    label: 'CTR',
    group: 'Advertising',
    format: 'percent',
    axisGroup: 'percent',
    kind: 'ratio',
    numeratorKey: 'ppc_clicks',
    denominatorKey: 'ppc_impressions',
  },
  {
    key: 'cost_per_click',
    label: 'Cost Per Click',
    group: 'Advertising',
    format: 'currency',
    axisGroup: 'currency',
    kind: 'ratio',
    numeratorKey: 'ppc_cost',
    denominatorKey: 'ppc_clicks',
  },
  {
    key: 'ppc_cost_per_order',
    label: 'PPC Cost / Order',
    group: 'Advertising',
    format: 'currency',
    axisGroup: 'currency',
    kind: 'ratio',
    numeratorKey: 'ppc_cost',
    denominatorKey: 'ppc_orders',
  },
  {
    key: 'sessions',
    label: 'Sessions',
    group: 'Traffic',
    format: 'number',
    axisGroup: 'count',
    kind: 'sum',
  },
  {
    key: 'organic_orders',
    label: 'Organic Orders',
    group: 'Traffic',
    format: 'number',
    axisGroup: 'count',
    kind: 'sum',
  },
  {
    key: 'organic_units',
    label: 'Organic Units',
    group: 'Traffic',
    format: 'number',
    axisGroup: 'count',
    kind: 'sum',
  },
];

export const DEFAULT_ENABLED_METRICS: SalesMetricKey[] = [
  'sales',
  'orders',
  'units',
  'ppc_cost',
  'tacos',
  'avg_sales_price',
  'ppc_sales',
  'ppc_clicks',
  'ppc_impressions',
  'sessions',
  'profits',
  'margin',
];

export const DEFAULT_KPI_CARD_SLOTS: SalesMetricKey[] = [
  'sales',
  'orders',
  'units',
  'ppc_cost',
  'tacos',
  'avg_sales_price',
  'profits',
  'margin',
];

export const SALES_METRIC_KEYS = new Set(SALES_METRICS.map((metric) => metric.key));
