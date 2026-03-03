type QueryErrorLike = { message?: string } | null | undefined;

type QueryResult = {
  data?: Array<Record<string, unknown>> | null;
  error?: QueryErrorLike;
};

type SupabaseQueryLike = {
  eq: (column: string, value: unknown) => SupabaseQueryLike;
  lte: (column: string, value: unknown) => SupabaseQueryLike;
  not: (column: string, operator: string, value: unknown) => SupabaseQueryLike;
  order: (column: string, opts: { ascending: boolean }) => SupabaseQueryLike;
  limit: (count: number) => Promise<QueryResult>;
};

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => SupabaseQueryLike;
  };
};

type LoadScaleInsightsFinalizedEndDateParams = {
  supabase: unknown;
  accountId: string;
  marketplace: string;
  asin: string;
  endDateCap: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const parseDateField = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  if (!DATE_RE.test(value)) return null;
  return value;
};

export const loadScaleInsightsFinalizedEndDate = async (
  params: LoadScaleInsightsFinalizedEndDateParams
): Promise<string | null> => {
  const supabase = params.supabase as SupabaseLike;
  const result = await supabase
    .from("si_sales_trend_daily_latest")
    .select("date")
    .eq("account_id", params.accountId)
    .eq("marketplace", params.marketplace)
    .eq("asin", params.asin)
    .lte("date", params.endDateCap)
    .not("sessions", "is", null)
    .order("date", { ascending: false })
    .limit(1);

  if (result.error?.message) {
    throw new Error(`Failed loading finalized Scale Insights end date: ${result.error.message}`);
  }

  const rows = result.data ?? [];
  return parseDateField(rows[0]?.date);
};
