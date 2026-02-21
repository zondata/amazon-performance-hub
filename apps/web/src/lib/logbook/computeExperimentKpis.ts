const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const KPI_FIELDS = [
  'sales',
  'orders',
  'units',
  'sessions',
  'conversions',
  'ppc_cost',
  'tacos',
  'profits',
  'roi',
  'margin',
] as const;

export type ExperimentKpiField = (typeof KPI_FIELDS)[number];

export type ExperimentKpiWindow = {
  startDate: string;
  endDate: string;
  days: number;
};

export type ExperimentKpiWindowPair = {
  baseline: ExperimentKpiWindow;
  test: ExperimentKpiWindow;
};

export type ExperimentKpiAggregate = {
  totals: Record<ExperimentKpiField, number>;
  averages: Record<ExperimentKpiField, number | null>;
  rowCount: number;
};

export type ExperimentKpiDelta = {
  absolute: Record<ExperimentKpiField, number | null>;
  percent: Record<ExperimentKpiField, number | null>;
};

export type ExperimentKpiResult = {
  windows: ExperimentKpiWindowPair;
  lagDays: number;
  baseline: ExperimentKpiAggregate;
  test: ExperimentKpiAggregate;
  delta: {
    totals: ExperimentKpiDelta;
    averages: ExperimentKpiDelta;
  };
};

export type ComputeExperimentKpisInput = {
  accountId: string;
  marketplace: string;
  asin: string;
  startDate: string;
  endDate: string;
  lagDays?: number | null;
};

type KpiRow = Partial<Record<ExperimentKpiField, number | string | null>>;

type SupabaseAdminClient = (typeof import('../supabaseAdmin'))['supabaseAdmin'];

let supabaseAdminPromise: Promise<{ supabaseAdmin: SupabaseAdminClient }> | null = null;

const getSupabaseAdmin = async (): Promise<SupabaseAdminClient> => {
  if (!supabaseAdminPromise) {
    supabaseAdminPromise = import('../supabaseAdmin');
  }
  const supabaseModule = await supabaseAdminPromise;
  return supabaseModule.supabaseAdmin;
};

const toDate = (value: string): Date => new Date(`${value}T00:00:00Z`);

const toDateString = (value: Date): string => value.toISOString().slice(0, 10);

const addDays = (value: Date, days: number): Date => {
  const out = new Date(value);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
};

const parseDateOnly = (value: string): string => {
  if (!DATE_RE.test(value)) {
    throw new Error(`Invalid date format: ${value}. Expected YYYY-MM-DD.`);
  }
  const parsed = toDate(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date value: ${value}.`);
  }
  return value;
};

const toFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const emptyTotals = (): Record<ExperimentKpiField, number> => ({
  sales: 0,
  orders: 0,
  units: 0,
  sessions: 0,
  conversions: 0,
  ppc_cost: 0,
  tacos: 0,
  profits: 0,
  roi: 0,
  margin: 0,
});

const emptyAverages = (): Record<ExperimentKpiField, number | null> => ({
  sales: null,
  orders: null,
  units: null,
  sessions: null,
  conversions: null,
  ppc_cost: null,
  tacos: null,
  profits: null,
  roi: null,
  margin: null,
});

const loadWindowAggregate = async (
  input: Pick<ComputeExperimentKpisInput, 'accountId' | 'marketplace' | 'asin'>,
  window: ExperimentKpiWindow
): Promise<ExperimentKpiAggregate> => {
  const supabaseAdmin = await getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from('si_sales_trend_daily_latest')
    .select(KPI_FIELDS.join(','))
    .eq('account_id', input.accountId)
    .eq('marketplace', input.marketplace)
    .eq('asin', input.asin)
    .gte('date', window.startDate)
    .lte('date', window.endDate)
    .order('date', { ascending: true })
    .limit(5000);

  if (error) {
    throw new Error(`Failed to load experiment KPIs: ${error.message}`);
  }

  const rows = (data ?? []) as KpiRow[];
  const totals = emptyTotals();
  const avgSums = emptyTotals();
  const avgCounts: Record<ExperimentKpiField, number> = {
    sales: 0,
    orders: 0,
    units: 0,
    sessions: 0,
    conversions: 0,
    ppc_cost: 0,
    tacos: 0,
    profits: 0,
    roi: 0,
    margin: 0,
  };

  for (const row of rows) {
    for (const field of KPI_FIELDS) {
      const numeric = toFiniteNumber(row[field]);
      if (numeric === null) continue;
      totals[field] += numeric;
      avgSums[field] += numeric;
      avgCounts[field] += 1;
    }
  }

  const averages = emptyAverages();
  for (const field of KPI_FIELDS) {
    averages[field] = avgCounts[field] > 0 ? avgSums[field] / avgCounts[field] : null;
  }

  return {
    totals,
    averages,
    rowCount: rows.length,
  };
};

const computeDelta = (
  baseline: Record<ExperimentKpiField, number | null>,
  test: Record<ExperimentKpiField, number | null>
): ExperimentKpiDelta => {
  const absolute = emptyAverages();
  const percent = emptyAverages();

  for (const field of KPI_FIELDS) {
    const baseValue = baseline[field];
    const testValue = test[field];

    if (baseValue === null || testValue === null) {
      absolute[field] = null;
      percent[field] = null;
      continue;
    }

    const deltaValue = testValue - baseValue;
    absolute[field] = deltaValue;
    percent[field] = baseValue === 0 ? null : deltaValue / baseValue;
  }

  return { absolute, percent };
};

export const computeExperimentKpiWindows = (input: {
  startDate: string;
  endDate: string;
  lagDays?: number | null;
}): ExperimentKpiWindowPair & { lagDays: number } => {
  const startDate = parseDateOnly(input.startDate);
  const endDate = parseDateOnly(input.endDate);
  const start = toDate(startDate);
  const end = toDate(endDate);

  if (end < start) {
    throw new Error(`Invalid experiment window: endDate (${endDate}) is before startDate (${startDate}).`);
  }

  const lagDays = Math.max(0, Math.floor(input.lagDays ?? 0));
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;

  const shiftedTestStart = addDays(start, lagDays);
  const shiftedTestEnd = addDays(end, lagDays);
  const baselineEnd = addDays(start, -1);
  const baselineStart = addDays(baselineEnd, -(days - 1));

  return {
    lagDays,
    baseline: {
      startDate: toDateString(baselineStart),
      endDate: toDateString(baselineEnd),
      days,
    },
    test: {
      startDate: toDateString(shiftedTestStart),
      endDate: toDateString(shiftedTestEnd),
      days,
    },
  };
};

export const computeExperimentKpis = async (
  input: ComputeExperimentKpisInput
): Promise<ExperimentKpiResult> => {
  const asin = input.asin.trim().toUpperCase();
  if (!asin) {
    throw new Error('ASIN is required for KPI computation.');
  }

  const windows = computeExperimentKpiWindows({
    startDate: input.startDate,
    endDate: input.endDate,
    lagDays: input.lagDays,
  });

  const [baseline, test] = await Promise.all([
    loadWindowAggregate(input, windows.baseline),
    loadWindowAggregate(input, windows.test),
  ]);

  return {
    windows: {
      baseline: windows.baseline,
      test: windows.test,
    },
    lagDays: windows.lagDays,
    baseline,
    test,
    delta: {
      totals: computeDelta(baseline.totals, test.totals),
      averages: computeDelta(baseline.averages, test.averages),
    },
  };
};
