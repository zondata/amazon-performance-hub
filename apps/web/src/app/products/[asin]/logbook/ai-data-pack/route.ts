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

const num = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toDateString = (value: Date) => value.toISOString().slice(0, 10);

const defaultRange30d = () => {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);
  return { start: toDateString(start), end: toDateString(end) };
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

const asinCampaignFilter = (campaignNameNorm: string | null | undefined, asin: string) => {
  const text = (campaignNameNorm ?? "").toLowerCase();
  return text.includes(asin.toLowerCase());
};

type Ctx = { params: Promise<{ asin: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { asin: rawAsin } = await params;
  const asin = (rawAsin ?? "").trim().toUpperCase();
  if (!asin) {
    return new Response("Missing ASIN param.", { status: 400 });
  }

  const url = new URL(request.url);
  const startArg = url.searchParams.get("start");
  const endArg = url.searchParams.get("end");
  const defaults = defaultRange30d();
  const start = startArg && DATE_RE.test(startArg) ? startArg : defaults.start;
  const end = endArg && DATE_RE.test(endArg) ? endArg : defaults.end;

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

  const { data: salesRows, error: salesError } = await supabaseAdmin
    .from("si_sales_trend_daily_latest")
    .select("date,sales,orders,units,ppc_cost")
    .eq("account_id", env.accountId)
    .eq("marketplace", env.marketplace)
    .eq("asin", asin)
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: true })
    .limit(5000);
  if (salesError) {
    return new Response(`Failed loading sales trend: ${salesError.message}`, { status: 500 });
  }

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

  const { data: spCampaignFactRows, error: spCampaignFactError } = await supabaseAdmin
    .from("sp_campaign_hourly_fact_latest")
    .select("campaign_id,campaign_name_raw,campaign_name_norm,impressions,clicks,spend,sales,orders")
    .eq("account_id", env.accountId)
    .gte("date", start)
    .lte("date", end)
    .limit(50000);
  if (spCampaignFactError) {
    return new Response(`Failed loading SP campaign baseline: ${spCampaignFactError.message}`, {
      status: 500,
    });
  }

  const spCampaignAgg = aggregateCampaignRows(
    (spCampaignFactRows ?? []) as Array<
      MetricRow & { campaign_id: string; campaign_name_raw: string; campaign_name_norm: string }
    >
  );
  const spRelevant = spCampaignAgg.filter((row) => asinCampaignFilter(row.campaign_name_norm, asin));
  const spTopCampaigns = (spRelevant.length > 0 ? spRelevant : spCampaignAgg).slice(0, CAMPAIGN_LIMIT);
  const spCampaignIds = spTopCampaigns.map((row) => row.campaign_id);

  let spTargetAgg: TargetAggregate[] = [];
  if (spCampaignIds.length > 0) {
    const { data: spTargetRows, error: spTargetError } = await supabaseAdmin
      .from("sp_targeting_daily_fact_latest")
      .select("target_id,campaign_id,targeting_raw,targeting_norm,match_type_norm,impressions,clicks,spend,sales,orders")
      .eq("account_id", env.accountId)
      .gte("date", start)
      .lte("date", end)
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

  const { data: sbCampaignFactRows, error: sbCampaignFactError } = await supabaseAdmin
    .from("sb_campaign_daily_fact_latest")
    .select("campaign_id,campaign_name_raw,campaign_name_norm,impressions,clicks,spend,sales,orders")
    .eq("account_id", env.accountId)
    .gte("date", start)
    .lte("date", end)
    .limit(50000);
  if (sbCampaignFactError) {
    return new Response(`Failed loading SB campaign baseline: ${sbCampaignFactError.message}`, {
      status: 500,
    });
  }

  const sbCampaignAgg = aggregateCampaignRows(
    (sbCampaignFactRows ?? []) as Array<
      MetricRow & { campaign_id: string; campaign_name_raw: string; campaign_name_norm: string }
    >
  );
  const sbRelevant = sbCampaignAgg.filter((row) => asinCampaignFilter(row.campaign_name_norm, asin));
  const sbTopCampaigns = (sbRelevant.length > 0 ? sbRelevant : sbCampaignAgg).slice(0, CAMPAIGN_LIMIT);
  const sbCampaignIds = sbTopCampaigns.map((row) => row.campaign_id);

  let sbTargetAgg: TargetAggregate[] = [];
  if (sbCampaignIds.length > 0) {
    const { data: sbTargetRows, error: sbTargetError } = await supabaseAdmin
      .from("sb_keyword_daily_fact_latest")
      .select("target_id,campaign_id,targeting_raw,targeting_norm,match_type_norm,impressions,clicks,spend,sales,orders")
      .eq("account_id", env.accountId)
      .gte("date", start)
      .lte("date", end)
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
    kind: "aph_product_ai_data_pack_v1",
    generated_at: new Date().toISOString(),
    account_id: env.accountId,
    marketplace: env.marketplace,
    window: { start, end },
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
      ppc_cost: num(row.ppc_cost),
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
    experiments: (experimentsRows ?? []).map((row) => ({
      experiment_id: row.experiment_id,
      name: row.name,
      status:
        row.scope && typeof row.scope === "object" && !Array.isArray(row.scope)
          ? ((row.scope as Record<string, unknown>).status as string | undefined) ?? "planned"
          : "planned",
      created_at: row.created_at,
    })),
  };

  const filename = `${sanitizeFileSegment(asin)}_ai_data_pack.json`;
  return new Response(`${JSON.stringify(output, null, 2)}\n`, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
