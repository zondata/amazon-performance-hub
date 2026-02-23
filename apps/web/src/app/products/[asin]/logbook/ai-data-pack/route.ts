import {
  computeBaselineWindow,
  computeEndCandidate,
  computeTodayMinusExcludeDays,
  normalizeBaselineRange,
  normalizeExcludeLastDays,
  type BaselineAvailabilityMap,
} from "@/lib/logbook/aiPack/computeBaselineWindow";
import {
  loadSbCampaignIdsForAsin,
  loadSpCampaignIdsForAsin,
} from "@/lib/logbook/aiPack/findAsinCampaignIds";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const CAMPAIGN_LIMIT = 50;
const TARGET_LIMIT = 200;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type MetricRow = {
  spend: number | string | null;
  sales: number | string | null;
  orders: number | string | null;
  clicks: number | string | null;
  impressions?: number | string | null;
};

type CampaignAggregate = {
  campaign_id: string;
  campaign_name_raw: string;
  campaign_name_norm: string;
  spend: number;
  sales: number;
  orders: number;
  clicks: number;
  impressions: number;
};

type TargetAggregate = {
  target_id: string;
  campaign_id: string;
  targeting_raw: string;
  targeting_norm: string;
  match_type_norm: string | null;
  spend: number;
  sales: number;
  orders: number;
  clicks: number;
  impressions: number;
};

type DateBounds = {
  minDate: string | null;
  maxDate: string | null;
};

type QueryErrorLike = { message?: string } | null | undefined;

type QueryResult = {
  data?: Array<Record<string, unknown>> | null;
  error?: QueryErrorLike;
};

const num = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toFiniteNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatPct = (value: number | null) =>
  value === null || !Number.isFinite(value) ? null : Number(value.toFixed(6));

const calcAcos = (spend: number, sales: number) => (sales > 0 ? spend / sales : null);
const calcCpc = (spend: number, clicks: number) => (clicks > 0 ? spend / clicks : null);

const sanitizeFileSegment = (value: string): string =>
  value
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]+/g, "")
    .slice(0, 80);

const parseDateField = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  if (!DATE_RE.test(value)) return null;
  return value;
};

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const compareNullableDesc = (left: number | null, right: number | null): number => {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return right - left;
};

const aggregateCampaignRows = (
  rows: Array<MetricRow & { campaign_id: string; campaign_name_raw: string; campaign_name_norm: string }>
): CampaignAggregate[] => {
  const byId = new Map<string, CampaignAggregate>();
  for (const row of rows) {
    const key = row.campaign_id;
    if (!key) continue;
    const prev =
      byId.get(key) ??
      ({
        campaign_id: row.campaign_id,
        campaign_name_raw: row.campaign_name_raw,
        campaign_name_norm: row.campaign_name_norm,
        spend: 0,
        sales: 0,
        orders: 0,
        clicks: 0,
        impressions: 0,
      } as CampaignAggregate);
    prev.spend += num(row.spend);
    prev.sales += num(row.sales);
    prev.orders += num(row.orders);
    prev.clicks += num(row.clicks);
    prev.impressions += num(row.impressions);
    byId.set(key, prev);
  }
  return [...byId.values()].sort((a, b) => b.spend - a.spend);
};

const aggregateTargetRows = (
  rows: Array<
    MetricRow & {
      target_id: string;
      campaign_id: string;
      targeting_raw: string;
      targeting_norm: string;
      match_type_norm: string | null;
    }
  >
): TargetAggregate[] => {
  const byId = new Map<string, TargetAggregate>();
  for (const row of rows) {
    const key = row.target_id;
    if (!key) continue;
    const prev =
      byId.get(key) ??
      ({
        target_id: row.target_id,
        campaign_id: row.campaign_id,
        targeting_raw: row.targeting_raw,
        targeting_norm: row.targeting_norm,
        match_type_norm: row.match_type_norm,
        spend: 0,
        sales: 0,
        orders: 0,
        clicks: 0,
        impressions: 0,
      } as TargetAggregate);
    prev.spend += num(row.spend);
    prev.sales += num(row.sales);
    prev.orders += num(row.orders);
    prev.clicks += num(row.clicks);
    prev.impressions += num(row.impressions);
    byId.set(key, prev);
  }
  return [...byId.values()].sort((a, b) => b.spend - a.spend);
};

const loadDateBounds = async (
  dateColumn: string,
  label: string,
  minQuery: PromiseLike<unknown>,
  maxQuery: PromiseLike<unknown>
): Promise<DateBounds> => {
  const [minRaw, maxRaw] = await Promise.all([minQuery, maxQuery]);
  const minResult = minRaw as QueryResult;
  const maxResult = maxRaw as QueryResult;

  const minError = minResult.error;
  const maxError = maxResult.error;
  if (minError?.message) {
    throw new Error(`Failed loading ${label} minimum date: ${minError.message}`);
  }
  if (maxError?.message) {
    throw new Error(`Failed loading ${label} maximum date: ${maxError.message}`);
  }

  const minRows = minResult.data ?? [];
  const maxRows = maxResult.data ?? [];
  const minDate = parseDateField(minRows[0]?.[dateColumn]);
  const maxDate = parseDateField(maxRows[0]?.[dateColumn]);
  return { minDate, maxDate };
};

type Ctx = { params: Promise<{ asin: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { asin: rawAsin } = await params;
  const asin = (rawAsin ?? "").trim().toUpperCase();
  if (!asin) {
    return new Response("Missing ASIN param.", { status: 400 });
  }

  const url = new URL(request.url);
  const requestedRange = normalizeBaselineRange(url.searchParams.get("range"));
  const excludeLastDays = normalizeExcludeLastDays(url.searchParams.get("exclude_last_days"));
  const todayMinusExcludeDays = computeTodayMinusExcludeDays(excludeLastDays);
  const endArg = url.searchParams.get("end");
  const userEnd = endArg && DATE_RE.test(endArg) ? endArg : null;
  const endCandidate = computeEndCandidate(todayMinusExcludeDays, userEnd);
  const asinNamePattern = `%${asin.toLowerCase()}%`;

  const { data: productRow, error: productError } = await supabaseAdmin
    .from("products")
    .select("product_id,asin,title")
    .eq("account_id", env.accountId)
    .eq("marketplace", env.marketplace)
    .eq("asin", asin)
    .maybeSingle();
  if (productError || !productRow?.product_id) {
    return new Response("Product not found.", { status: 404 });
  }

  const { data: profileRow } = await supabaseAdmin
    .from("product_profile")
    .select("profile_json")
    .eq("product_id", productRow.product_id)
    .maybeSingle();
  const shortName =
    profileRow?.profile_json &&
    typeof profileRow.profile_json === "object" &&
    !Array.isArray(profileRow.profile_json) &&
    typeof (profileRow.profile_json as Record<string, unknown>).short_name === "string"
      ? ((profileRow.profile_json as Record<string, unknown>).short_name as string).trim()
      : null;

  const { data: latestUploadRows, error: latestUploadError } = await supabaseAdmin
    .from("uploads")
    .select("upload_id,snapshot_date")
    .eq("account_id", env.accountId)
    .eq("source_type", "bulk")
    .not("snapshot_date", "is", null)
    .order("snapshot_date", { ascending: false })
    .limit(1);
  if (latestUploadError) {
    return new Response(`Failed loading bulk snapshot date: ${latestUploadError.message}`, {
      status: 500,
    });
  }
  const latestSnapshotDate = (latestUploadRows?.[0]?.snapshot_date as string | null) ?? null;

  let spCandidateCampaignIds: string[] = [];
  let sbCandidateCampaignIds: string[] = [];
  try {
    [spCandidateCampaignIds, sbCandidateCampaignIds] = await Promise.all([
      loadSpCampaignIdsForAsin({
        asin,
        accountId: env.accountId,
        snapshotDate: latestSnapshotDate,
        namePattern: asinNamePattern,
      }),
      loadSbCampaignIdsForAsin({
        asin,
        accountId: env.accountId,
        snapshotDate: latestSnapshotDate,
        namePattern: asinNamePattern,
      }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed resolving ASIN campaign IDs.";
    return new Response(message, { status: 500 });
  }

  let availability: BaselineAvailabilityMap;
  try {
    const [
      salesBounds,
      spCampaignBounds,
      spTargetBounds,
      sbCampaignBounds,
      sbKeywordBounds,
      rankingBounds,
      sqpBounds,
    ] = await Promise.all([
      loadDateBounds(
        "date",
        "sales baseline",
        supabaseAdmin
          .from("si_sales_trend_daily_latest")
          .select("date")
          .eq("account_id", env.accountId)
          .eq("marketplace", env.marketplace)
          .eq("asin", asin)
          .lte("date", endCandidate)
          .order("date", { ascending: true })
          .limit(1),
        supabaseAdmin
          .from("si_sales_trend_daily_latest")
          .select("date")
          .eq("account_id", env.accountId)
          .eq("marketplace", env.marketplace)
          .eq("asin", asin)
          .lte("date", endCandidate)
          .order("date", { ascending: false })
          .limit(1)
      ),
      spCandidateCampaignIds.length > 0
        ? loadDateBounds(
            "date",
            "SP campaign baseline",
            supabaseAdmin
              .from("sp_campaign_hourly_fact_latest")
              .select("date")
              .eq("account_id", env.accountId)
              .in("campaign_id", spCandidateCampaignIds)
              .lte("date", endCandidate)
              .order("date", { ascending: true })
              .limit(1),
            Promise.resolve({ data: [{ date: endCandidate }], error: null })
          )
        : Promise.resolve({ minDate: null, maxDate: null }),
      spCandidateCampaignIds.length > 0
        ? loadDateBounds(
            "date",
            "SP targeting baseline",
            supabaseAdmin
              .from("sp_targeting_daily_fact_latest")
              .select("date")
              .eq("account_id", env.accountId)
              .in("campaign_id", spCandidateCampaignIds)
              .lte("date", endCandidate)
              .order("date", { ascending: true })
              .limit(1),
            Promise.resolve({ data: [{ date: endCandidate }], error: null })
          )
        : Promise.resolve({ minDate: null, maxDate: null }),
      sbCandidateCampaignIds.length > 0
        ? loadDateBounds(
            "date",
            "SB campaign baseline",
            supabaseAdmin
              .from("sb_campaign_daily_fact_latest")
              .select("date")
              .eq("account_id", env.accountId)
              .in("campaign_id", sbCandidateCampaignIds)
              .lte("date", endCandidate)
              .order("date", { ascending: true })
              .limit(1),
            supabaseAdmin
              .from("sb_campaign_daily_fact_latest")
              .select("date")
              .eq("account_id", env.accountId)
              .in("campaign_id", sbCandidateCampaignIds)
              .lte("date", endCandidate)
              .order("date", { ascending: false })
              .limit(1)
          )
        : Promise.resolve({ minDate: null, maxDate: null }),
      sbCandidateCampaignIds.length > 0
        ? loadDateBounds(
            "date",
            "SB keyword baseline",
            supabaseAdmin
              .from("sb_keyword_daily_fact_latest")
              .select("date")
              .eq("account_id", env.accountId)
              .in("campaign_id", sbCandidateCampaignIds)
              .lte("date", endCandidate)
              .order("date", { ascending: true })
              .limit(1),
            supabaseAdmin
              .from("sb_keyword_daily_fact_latest")
              .select("date")
              .eq("account_id", env.accountId)
              .in("campaign_id", sbCandidateCampaignIds)
              .lte("date", endCandidate)
              .order("date", { ascending: false })
              .limit(1)
          )
        : Promise.resolve({ minDate: null, maxDate: null }),
      loadDateBounds(
        "observed_date",
        "ranking baseline",
        supabaseAdmin
          .from("h10_keyword_rank_daily_latest")
          .select("observed_date")
          .eq("account_id", env.accountId)
          .eq("marketplace", env.marketplace)
          .eq("asin", asin)
          .lte("observed_date", endCandidate)
          .order("observed_date", { ascending: true })
          .limit(1),
        supabaseAdmin
          .from("h10_keyword_rank_daily_latest")
          .select("observed_date")
          .eq("account_id", env.accountId)
          .eq("marketplace", env.marketplace)
          .eq("asin", asin)
          .lte("observed_date", endCandidate)
          .order("observed_date", { ascending: false })
          .limit(1)
      ),
      loadDateBounds(
        "week_end",
        "SQP baseline",
        supabaseAdmin
          .from("sqp_weekly_latest_enriched")
          .select("week_end")
          .eq("account_id", env.accountId)
          .eq("marketplace", env.marketplace)
          .eq("scope_type", "asin")
          .eq("scope_value", asin)
          .lte("week_end", endCandidate)
          .order("week_end", { ascending: true })
          .limit(1),
        supabaseAdmin
          .from("sqp_weekly_latest_enriched")
          .select("week_end")
          .eq("account_id", env.accountId)
          .eq("marketplace", env.marketplace)
          .eq("scope_type", "asin")
          .eq("scope_value", asin)
          .lte("week_end", endCandidate)
          .order("week_end", { ascending: false })
          .limit(1)
      ),
    ]);

    availability = {
      sales: salesBounds,
      sp_campaign: spCampaignBounds,
      sp_target: spTargetBounds,
      sb_campaign: sbCampaignBounds,
      sb_keyword: sbKeywordBounds,
      ranking: rankingBounds,
      sqp: sqpBounds,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed loading dataset availability.";
    return new Response(message, { status: 500 });
  }

  const window = computeBaselineWindow({
    requestedRange,
    endCandidate,
    availability,
  });

  const warnings: string[] = [];
  for (const [dataset, bounds] of Object.entries(availability)) {
    if (!bounds.minDate || !bounds.maxDate) {
      warnings.push(`Dataset "${dataset}" has no rows for this ASIN through ${endCandidate}.`);
    }
  }
  if (window.usedFallback) {
    warnings.push(
      "Computed overlap window was empty; fallback window set to the last 60 days (capped by exclude_last_days)."
    );
  }

  const effectiveStart = window.effectiveStart;
  const effectiveEnd = window.effectiveEnd;

  const { data: salesRows, error: salesError } = await supabaseAdmin
    .from("si_sales_trend_daily_latest")
    .select(
      "date,sales,orders,units,sessions,conversions,ppc_cost,ppc_sales,ppc_orders,ppc_units,ppc_impressions,ppc_clicks,cost_per_click,acos,tacos,referral_fees,fulfillment_fees,cost_of_goods,payout,profits,roi,margin"
    )
    .eq("account_id", env.accountId)
    .eq("marketplace", env.marketplace)
    .eq("asin", asin)
    .gte("date", effectiveStart)
    .lte("date", effectiveEnd)
    .order("date", { ascending: true })
    .limit(5000);
  if (salesError) {
    return new Response(`Failed loading sales trend: ${salesError.message}`, { status: 500 });
  }

  let spCampaignFactRows: Array<Record<string, unknown>> = [];
  if (spCandidateCampaignIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("sp_campaign_hourly_fact_latest")
      .select("campaign_id,campaign_name_raw,campaign_name_norm,impressions,clicks,spend,sales,orders")
      .eq("account_id", env.accountId)
      .in("campaign_id", spCandidateCampaignIds)
      .gte("date", effectiveStart)
      .lte("date", effectiveEnd)
      .limit(50000);
    if (error) {
      return new Response(`Failed loading SP campaign baseline: ${error.message}`, {
        status: 500,
      });
    }
    spCampaignFactRows = (data ?? []) as Array<Record<string, unknown>>;
  }

  const spCampaignAgg = aggregateCampaignRows(
    spCampaignFactRows as Array<
      MetricRow & { campaign_id: string; campaign_name_raw: string; campaign_name_norm: string }
    >
  );
  const spTopCampaigns = spCampaignAgg.slice(0, CAMPAIGN_LIMIT);
  const spCampaignIds = spTopCampaigns.map((row) => row.campaign_id);

  let spTargetAgg: TargetAggregate[] = [];
  if (spCampaignIds.length > 0) {
    const { data: spTargetRows, error: spTargetError } = await supabaseAdmin
      .from("sp_targeting_daily_fact_latest")
      .select("target_id,campaign_id,targeting_raw,targeting_norm,match_type_norm,impressions,clicks,spend,sales,orders")
      .eq("account_id", env.accountId)
      .gte("date", effectiveStart)
      .lte("date", effectiveEnd)
      .in("campaign_id", spCampaignIds)
      .limit(50000);
    if (spTargetError) {
      return new Response(`Failed loading SP target baseline: ${spTargetError.message}`, {
        status: 500,
      });
    }
    spTargetAgg = aggregateTargetRows(
      (spTargetRows ?? []) as Array<
        MetricRow & {
          target_id: string;
          campaign_id: string;
          targeting_raw: string;
          targeting_norm: string;
          match_type_norm: string | null;
        }
      >
    ).slice(0, TARGET_LIMIT);
  }

  let sbCampaignFactRows: Array<Record<string, unknown>> = [];
  if (sbCandidateCampaignIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("sb_campaign_daily_fact_latest")
      .select("campaign_id,campaign_name_raw,campaign_name_norm,impressions,clicks,spend,sales,orders")
      .eq("account_id", env.accountId)
      .in("campaign_id", sbCandidateCampaignIds)
      .gte("date", effectiveStart)
      .lte("date", effectiveEnd)
      .limit(50000);
    if (error) {
      return new Response(`Failed loading SB campaign baseline: ${error.message}`, {
        status: 500,
      });
    }
    sbCampaignFactRows = (data ?? []) as Array<Record<string, unknown>>;
  }

  const sbCampaignAgg = aggregateCampaignRows(
    sbCampaignFactRows as Array<
      MetricRow & { campaign_id: string; campaign_name_raw: string; campaign_name_norm: string }
    >
  );
  const sbTopCampaigns = sbCampaignAgg.slice(0, CAMPAIGN_LIMIT);
  const sbCampaignIds = sbTopCampaigns.map((row) => row.campaign_id);

  let sbTargetAgg: TargetAggregate[] = [];
  if (sbCampaignIds.length > 0) {
    const { data: sbTargetRows, error: sbTargetError } = await supabaseAdmin
      .from("sb_keyword_daily_fact_latest")
      .select("target_id,campaign_id,targeting_raw,targeting_norm,match_type_norm,impressions,clicks,spend,sales,orders")
      .eq("account_id", env.accountId)
      .gte("date", effectiveStart)
      .lte("date", effectiveEnd)
      .in("campaign_id", sbCampaignIds)
      .limit(50000);
    if (sbTargetError) {
      return new Response(`Failed loading SB target baseline: ${sbTargetError.message}`, {
        status: 500,
      });
    }
    sbTargetAgg = aggregateTargetRows(
      (sbTargetRows ?? []) as Array<
        MetricRow & {
          target_id: string;
          campaign_id: string;
          targeting_raw: string;
          targeting_norm: string;
          match_type_norm: string | null;
        }
      >
    ).slice(0, TARGET_LIMIT);
  }

  let spBulkCampaignRows: Array<Record<string, unknown>> = [];
  let spBulkTargetRows: Array<Record<string, unknown>> = [];
  let spBulkPlacementRows: Array<Record<string, unknown>> = [];
  let sbBulkCampaignRows: Array<Record<string, unknown>> = [];
  let sbBulkTargetRows: Array<Record<string, unknown>> = [];
  let sbBulkPlacementRows: Array<Record<string, unknown>> = [];

  if (latestSnapshotDate) {
    if (spCampaignIds.length > 0) {
      const { data } = await supabaseAdmin
        .from("bulk_campaigns")
        .select("campaign_id,state,daily_budget,bidding_strategy")
        .eq("account_id", env.accountId)
        .eq("snapshot_date", latestSnapshotDate)
        .in("campaign_id", spCampaignIds)
        .limit(5000);
      spBulkCampaignRows = (data ?? []) as Array<Record<string, unknown>>;
      const { data: placementData } = await supabaseAdmin
        .from("bulk_placements")
        .select("campaign_id,placement_raw,placement_code,percentage")
        .eq("account_id", env.accountId)
        .eq("snapshot_date", latestSnapshotDate)
        .in("campaign_id", spCampaignIds)
        .limit(5000);
      spBulkPlacementRows = (placementData ?? []) as Array<Record<string, unknown>>;
    }
    const spTargetIds = spTargetAgg.map((row) => row.target_id);
    if (spTargetIds.length > 0) {
      const { data } = await supabaseAdmin
        .from("bulk_targets")
        .select("target_id,state,bid,match_type,expression_raw")
        .eq("account_id", env.accountId)
        .eq("snapshot_date", latestSnapshotDate)
        .in("target_id", spTargetIds)
        .limit(5000);
      spBulkTargetRows = (data ?? []) as Array<Record<string, unknown>>;
    }

    if (sbCampaignIds.length > 0) {
      const { data } = await supabaseAdmin
        .from("bulk_sb_campaigns")
        .select("campaign_id,state,daily_budget,bidding_strategy")
        .eq("account_id", env.accountId)
        .eq("snapshot_date", latestSnapshotDate)
        .in("campaign_id", sbCampaignIds)
        .limit(5000);
      sbBulkCampaignRows = (data ?? []) as Array<Record<string, unknown>>;
      const { data: placementData } = await supabaseAdmin
        .from("bulk_sb_placements")
        .select("campaign_id,placement_raw,placement_raw_norm,placement_code,percentage")
        .eq("account_id", env.accountId)
        .eq("snapshot_date", latestSnapshotDate)
        .in("campaign_id", sbCampaignIds)
        .limit(5000);
      sbBulkPlacementRows = (placementData ?? []) as Array<Record<string, unknown>>;
    }
    const sbTargetIds = sbTargetAgg.map((row) => row.target_id);
    if (sbTargetIds.length > 0) {
      const { data } = await supabaseAdmin
        .from("bulk_sb_targets")
        .select("target_id,state,bid,match_type,expression_raw")
        .eq("account_id", env.accountId)
        .eq("snapshot_date", latestSnapshotDate)
        .in("target_id", sbTargetIds)
        .limit(5000);
      sbBulkTargetRows = (data ?? []) as Array<Record<string, unknown>>;
    }
  }

  const spBulkCampaignById = new Map(
    spBulkCampaignRows.map((row) => [String(row.campaign_id), row] as const)
  );
  const spBulkTargetById = new Map(
    spBulkTargetRows.map((row) => [String(row.target_id), row] as const)
  );
  const sbBulkCampaignById = new Map(
    sbBulkCampaignRows.map((row) => [String(row.campaign_id), row] as const)
  );
  const sbBulkTargetById = new Map(
    sbBulkTargetRows.map((row) => [String(row.target_id), row] as const)
  );

  const spPlacementsByCampaign = new Map<string, Array<Record<string, unknown>>>();
  for (const row of spBulkPlacementRows) {
    const key = String(row.campaign_id);
    const rows = spPlacementsByCampaign.get(key) ?? [];
    rows.push(row);
    spPlacementsByCampaign.set(key, rows);
  }
  const sbPlacementsByCampaign = new Map<string, Array<Record<string, unknown>>>();
  for (const row of sbBulkPlacementRows) {
    const key = String(row.campaign_id);
    const rows = sbPlacementsByCampaign.get(key) ?? [];
    rows.push(row);
    sbPlacementsByCampaign.set(key, rows);
  }

  let sqpLatestWeekEnd: string | null = null;
  let sqpSnapshotRows: Array<Record<string, unknown>> = [];
  let sqpTrendRows: Array<Record<string, unknown>> = [];
  const { data: sqpWeekRows, error: sqpWeekError } = await supabaseAdmin
    .from("sqp_weekly_latest_enriched")
    .select("week_end")
    .eq("account_id", env.accountId)
    .eq("marketplace", env.marketplace)
    .eq("scope_type", "asin")
    .eq("scope_value", asin)
    .lte("week_end", effectiveEnd)
    .order("week_end", { ascending: false })
    .limit(1);
  if (sqpWeekError) {
    return new Response(`Failed loading SQP week baseline: ${sqpWeekError.message}`, { status: 500 });
  }
  sqpLatestWeekEnd = parseDateField(sqpWeekRows?.[0]?.week_end) ?? null;

  if (sqpLatestWeekEnd) {
    const { data: sqpRows, error: sqpRowsError } = await supabaseAdmin
      .from("sqp_weekly_latest_enriched")
      .select(
        "week_start,week_end,search_query_raw,search_query_norm,search_query_score,search_query_volume,impressions_total,impressions_self,clicks_total,clicks_self,cart_adds_total,purchases_total,self_impression_share_calc,self_click_share_calc,self_purchase_share_calc,self_ctr_index,self_cvr_index,market_ctr,self_ctr,market_cvr,self_cvr"
      )
      .eq("account_id", env.accountId)
      .eq("marketplace", env.marketplace)
      .eq("scope_type", "asin")
      .eq("scope_value", asin)
      .eq("week_end", sqpLatestWeekEnd)
      .order("impressions_total", { ascending: false })
      .limit(50);
    if (sqpRowsError) {
      return new Response(`Failed loading SQP snapshot rows: ${sqpRowsError.message}`, { status: 500 });
    }
    sqpSnapshotRows = (sqpRows ?? []) as Array<Record<string, unknown>>;

    const topSqpQueryNorms = sqpSnapshotRows
      .map((row) => String(row.search_query_norm ?? "").trim())
      .filter((value) => value.length > 0)
      .slice(0, 10);
    if (topSqpQueryNorms.length > 0) {
      const { data: sqpTrendData, error: sqpTrendError } = await supabaseAdmin
        .from("sqp_weekly_latest_enriched")
        .select(
          "week_start,week_end,search_query_raw,search_query_norm,search_query_volume,impressions_total,impressions_self,clicks_total,clicks_self,cart_adds_total,purchases_total,self_impression_share_calc,self_click_share_calc,self_purchase_share_calc,self_ctr_index,self_cvr_index,market_ctr,self_ctr,market_cvr,self_cvr"
        )
        .eq("account_id", env.accountId)
        .eq("marketplace", env.marketplace)
        .eq("scope_type", "asin")
        .eq("scope_value", asin)
        .in("search_query_norm", topSqpQueryNorms)
        .gte("week_end", effectiveStart)
        .lte("week_end", effectiveEnd)
        .order("week_end", { ascending: true })
        .limit(5000);
      if (sqpTrendError) {
        return new Response(`Failed loading SQP trend rows: ${sqpTrendError.message}`, { status: 500 });
      }
      sqpTrendRows = (sqpTrendData ?? []) as Array<Record<string, unknown>>;
    }
  }

  let rankingLatestObservedDate: string | null = null;
  let rankingSnapshotTopRows: Array<Record<string, unknown>> = [];
  let rankingTrendRows: Array<Record<string, unknown>> = [];
  const { data: rankingDateRows, error: rankingDateError } = await supabaseAdmin
    .from("h10_keyword_rank_daily_latest")
    .select("observed_date")
    .eq("account_id", env.accountId)
    .eq("marketplace", env.marketplace)
    .eq("asin", asin)
    .lte("observed_date", effectiveEnd)
    .order("observed_date", { ascending: false })
    .limit(1);
  if (rankingDateError) {
    return new Response(`Failed loading ranking snapshot date: ${rankingDateError.message}`, {
      status: 500,
    });
  }
  rankingLatestObservedDate = parseDateField(rankingDateRows?.[0]?.observed_date) ?? null;

  if (rankingLatestObservedDate) {
    const { data: rankingRows, error: rankingRowsError } = await supabaseAdmin
      .from("h10_keyword_rank_daily_latest")
      .select(
        "observed_date,keyword_raw,keyword_norm,search_volume,keyword_sales,organic_rank_raw,organic_rank_value,sponsored_pos_raw,sponsored_pos_value"
      )
      .eq("account_id", env.accountId)
      .eq("marketplace", env.marketplace)
      .eq("asin", asin)
      .eq("observed_date", rankingLatestObservedDate)
      .limit(2000);
    if (rankingRowsError) {
      return new Response(`Failed loading ranking snapshot rows: ${rankingRowsError.message}`, {
        status: 500,
      });
    }
    rankingSnapshotTopRows = ((rankingRows ?? []) as Array<Record<string, unknown>>)
      .sort((left, right) => {
        const primary = compareNullableDesc(
          toFiniteNumberOrNull(left.search_volume),
          toFiniteNumberOrNull(right.search_volume)
        );
        if (primary !== 0) return primary;
        const secondary = compareNullableDesc(
          toFiniteNumberOrNull(left.keyword_sales),
          toFiniteNumberOrNull(right.keyword_sales)
        );
        if (secondary !== 0) return secondary;
        return String(left.keyword_raw ?? "").localeCompare(String(right.keyword_raw ?? ""));
      })
      .slice(0, 50);

    const topRankingKeywordNorms = rankingSnapshotTopRows
      .map((row) => String(row.keyword_norm ?? "").trim())
      .filter((value) => value.length > 0)
      .slice(0, 20);

    if (topRankingKeywordNorms.length > 0) {
      const { data: rankingTrendData, error: rankingTrendError } = await supabaseAdmin
        .from("h10_keyword_rank_daily_latest")
        .select(
          "observed_date,keyword_raw,keyword_norm,search_volume,keyword_sales,organic_rank_raw,organic_rank_value,sponsored_pos_raw,sponsored_pos_value"
        )
        .eq("account_id", env.accountId)
        .eq("marketplace", env.marketplace)
        .eq("asin", asin)
        .in("keyword_norm", topRankingKeywordNorms)
        .gte("observed_date", effectiveStart)
        .lte("observed_date", effectiveEnd)
        .order("observed_date", { ascending: true })
        .limit(20000);
      if (rankingTrendError) {
        return new Response(`Failed loading ranking trend rows: ${rankingTrendError.message}`, {
          status: 500,
        });
      }
      rankingTrendRows = (rankingTrendData ?? []) as Array<Record<string, unknown>>;
    }
  }

  const { data: experimentsRows, error: experimentsError } = await supabaseAdmin
    .from("log_experiments")
    .select("experiment_id,name,scope,created_at")
    .eq("account_id", env.accountId)
    .eq("marketplace", env.marketplace)
    .contains("scope", { product_id: asin })
    .order("created_at", { ascending: false })
    .limit(200);
  if (experimentsError) {
    return new Response(`Failed loading experiments: ${experimentsError.message}`, { status: 500 });
  }

  const output = {
    kind: "aph_product_baseline_data_pack_v2",
    generated_at: new Date().toISOString(),
    account_id: env.accountId,
    marketplace: env.marketplace,
    metadata: {
      requested_range: requestedRange,
      effective_window: {
        start: effectiveStart,
        end: effectiveEnd,
      },
      exclude_last_days: excludeLastDays,
      today_minus_exclude_days: todayMinusExcludeDays,
      availability: Object.fromEntries(
        Object.entries(availability).map(([key, bounds]) => [
          key,
          {
            min_date: bounds.minDate,
            max_date: bounds.maxDate,
            has_data: Boolean(bounds.minDate && bounds.maxDate),
          },
        ])
      ),
      warnings,
      window_candidates: {
        start_candidate: window.startCandidate,
        end_candidate: window.endCandidate,
        overlap_start: window.overlapStart,
        overlap_end: window.overlapEnd,
      },
    },
    window: { start: effectiveStart, end: effectiveEnd },
    product: {
      asin,
      title: productRow.title,
      short_name: shortName,
    },
    sales_trend_daily: (salesRows ?? []).map((row) => ({
      date: row.date,
      sales: num(row.sales),
      orders: num(row.orders),
      units: num(row.units),
      sessions: num(row.sessions),
      conversions: num(row.conversions),
      ppc_cost: num(row.ppc_cost),
      ppc_sales: num(row.ppc_sales),
      ppc_orders: num(row.ppc_orders),
      ppc_units: num(row.ppc_units),
      ppc_impressions: num(row.ppc_impressions),
      ppc_clicks: num(row.ppc_clicks),
      cost_per_click: num(row.cost_per_click),
      acos: num(row.acos),
      tacos: num(row.tacos),
      referral_fees: num(row.referral_fees),
      fulfillment_fees: num(row.fulfillment_fees),
      cost_of_goods: num(row.cost_of_goods),
      payout: num(row.payout),
      profits: num(row.profits),
      roi: num(row.roi),
      margin: num(row.margin),
    })),
    ads_baseline: {
      latest_bulk_snapshot_date: latestSnapshotDate,
      sp: {
        campaigns: spTopCampaigns.map((row) => ({
          campaign_id: row.campaign_id,
          campaign_name_raw: row.campaign_name_raw,
          campaign_name_norm: row.campaign_name_norm,
          spend: row.spend,
          sales: row.sales,
          orders: row.orders,
          clicks: row.clicks,
          acos: formatPct(calcAcos(row.spend, row.sales)),
          cpc: calcCpc(row.spend, row.clicks),
          current_bulk: spBulkCampaignById.get(row.campaign_id) ?? null,
          placement_modifiers: spPlacementsByCampaign.get(row.campaign_id) ?? [],
        })),
        targets: spTargetAgg.map((row) => ({
          target_id: row.target_id,
          campaign_id: row.campaign_id,
          targeting_raw: row.targeting_raw,
          targeting_norm: row.targeting_norm,
          match_type_norm: row.match_type_norm,
          spend: row.spend,
          sales: row.sales,
          orders: row.orders,
          clicks: row.clicks,
          acos: formatPct(calcAcos(row.spend, row.sales)),
          cpc: calcCpc(row.spend, row.clicks),
          current_bulk: spBulkTargetById.get(row.target_id) ?? null,
        })),
      },
      sb: {
        campaigns: sbTopCampaigns.map((row) => ({
          campaign_id: row.campaign_id,
          campaign_name_raw: row.campaign_name_raw,
          campaign_name_norm: row.campaign_name_norm,
          spend: row.spend,
          sales: row.sales,
          orders: row.orders,
          clicks: row.clicks,
          acos: formatPct(calcAcos(row.spend, row.sales)),
          cpc: calcCpc(row.spend, row.clicks),
          current_bulk: sbBulkCampaignById.get(row.campaign_id) ?? null,
          placement_modifiers: sbPlacementsByCampaign.get(row.campaign_id) ?? [],
        })),
        targets: sbTargetAgg.map((row) => ({
          target_id: row.target_id,
          campaign_id: row.campaign_id,
          targeting_raw: row.targeting_raw,
          targeting_norm: row.targeting_norm,
          match_type_norm: row.match_type_norm,
          spend: row.spend,
          sales: row.sales,
          orders: row.orders,
          clicks: row.clicks,
          acos: formatPct(calcAcos(row.spend, row.sales)),
          cpc: calcCpc(row.spend, row.clicks),
          current_bulk: sbBulkTargetById.get(row.target_id) ?? null,
        })),
      },
    },
    sqp_baseline: {
      latest_week_end: sqpLatestWeekEnd,
      snapshot_top_queries: sqpSnapshotRows.map((row) => ({
        week_start: row.week_start,
        week_end: row.week_end,
        search_query_raw: row.search_query_raw,
        search_query_norm: row.search_query_norm,
        search_query_score: toFiniteNumberOrNull(row.search_query_score),
        search_query_volume: toFiniteNumberOrNull(row.search_query_volume),
        impressions_total: toFiniteNumberOrNull(row.impressions_total),
        impressions_self: toFiniteNumberOrNull(row.impressions_self),
        clicks_total: toFiniteNumberOrNull(row.clicks_total),
        clicks_self: toFiniteNumberOrNull(row.clicks_self),
        cart_adds_total: toFiniteNumberOrNull(row.cart_adds_total),
        purchases_total: toFiniteNumberOrNull(row.purchases_total),
        self_impression_share_calc: toFiniteNumberOrNull(row.self_impression_share_calc),
        self_click_share_calc: toFiniteNumberOrNull(row.self_click_share_calc),
        self_purchase_share_calc: toFiniteNumberOrNull(row.self_purchase_share_calc),
        self_ctr_index: toFiniteNumberOrNull(row.self_ctr_index),
        self_cvr_index: toFiniteNumberOrNull(row.self_cvr_index),
        market_ctr: toFiniteNumberOrNull(row.market_ctr),
        self_ctr: toFiniteNumberOrNull(row.self_ctr),
        market_cvr: toFiniteNumberOrNull(row.market_cvr),
        self_cvr: toFiniteNumberOrNull(row.self_cvr),
      })),
      top_query_trends: sqpTrendRows.map((row) => ({
        week_start: row.week_start,
        week_end: row.week_end,
        search_query_raw: row.search_query_raw,
        search_query_norm: row.search_query_norm,
        search_query_volume: toFiniteNumberOrNull(row.search_query_volume),
        impressions_total: toFiniteNumberOrNull(row.impressions_total),
        impressions_self: toFiniteNumberOrNull(row.impressions_self),
        clicks_total: toFiniteNumberOrNull(row.clicks_total),
        clicks_self: toFiniteNumberOrNull(row.clicks_self),
        cart_adds_total: toFiniteNumberOrNull(row.cart_adds_total),
        purchases_total: toFiniteNumberOrNull(row.purchases_total),
        self_impression_share_calc: toFiniteNumberOrNull(row.self_impression_share_calc),
        self_click_share_calc: toFiniteNumberOrNull(row.self_click_share_calc),
        self_purchase_share_calc: toFiniteNumberOrNull(row.self_purchase_share_calc),
        self_ctr_index: toFiniteNumberOrNull(row.self_ctr_index),
        self_cvr_index: toFiniteNumberOrNull(row.self_cvr_index),
        market_ctr: toFiniteNumberOrNull(row.market_ctr),
        self_ctr: toFiniteNumberOrNull(row.self_ctr),
        market_cvr: toFiniteNumberOrNull(row.market_cvr),
        self_cvr: toFiniteNumberOrNull(row.self_cvr),
      })),
    },
    ranking_baseline: {
      latest_observed_date: rankingLatestObservedDate,
      snapshot_top_keywords: rankingSnapshotTopRows.map((row) => ({
        observed_date: row.observed_date,
        keyword_raw: row.keyword_raw,
        keyword_norm: row.keyword_norm,
        search_volume: toFiniteNumberOrNull(row.search_volume),
        keyword_sales: toFiniteNumberOrNull(row.keyword_sales),
        organic_rank_raw: row.organic_rank_raw,
        organic_rank_value: toFiniteNumberOrNull(row.organic_rank_value),
        sponsored_pos_raw: row.sponsored_pos_raw,
        sponsored_pos_value: toFiniteNumberOrNull(row.sponsored_pos_value),
      })),
      top_keyword_trends: rankingTrendRows.map((row) => ({
        observed_date: row.observed_date,
        keyword_raw: row.keyword_raw,
        keyword_norm: row.keyword_norm,
        search_volume: toFiniteNumberOrNull(row.search_volume),
        keyword_sales: toFiniteNumberOrNull(row.keyword_sales),
        organic_rank_raw: row.organic_rank_raw,
        organic_rank_value: toFiniteNumberOrNull(row.organic_rank_value),
        sponsored_pos_raw: row.sponsored_pos_raw,
        sponsored_pos_value: toFiniteNumberOrNull(row.sponsored_pos_value),
      })),
    },
    experiments: (experimentsRows ?? []).map((row) => {
      const scope = asRecord(row.scope);
      return {
        experiment_id: row.experiment_id,
        name: row.name,
        status: (scope.status as string | undefined) ?? "planned",
        created_at: row.created_at,
      };
    }),
  };

  const filename = `${sanitizeFileSegment(asin)}_product_baseline_data_pack.json`;
  return new Response(`${JSON.stringify(output, null, 2)}\n`, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
