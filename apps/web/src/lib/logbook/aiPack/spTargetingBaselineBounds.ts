export type DateBounds = {
  minDate: string | null;
  maxDate: string | null;
};

type QueryErrorLike = { message?: string } | null | undefined;

type QueryResult = {
  data?: Array<Record<string, unknown>> | null;
  error?: QueryErrorLike;
};

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => any;
  };
};

export type SpTargetingMaxDateStrategy = "targeting" | "advertised_fallback";

type LoadSpTargetingBaselineBoundsParams = {
  supabase: SupabaseLike;
  accountId: string;
  campaignIds: string[];
  asinNorm: string;
  startDate?: string;
  endDate?: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const parseDateField = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  if (!DATE_RE.test(value)) return null;
  return value;
};

const normalizeIds = (values: string[]): string[] => {
  const unique = new Set<string>();
  for (const value of values) {
    const id = String(value ?? "").trim();
    if (!id) continue;
    unique.add(id);
  }
  return [...unique].sort((left, right) => left.localeCompare(right));
};

export const chooseSpTargetingMaxDateStrategy = (
  campaignIds: string[]
): SpTargetingMaxDateStrategy => {
  return normalizeIds(campaignIds).length > 0 ? "targeting" : "advertised_fallback";
};

const applyOptionalDateWindow = (
  query: any,
  params: { startDate?: string; endDate?: string }
): any => {
  let next = query;
  if (params.startDate) {
    next = next.gte("date", params.startDate);
  }
  if (params.endDate) {
    next = next.lte("date", params.endDate);
  }
  return next;
};

const fetchSingleDate = async (
  query: any,
  params: { label: string; ascending: boolean }
): Promise<string | null> => {
  const result = (await query.order("date", { ascending: params.ascending }).limit(1)) as QueryResult;
  if (result.error?.message) {
    throw new Error(
      `Failed loading ${params.label} ${params.ascending ? "minimum" : "maximum"} date: ${result.error.message}`
    );
  }
  const rows = result.data ?? [];
  return parseDateField(rows[0]?.date);
};

const loadTargetingDateBounds = async (
  params: LoadSpTargetingBaselineBoundsParams,
  campaignIds: string[]
): Promise<DateBounds> => {
  const buildQuery = () =>
    applyOptionalDateWindow(
      params.supabase
        .from("sp_targeting_daily_fact_latest")
        .select("date")
        .eq("account_id", params.accountId)
        .in("campaign_id", campaignIds),
      { startDate: params.startDate, endDate: params.endDate }
    );

  const [minDate, maxDate] = await Promise.all([
    fetchSingleDate(buildQuery(), { label: "SP targeting baseline", ascending: true }),
    fetchSingleDate(buildQuery(), { label: "SP targeting baseline", ascending: false }),
  ]);

  return { minDate, maxDate };
};

const loadAdvertisedFallbackDateBounds = async (
  params: LoadSpTargetingBaselineBoundsParams
): Promise<DateBounds> => {
  const buildQuery = () =>
    applyOptionalDateWindow(
      params.supabase
        .from("sp_advertised_product_daily_fact_latest")
        .select("date")
        .eq("account_id", params.accountId)
        .eq("advertised_asin_norm", params.asinNorm),
      { startDate: params.startDate, endDate: params.endDate }
    );

  const [minDate, maxDate] = await Promise.all([
    fetchSingleDate(buildQuery(), { label: "SP targeting baseline", ascending: true }),
    fetchSingleDate(buildQuery(), { label: "SP targeting baseline", ascending: false }),
  ]);

  return { minDate, maxDate };
};

export const loadSpTargetingBaselineDateBounds = async (
  params: LoadSpTargetingBaselineBoundsParams
): Promise<DateBounds> => {
  const campaignIds = normalizeIds(params.campaignIds);
  if (campaignIds.length === 0) {
    return loadAdvertisedFallbackDateBounds(params);
  }
  return loadTargetingDateBounds(params, campaignIds);
};
