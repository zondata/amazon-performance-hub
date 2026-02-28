import { Readable } from "node:stream";
import { createGzip } from "node:zlib";

import { fetchByDateChunks } from "@/lib/logbook/aiPack/fetchByDateChunks";
import {
  loadSbCampaignIdsForAsin,
  loadSpCampaignIdsForAsin,
} from "@/lib/logbook/aiPack/findAsinCampaignIds";
import {
  selectSpRowsForCoverage,
  sumSpSpend,
} from "@/lib/logbook/aiPack/spCoverageSelection";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CAMPAIGN_ID_LIMIT = 500;
const CAMPAIGN_LIMIT = 50;
const SP_TARGET_LIMIT = 500;
const SP_COVERAGE_THRESHOLD = 0.95;
const PAGE_SIZE = 10_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Channel = "sp" | "sb";
type Scope = "included" | "all";

type MetricRow = {
  spend: number | string | null;
  sales: number | string | null;
  orders: number | string | null;
  units?: number | string | null;
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
  units: number;
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
  units: number;
  clicks: number;
  impressions: number;
};

type SpBulkProductAdLookup = {
  snapshotDate: string | null;
  adGroupIds: string[];
  campaignIds: string[];
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

const sanitizeFileSegment = (value: string): string =>
  value
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]+/g, "")
    .slice(0, 80);

const normalizeIds = (values: unknown[]): string[] => {
  const unique = new Set<string>();
  for (const value of values) {
    const id = String(value ?? "").trim();
    if (!id) continue;
    unique.add(id);
  }
  return [...unique].sort((left, right) => left.localeCompare(right));
};

const parseCampaignIds = (rawValue: string | null): string[] => {
  if (!rawValue) return [];
  return normalizeIds(rawValue.split(",").map((entry) => entry.trim()));
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
        units: 0,
        clicks: 0,
        impressions: 0,
      } as CampaignAggregate);
    prev.spend += num(row.spend);
    prev.sales += num(row.sales);
    prev.orders += num(row.orders);
    prev.units += num(row.units);
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
        units: 0,
        clicks: 0,
        impressions: 0,
      } as TargetAggregate);
    prev.spend += num(row.spend);
    prev.sales += num(row.sales);
    prev.orders += num(row.orders);
    prev.units += num(row.units);
    prev.clicks += num(row.clicks);
    prev.impressions += num(row.impressions);
    byId.set(key, prev);
  }
  return [...byId.values()].sort((a, b) => b.spend - a.spend);
};

const loadLatestBulkSnapshotDate = async (accountId: string): Promise<string | null> => {
  const { data, error } = await supabaseAdmin
    .from("uploads")
    .select("snapshot_date")
    .eq("account_id", accountId)
    .eq("source_type", "bulk")
    .not("snapshot_date", "is", null)
    .order("snapshot_date", { ascending: false })
    .limit(1);
  if (error) {
    throw new Error(`Failed loading bulk snapshot date: ${error.message}`);
  }
  return typeof data?.[0]?.snapshot_date === "string" ? data[0].snapshot_date : null;
};

const loadSpBulkProductAdLookup = async (params: {
  accountId: string;
  asin: string;
  endCandidate: string;
}): Promise<SpBulkProductAdLookup> => {
  const asin = params.asin.trim();
  if (!asin) {
    return { snapshotDate: null, adGroupIds: [], campaignIds: [] };
  }

  const { data: beforeRows, error: beforeError } = await supabaseAdmin
    .from("bulk_product_ads")
    .select("snapshot_date")
    .eq("account_id", params.accountId)
    .lte("snapshot_date", params.endCandidate)
    .order("snapshot_date", { ascending: false })
    .limit(1);
  if (beforeError) {
    throw new Error(`Failed loading SP product-ad snapshot date: ${beforeError.message}`);
  }
  let snapshotDate =
    typeof beforeRows?.[0]?.snapshot_date === "string" ? beforeRows[0].snapshot_date : null;

  if (!snapshotDate) {
    const { data: latestRows, error: latestError } = await supabaseAdmin
      .from("bulk_product_ads")
      .select("snapshot_date")
      .eq("account_id", params.accountId)
      .order("snapshot_date", { ascending: false })
      .limit(1);
    if (latestError) {
      throw new Error(`Failed loading latest SP product-ad snapshot date: ${latestError.message}`);
    }
    snapshotDate =
      typeof latestRows?.[0]?.snapshot_date === "string" ? latestRows[0].snapshot_date : null;
  }

  if (!snapshotDate) {
    return { snapshotDate: null, adGroupIds: [], campaignIds: [] };
  }

  const { data: mapRows, error: mapError } = await supabaseAdmin
    .from("bulk_product_ads")
    .select("campaign_id,ad_group_id")
    .eq("account_id", params.accountId)
    .eq("snapshot_date", snapshotDate)
    .ilike("asin_raw", asin)
    .limit(10_000);
  if (mapError) {
    throw new Error(`Failed loading SP product-ad mappings: ${mapError.message}`);
  }

  return {
    snapshotDate,
    campaignIds: normalizeIds((mapRows ?? []).map((row) => row.campaign_id)),
    adGroupIds: normalizeIds((mapRows ?? []).map((row) => row.ad_group_id)),
  };
};

const resolveDiscoveredCampaignIds = async (params: {
  channel: Channel;
  asin: string;
  accountId: string;
  start: string;
  end: string;
}): Promise<string[]> => {
  const latestSnapshotDate = await loadLatestBulkSnapshotDate(params.accountId);
  const namePattern = `%${params.asin.toLowerCase()}%`;
  if (params.channel === "sp") {
    return loadSpCampaignIdsForAsin({
      asin: params.asin,
      accountId: params.accountId,
      snapshotDate: latestSnapshotDate,
      namePattern,
      startDate: params.start,
      endDate: params.end,
    });
  }
  const [sbResolvedIds, sbAttributedRows] = await Promise.all([
    loadSbCampaignIdsForAsin({
      asin: params.asin,
      accountId: params.accountId,
      snapshotDate: latestSnapshotDate,
      namePattern,
      startDate: params.start,
      endDate: params.end,
    }),
    supabaseAdmin
      .from("sb_attributed_purchases_daily_fact_latest")
      .select("campaign_id")
      .eq("account_id", params.accountId)
      .eq("purchased_asin_norm", params.asin.toLowerCase())
      .gte("date", params.start)
      .lte("date", params.end)
      .limit(50_000),
  ]);
  if (sbAttributedRows.error) {
    throw new Error(
      `Failed loading SB attributed-purchases campaign candidates: ${sbAttributedRows.error.message}`
    );
  }
  return normalizeIds([
    ...sbResolvedIds,
    ...(sbAttributedRows.data ?? []).map((row) => row.campaign_id),
  ]).slice(0, CAMPAIGN_ID_LIMIT);
};

const resolveIncludedCampaignIds = async (params: {
  channel: Channel;
  asin: string;
  accountId: string;
  start: string;
  end: string;
  discoveredCampaignIds: string[];
}): Promise<string[]> => {
  if (params.discoveredCampaignIds.length === 0) return [];

  if (params.channel === "sb") {
    const sbCampaignRows = await fetchByDateChunks<Record<string, unknown>>({
      startDate: params.start,
      endDate: params.end,
      runChunk: async (chunkStart, chunkEnd) => {
        const { data, error } = await supabaseAdmin
          .from("sb_campaign_daily_fact_latest")
          .select("campaign_id,campaign_name_raw,campaign_name_norm,impressions,clicks,spend,sales,orders,units")
          .eq("account_id", params.accountId)
          .in("campaign_id", params.discoveredCampaignIds)
          .gte("date", chunkStart)
          .lte("date", chunkEnd)
          .limit(50_000);
        if (error) throw new Error(error.message);
        return (data ?? []) as Array<Record<string, unknown>>;
      },
    });
    return aggregateCampaignRows(
      sbCampaignRows.rows as Array<
        MetricRow & { campaign_id: string; campaign_name_raw: string; campaign_name_norm: string }
      >
    )
      .slice(0, CAMPAIGN_LIMIT)
      .map((row) => row.campaign_id);
  }

  const productAdLookup = await loadSpBulkProductAdLookup({
    accountId: params.accountId,
    asin: params.asin,
    endCandidate: params.end,
  });
  const campaignIds =
    productAdLookup.campaignIds.length > 0
      ? productAdLookup.campaignIds
      : params.discoveredCampaignIds;
  if (campaignIds.length === 0 && productAdLookup.adGroupIds.length === 0) {
    return [];
  }

  const spTargetRows = await fetchByDateChunks<Record<string, unknown>>({
    startDate: params.start,
    endDate: params.end,
    runChunk: async (chunkStart, chunkEnd) => {
      const baseQuery = supabaseAdmin
        .from("sp_targeting_daily_fact_latest")
        .select(
          "target_id,campaign_id,ad_group_id,campaign_name_raw,campaign_name_norm,targeting_raw,targeting_norm,match_type_norm,impressions,clicks,spend,sales,orders,units"
        )
        .eq("account_id", params.accountId)
        .gte("date", chunkStart)
        .lte("date", chunkEnd)
        .limit(200_000);
      const filteredQuery =
        productAdLookup.adGroupIds.length > 0
          ? baseQuery.in("ad_group_id", productAdLookup.adGroupIds)
          : baseQuery.in("campaign_id", campaignIds);
      const { data, error } = await filteredQuery;
      if (error) throw new Error(error.message);
      return (data ?? []) as Array<Record<string, unknown>>;
    },
  });

  const selection = selectSpRowsForCoverage({
    mappedSpendTotal: sumSpSpend(spTargetRows.rows as Array<{ spend: number }>),
    campaignRows: aggregateCampaignRows(
      spTargetRows.rows as Array<
        MetricRow & { campaign_id: string; campaign_name_raw: string; campaign_name_norm: string }
      >
    ),
    targetRows: aggregateTargetRows(
      spTargetRows.rows as Array<
        MetricRow & {
          target_id: string;
          campaign_id: string;
          targeting_raw: string;
          targeting_norm: string;
          match_type_norm: string | null;
        }
      >
    ),
    campaignLimit: CAMPAIGN_LIMIT,
    targetLimit: SP_TARGET_LIMIT,
    coverageThreshold: SP_COVERAGE_THRESHOLD,
  });
  return selection.campaigns.map((row) => row.campaign_id);
};

const buildResolvedCampaignIds = async (params: {
  channel: Channel;
  asin: string;
  accountId: string;
  start: string;
  end: string;
  scope: Scope;
  campaignIdsArg: string[];
}): Promise<string[]> => {
  if (params.campaignIdsArg.length > 0) {
    return params.campaignIdsArg.slice(0, CAMPAIGN_ID_LIMIT);
  }
  const discoveredCampaignIds = await resolveDiscoveredCampaignIds({
    channel: params.channel,
    asin: params.asin,
    accountId: params.accountId,
    start: params.start,
    end: params.end,
  });
  if (params.scope === "all") {
    return discoveredCampaignIds.slice(0, CAMPAIGN_ID_LIMIT);
  }
  return resolveIncludedCampaignIds({
    channel: params.channel,
    asin: params.asin,
    accountId: params.accountId,
    start: params.start,
    end: params.end,
    discoveredCampaignIds,
  });
};

const toNdjsonLine = (channel: Channel, row: Record<string, unknown>): string =>
  `${JSON.stringify({
    channel,
    date: row.date ?? null,
    campaign_id: row.campaign_id ?? null,
    ad_group_id: row.ad_group_id ?? null,
    target_id: row.target_id ?? null,
    target_key: row.target_key ?? null,
    targeting_norm: row.targeting_norm ?? null,
    match_type_norm: row.match_type_norm ?? null,
    customer_search_term_norm: row.customer_search_term_norm ?? null,
    search_term_impression_share: toFiniteNumberOrNull(row.search_term_impression_share),
    search_term_impression_rank: toFiniteNumberOrNull(row.search_term_impression_rank),
    impressions: num(row.impressions),
    clicks: num(row.clicks),
    spend: num(row.spend),
    sales: num(row.sales),
    orders: num(row.orders),
    units: num(row.units),
  })}\n`;

const buildNdjsonGenerator = (params: {
  channel: Channel;
  table: "sp_stis_daily_fact_latest" | "sb_stis_daily_fact_latest";
  accountId: string;
  start: string;
  end: string;
  campaignIds: string[];
}) =>
  async function* ndjsonGenerator(): AsyncGenerator<string> {
    if (params.campaignIds.length === 0) return;
    let from = 0;
    while (true) {
      const query = supabaseAdmin
        .from(params.table)
        .select(
          "date,campaign_id,ad_group_id,target_id,target_key,targeting_norm,match_type_norm,customer_search_term_norm,search_term_impression_share,search_term_impression_rank,impressions,clicks,spend,sales,orders,units"
        )
        .eq("account_id", params.accountId)
        .gte("date", params.start)
        .lte("date", params.end)
        .in("campaign_id", params.campaignIds)
        .order("date", { ascending: true })
        .order("campaign_id", { ascending: true })
        .order("ad_group_id", { ascending: true })
        .order("target_key", { ascending: true })
        .order("customer_search_term_norm", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      const { data, error } = await query;
      if (error) {
        throw new Error(`Failed loading ${params.channel.toUpperCase()} STIS rows: ${error.message}`);
      }
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      if (rows.length === 0) break;
      for (const row of rows) {
        yield toNdjsonLine(params.channel, row);
      }
      if (rows.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  };

type Ctx = { params: Promise<{ asin: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { asin: rawAsin } = await params;
  const asin = (rawAsin ?? "").trim().toUpperCase();
  if (!asin) {
    return new Response("Missing ASIN param.", { status: 400 });
  }

  const url = new URL(request.url);
  const channelRaw = String(url.searchParams.get("channel") ?? "").trim().toLowerCase();
  const channel: Channel | null =
    channelRaw === "sp" || channelRaw === "sb" ? (channelRaw as Channel) : null;
  if (!channel) {
    return new Response("Query param channel=sp|sb is required.", { status: 400 });
  }

  const start = String(url.searchParams.get("start") ?? "").trim();
  const end = String(url.searchParams.get("end") ?? "").trim();
  if (!DATE_RE.test(start) || !DATE_RE.test(end)) {
    return new Response("Query params start and end must be YYYY-MM-DD.", { status: 400 });
  }
  if (start > end) {
    return new Response("Query param start must be <= end.", { status: 400 });
  }

  const scopeRaw = String(url.searchParams.get("scope") ?? "all").trim().toLowerCase();
  const scope: Scope = scopeRaw === "included" ? "included" : "all";

  const formatRaw = String(url.searchParams.get("format") ?? "ndjson").trim().toLowerCase();
  const isGzip = formatRaw === "ndjson.gz";
  if (formatRaw !== "ndjson" && formatRaw !== "ndjson.gz") {
    return new Response("Query param format must be ndjson or ndjson.gz.", { status: 400 });
  }

  let campaignIds: string[] = [];
  try {
    campaignIds = await buildResolvedCampaignIds({
      channel,
      asin,
      accountId: env.accountId,
      start,
      end,
      scope,
      campaignIdsArg: parseCampaignIds(url.searchParams.get("campaign_ids")),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed resolving campaign IDs.";
    return new Response(message, { status: 500 });
  }

  const table =
    channel === "sp" ? "sp_stis_daily_fact_latest" : ("sb_stis_daily_fact_latest" as const);
  const filenameBase = `${sanitizeFileSegment(asin)}_${channel}_stis_${start}_${end}.ndjson`;

  const textStream = Readable.from(
    buildNdjsonGenerator({
      channel,
      table,
      accountId: env.accountId,
      start,
      end,
      campaignIds,
    })()
  );

  const headers = new Headers();
  headers.set("content-type", "application/x-ndjson; charset=utf-8");
  if (isGzip) {
    headers.set("content-disposition", `attachment; filename="${filenameBase}.gz"`);
    headers.set("content-encoding", "gzip");
    const gzip = createGzip();
    textStream.pipe(gzip);
    return new Response(gzip as unknown as BodyInit, { headers });
  }

  headers.set("content-disposition", `attachment; filename="${filenameBase}"`);
  return new Response(textStream as unknown as BodyInit, { headers });
}
