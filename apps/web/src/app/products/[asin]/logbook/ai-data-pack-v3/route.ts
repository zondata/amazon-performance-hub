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
import { loadSpTargetingBaselineDateBounds } from "@/lib/logbook/aiPack/spTargetingBaselineBounds";
import {
  selectSpRowsForCoverage,
  sumSpSpend,
} from "@/lib/logbook/aiPack/spCoverageSelection";
import {
  fetchByDateChunks,
  type FetchByDateChunksResult,
} from "@/lib/logbook/aiPack/fetchByDateChunks";
import { PackIncompleteError } from "@/lib/logbook/aiPack/PackIncompleteError";
import {
  buildNoChannelMessages,
  legacyWarningsFromMessages,
  type PackMessage,
  type PackMessageLevel,
} from "@/lib/logbook/aiPack/packMessages";
import { requireCompleteChunkFetch } from "@/lib/logbook/aiPack/requireCompleteChunkFetch";
import {
  calcAcos,
  calcCpc,
  calcCtr,
  calcCvrOrdersPerClick,
  calcRoas,
  mapPlacementModifierKey,
  weightedAvgTosIs,
} from "@/lib/logbook/aiPack/aiPackV3Helpers";
import { computeBoundedRange } from "@/lib/ads/boundedDateRange";
import { buildAdsReconciliationDaily } from "@/lib/ads/buildAdsReconciliationDaily";
import { computePpcAttributionBridge } from "@/lib/logbook/aiPack/ppcAttributionBridge";
import { computeBaselineSummary } from "@/lib/logbook/computedSummary";
import { type DriverIntent } from "@/lib/logbook/driverIntent";
import { extractEvaluationOutcome } from "@/lib/logbook/evaluationOutcomeExtract";
import { deriveKivCarryForward } from "@/lib/logbook/kiv";
import { extractProductProfileContext } from "@/lib/products/productProfileContext";
import { resolveSkillsByIds } from "@/lib/skills/resolveSkills";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const CAMPAIGN_LIMIT = 50;
const SB_TARGET_LIMIT = 200;
const SD_TARGET_LIMIT = 200;
const SP_TARGET_LIMIT = 500;
const SP_COVERAGE_THRESHOLD = 0.95;
const MAX_BASELINE_DAYS = 180;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type MetricRow = {
  spend: number | string | null;
  sales: number | string | null;
  orders: number | string | null;
  units?: number | string | null;
  clicks: number | string | null;
  impressions?: number | string | null;
};

type SbAllocatedSpendRow = {
  date: string | null;
  allocated_spend: number | string | null;
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

type SdTargetAggregate = {
  target_key: string;
  target_id: string | null;
  campaign_id: string;
  ad_group_id: string;
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

type PlacementAggregate = {
  campaign_id: string;
  placement_code: string;
  placement_raw: string;
  placement_raw_norm: string;
  spend: number;
  sales: number;
  orders: number;
  units: number;
  clicks: number;
  impressions: number;
};

type DateBounds = {
  minDate: string | null;
  maxDate: string | null;
};

type SpBulkProductAdLookup = {
  snapshotDate: string | null;
  adGroupIds: string[];
  campaignIds: string[];
};

type QueryErrorLike = { message?: string } | null | undefined;

type QueryResult = {
  data?: Array<Record<string, unknown>> | null;
  error?: QueryErrorLike;
};

type FetchDiagnosticEntry = {
  chunksTotal: number;
  chunksSucceeded: number;
  chunksFailed: number;
  retriesUsedMax: number;
  failedRangesSampleCount: number;
  failedRangesSample?: Array<{
    chunkStart: string;
    chunkEnd: string;
    message: string;
  }>;
};

type FetchDiagnostics = Partial<Record<string, FetchDiagnosticEntry>>;

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

const toDateString = (value: Date): string => value.toISOString().slice(0, 10);

const addUtcDays = (date: string, days: number): string => {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return toDateString(parsed);
};

const dayCountInclusive = (start: string, end: string): number => {
  const startMs = new Date(`${start}T00:00:00Z`).getTime();
  const endMs = new Date(`${end}T00:00:00Z`).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return 0;
  return Math.floor((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1;
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

const aggregateSdTargetRows = (
  rows: Array<
    MetricRow & {
      target_key: string;
      target_id: string | null;
      campaign_id: string;
      ad_group_id: string;
      targeting_raw: string;
      targeting_norm: string;
      match_type_norm: string | null;
      units: number | string | null;
    }
  >
): SdTargetAggregate[] => {
  const byKey = new Map<string, SdTargetAggregate>();
  for (const row of rows) {
    const key = row.target_key;
    if (!key) continue;
    const prev =
      byKey.get(key) ??
      ({
        target_key: row.target_key,
        target_id: row.target_id,
        campaign_id: row.campaign_id,
        ad_group_id: row.ad_group_id,
        targeting_raw: row.targeting_raw,
        targeting_norm: row.targeting_norm,
        match_type_norm: row.match_type_norm,
        spend: 0,
        sales: 0,
        orders: 0,
        units: 0,
        clicks: 0,
        impressions: 0,
      } as SdTargetAggregate);
    prev.spend += num(row.spend);
    prev.sales += num(row.sales);
    prev.orders += num(row.orders);
    prev.units += num(row.units);
    prev.clicks += num(row.clicks);
    prev.impressions += num(row.impressions);
    byKey.set(key, prev);
  }
  return [...byKey.values()].sort((a, b) => b.spend - a.spend);
};

const aggregatePlacementRows = (
  rows: Array<
    MetricRow & {
      campaign_id: string;
      placement_code: string | null;
      placement_raw: string | null;
      placement_raw_norm: string | null;
      units: number | string | null;
    }
  >
): PlacementAggregate[] => {
  const byKey = new Map<string, PlacementAggregate>();
  for (const row of rows) {
    const campaignId = row.campaign_id;
    if (!campaignId) continue;
    const placementCode = String(row.placement_code ?? "").trim();
    const placementRawNorm = String(row.placement_raw_norm ?? "").trim();
    const placementRaw = String(row.placement_raw ?? "").trim();
    const key = `${campaignId}::${placementCode}::${placementRawNorm}`;
    const prev =
      byKey.get(key) ??
      ({
        campaign_id: campaignId,
        placement_code: placementCode,
        placement_raw: placementRaw,
        placement_raw_norm: placementRawNorm,
        spend: 0,
        sales: 0,
        orders: 0,
        units: 0,
        clicks: 0,
        impressions: 0,
      } as PlacementAggregate);
    prev.spend += num(row.spend);
    prev.sales += num(row.sales);
    prev.orders += num(row.orders);
    prev.units += num(row.units);
    prev.clicks += num(row.clicks);
    prev.impressions += num(row.impressions);
    byKey.set(key, prev);
  }
  return [...byKey.values()].sort((a, b) => b.spend - a.spend);
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

const normalizeIds = (values: unknown[]): string[] => {
  const unique = new Set<string>();
  for (const value of values) {
    const id = String(value ?? "").trim();
    if (!id) continue;
    unique.add(id);
  }
  return [...unique].sort((left, right) => left.localeCompare(right));
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
  let snapshotDate = parseDateField(beforeRows?.[0]?.snapshot_date) ?? null;

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
    snapshotDate = parseDateField(latestRows?.[0]?.snapshot_date) ?? null;
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
    .limit(10000);
  if (mapError) {
    throw new Error(`Failed loading SP product-ad mappings: ${mapError.message}`);
  }

  return {
    snapshotDate,
    campaignIds: normalizeIds((mapRows ?? []).map((row) => row.campaign_id)),
    adGroupIds: normalizeIds((mapRows ?? []).map((row) => row.ad_group_id)),
  };
};

const sampleChunkErrors = (entries: Array<{ chunkStart: string; chunkEnd: string; message: string }>) =>
  entries.slice(0, 3).map((entry) => ({
    chunkStart: entry.chunkStart,
    chunkEnd: entry.chunkEnd,
    message: entry.message,
  }));

const buildPackIncompleteResponse = (params: {
  error: PackIncompleteError;
  messages: PackMessage[];
  fetchDiagnostics: FetchDiagnostics;
}) => {
  const diagnosticEntry: FetchDiagnosticEntry = {
    chunksTotal: params.error.stats?.chunksTotal ?? 0,
    chunksSucceeded: params.error.stats?.chunksSucceeded ?? 0,
    chunksFailed:
      params.error.stats?.chunksFailed ?? params.error.chunkErrors.length,
    retriesUsedMax: params.error.stats?.retriesUsedMax ?? 0,
    failedRangesSampleCount:
      params.error.stats?.failedRangesCount ?? params.error.chunkErrors.length,
    ...(params.error.chunkErrors.length > 0
      ? { failedRangesSample: sampleChunkErrors(params.error.chunkErrors) }
      : {}),
  };

  const messages = [
    ...params.messages,
    {
      level: "error" as const,
      code: params.error.code,
      text: params.error.message,
      ...(params.error.context ? { meta: params.error.context } : {}),
    },
  ];

  return new Response(
    `${JSON.stringify(
      {
        ok: false,
        status: "pack_incomplete",
        error: params.error.message,
        messages,
        fetch_diagnostics: {
          ...params.fetchDiagnostics,
          pack_incomplete: {
            label: params.error.label,
            ...diagnosticEntry,
            ...(params.error.context ? { context: params.error.context } : {}),
          },
        },
      },
      null,
      2
    )}\n`,
    {
      status: 409,
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
    }
  );
};

const chunkIds = (values: string[], size: number): string[][] => {
  const chunks: string[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
};

type Ctx = { params: Promise<{ asin: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { asin: rawAsin } = await params;
  const asin = (rawAsin ?? "").trim().toUpperCase();
  if (!asin) {
    return new Response("Missing ASIN param.", { status: 400 });
  }

  const fetchDiagnostics: FetchDiagnostics = {};
  const packMessages: PackMessage[] = [];

  try {
  const url = new URL(request.url);
  const requestedRangeParam = url.searchParams.get("range");
  const requestedRange = normalizeBaselineRange(requestedRangeParam);
  const excludeLastDays = normalizeExcludeLastDays(url.searchParams.get("exclude_last_days"));
  const todayMinusExcludeDays = computeTodayMinusExcludeDays(excludeLastDays);
  const endArg = url.searchParams.get("end");
  const userEnd = endArg && DATE_RE.test(endArg) ? endArg : null;
  const endCandidate = computeEndCandidate(todayMinusExcludeDays, userEnd);
  const { startBound, endBound } = computeBoundedRange({
    requestedRange: requestedRangeParam ?? requestedRange,
    endDate: endCandidate,
  });
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
  const profileContext = extractProductProfileContext(profileRow?.profile_json ?? null);

  const { data: driverIntentRows, error: driverIntentError } = await supabaseAdmin
    .from("log_driver_campaign_intents")
    .select("channel,campaign_id,intent,notes,constraints_json,updated_at")
    .eq("account_id", env.accountId)
    .eq("marketplace", env.marketplace)
    .eq("asin_norm", asin)
    .order("updated_at", { ascending: false })
    .limit(10000);
  if (driverIntentError) {
    return new Response(`Failed loading driver campaign intents: ${driverIntentError.message}`, {
      status: 500,
    });
  }

  const driverCampaignIntents: DriverIntent[] = (driverIntentRows ?? []).map((row) => ({
    channel: String(row.channel ?? "").trim().toLowerCase(),
    campaign_id: String(row.campaign_id ?? "").trim(),
    intent: String(row.intent ?? "").trim(),
    notes: typeof row.notes === "string" ? row.notes : null,
    constraints_json: asRecord(row.constraints_json),
    updated_at: String(row.updated_at ?? ""),
  }));

  const { data: kivRows, error: kivError } = await supabaseAdmin
    .from("log_product_kiv_items")
    .select(
      "kiv_id,created_at,status,title,details,source,source_experiment_id,tags,priority,due_date,resolved_at,resolution_notes"
    )
    .eq("account_id", env.accountId)
    .eq("marketplace", env.marketplace)
    .eq("asin_norm", asin)
    .order("created_at", { ascending: false })
    .limit(10000);
  if (kivError) {
    return new Response(`Failed loading KIV backlog: ${kivError.message}`, {
      status: 500,
    });
  }

  const kivBacklog = deriveKivCarryForward(kivRows ?? []);

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

  let spBulkProductAdLookup: SpBulkProductAdLookup = {
    snapshotDate: null,
    adGroupIds: [],
    campaignIds: [],
  };
  try {
    spBulkProductAdLookup = await loadSpBulkProductAdLookup({
      accountId: env.accountId,
      asin,
      endCandidate,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed loading SP product-ad ASIN mappings.";
    return new Response(message, { status: 500 });
  }

  let spCandidateCampaignIds: string[] = [...spBulkProductAdLookup.campaignIds];
  let sbCandidateCampaignIds: string[] = [];
  try {
    const [spFallbackCampaignIds, sbCampaignIds] = await Promise.all([
      spCandidateCampaignIds.length === 0
        ? loadSpCampaignIdsForAsin({
            asin,
            accountId: env.accountId,
            snapshotDate: latestSnapshotDate,
            namePattern: asinNamePattern,
            startDate: startBound,
            endDate: endBound,
          })
        : Promise.resolve<string[]>([]),
      loadSbCampaignIdsForAsin({
        asin,
        accountId: env.accountId,
        snapshotDate: latestSnapshotDate,
        namePattern: asinNamePattern,
        startDate: startBound,
        endDate: endBound,
      }),
    ]);
    if (spCandidateCampaignIds.length === 0) {
      spCandidateCampaignIds = spFallbackCampaignIds;
    }
    sbCandidateCampaignIds = sbCampaignIds;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed resolving ASIN campaign IDs.";
    return new Response(message, { status: 500 });
  }

  const messages: PackMessage[] = packMessages;
  const messageDedup = new Set<string>();
  const addMessage = (
    level: PackMessageLevel,
    code: string,
    text: string,
    meta?: Record<string, unknown>
  ): void => {
    messages.push(meta ? { level, code, text, meta } : { level, code, text });
  };
  const addMessageOnce = (
    level: PackMessageLevel,
    code: string,
    text: string,
    meta?: Record<string, unknown>
  ): void => {
    const dedupKey = `${level}:${code}:${text}`;
    if (messageDedup.has(dedupKey)) return;
    messageDedup.add(dedupKey);
    addMessage(level, code, text, meta);
  };

  addMessage("debug", "DEBUG_ACCOUNT", `accountId=${env.accountId}`);
  for (const message of buildNoChannelMessages({
    hasSbCampaignCandidates: sbCandidateCampaignIds.length > 0,
    hasSdCampaignCandidates: true,
  })) {
    addMessage(message.level, message.code, message.text, message.meta);
  }

  const toFetchDiagnosticEntry = (
    result: FetchByDateChunksResult<unknown>
  ): FetchDiagnosticEntry => {
    const failedRangesSample = result.stats.failedRangesSample;
    return {
      chunksTotal: result.stats.chunksTotal,
      chunksSucceeded: result.stats.chunksSucceeded,
      chunksFailed: result.stats.chunksFailed,
      retriesUsedMax: result.stats.retriesUsedMax,
      failedRangesSampleCount: result.stats.failedRangesCount,
      ...(failedRangesSample.length > 0 ? { failedRangesSample } : {}),
    };
  };

  const loadOptionalDateBounds = async (
    label: string,
    loader: () => Promise<DateBounds>
  ): Promise<DateBounds> => {
    try {
      return await loader();
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      addMessage("warn", "AVAILABILITY_QUERY_FAILED", `Failed loading ${label}: ${message}; treating availability as empty.`, {
        label,
      });
      return { minDate: null, maxDate: null };
    }
  };

  let availability: BaselineAvailabilityMap;
  try {
    const [
      salesBounds,
      spCampaignBounds,
      spTargetBounds,
      sbCampaignBounds,
      sbKeywordBounds,
      sbAttributedPurchasesBounds,
      rankingBounds,
      sqpBounds,
      spAdvertisedAsinBounds,
      sbAllocatedAsinSpendBounds,
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
          .gte("date", startBound)
          .lte("date", endBound)
          .order("date", { ascending: true })
          .limit(1),
        supabaseAdmin
          .from("si_sales_trend_daily_latest")
          .select("date")
          .eq("account_id", env.accountId)
          .eq("marketplace", env.marketplace)
          .eq("asin", asin)
          .gte("date", startBound)
          .lte("date", endBound)
          .order("date", { ascending: false })
          .limit(1)
      ),
      Promise.resolve({ minDate: startBound, maxDate: endBound }),
      loadSpTargetingBaselineDateBounds({
        supabase: supabaseAdmin,
        accountId: env.accountId,
        campaignIds: spCandidateCampaignIds,
        asinNorm: asin,
        startDate: startBound,
        endDate: endBound,
      }),
      sbCandidateCampaignIds.length > 0
        ? loadDateBounds(
            "date",
            "SB campaign baseline",
            supabaseAdmin
              .from("sb_campaign_daily_fact_latest_gold")
              .select("date")
              .eq("account_id", env.accountId)
              .in("campaign_id", sbCandidateCampaignIds)
              .gte("date", startBound)
              .lte("date", endBound)
              .order("date", { ascending: true })
              .limit(1),
            supabaseAdmin
              .from("sb_campaign_daily_fact_latest_gold")
              .select("date")
              .eq("account_id", env.accountId)
              .in("campaign_id", sbCandidateCampaignIds)
              .gte("date", startBound)
              .lte("date", endBound)
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
              .gte("date", startBound)
              .lte("date", endBound)
              .order("date", { ascending: true })
              .limit(1),
            supabaseAdmin
              .from("sb_keyword_daily_fact_latest")
              .select("date")
              .eq("account_id", env.accountId)
              .in("campaign_id", sbCandidateCampaignIds)
              .gte("date", startBound)
              .lte("date", endBound)
              .order("date", { ascending: false })
              .limit(1)
          )
        : Promise.resolve({ minDate: null, maxDate: null }),
      loadDateBounds(
        "date",
        "SB attributed purchases baseline",
        supabaseAdmin
          .from("sb_attributed_purchases_daily_fact_latest")
          .select("date")
          .eq("account_id", env.accountId)
          .eq("purchased_asin_norm", asin)
          .gte("date", startBound)
          .lte("date", endBound)
          .order("date", { ascending: true })
          .limit(1),
        supabaseAdmin
          .from("sb_attributed_purchases_daily_fact_latest")
          .select("date")
          .eq("account_id", env.accountId)
          .eq("purchased_asin_norm", asin)
          .gte("date", startBound)
          .lte("date", endBound)
          .order("date", { ascending: false })
          .limit(1)
      ),
      loadDateBounds(
        "observed_date",
        "ranking baseline",
        supabaseAdmin
          .from("h10_keyword_rank_daily_latest")
          .select("observed_date")
          .eq("account_id", env.accountId)
          .eq("marketplace", env.marketplace)
          .eq("asin", asin)
          .gte("observed_date", startBound)
          .lte("observed_date", endBound)
          .order("observed_date", { ascending: true })
          .limit(1),
        supabaseAdmin
          .from("h10_keyword_rank_daily_latest")
          .select("observed_date")
          .eq("account_id", env.accountId)
          .eq("marketplace", env.marketplace)
          .eq("asin", asin)
          .gte("observed_date", startBound)
          .lte("observed_date", endBound)
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
          .gte("week_end", startBound)
          .lte("week_end", endBound)
          .order("week_end", { ascending: true })
          .limit(1),
        supabaseAdmin
          .from("sqp_weekly_latest_enriched")
          .select("week_end")
          .eq("account_id", env.accountId)
          .eq("marketplace", env.marketplace)
          .eq("scope_type", "asin")
          .eq("scope_value", asin)
          .gte("week_end", startBound)
          .lte("week_end", endBound)
          .order("week_end", { ascending: false })
          .limit(1)
      ),
      loadOptionalDateBounds("SP advertised-product ASIN baseline", () =>
        loadDateBounds(
          "date",
          "SP advertised-product ASIN baseline",
          supabaseAdmin
            .from("sp_advertised_product_daily_fact_latest")
            .select("date")
            .eq("account_id", env.accountId)
            .eq("advertised_asin_norm", asin)
            .gte("date", startBound)
            .lte("date", endBound)
            .order("date", { ascending: true })
            .limit(1),
          supabaseAdmin
            .from("sp_advertised_product_daily_fact_latest")
            .select("date")
            .eq("account_id", env.accountId)
            .eq("advertised_asin_norm", asin)
            .gte("date", startBound)
            .lte("date", endBound)
            .order("date", { ascending: false })
            .limit(1)
        )
      ),
      loadOptionalDateBounds("SB allocated ASIN spend baseline", async () => {
        try {
          return await loadDateBounds(
            "date",
            "SB allocated ASIN spend baseline",
            supabaseAdmin
              .from("sb_allocated_asin_spend_daily_v3")
              .select("date")
              .eq("account_id", env.accountId)
              .eq("asin_norm", asin)
              .gte("date", startBound)
              .lte("date", endBound)
              .order("date", { ascending: true })
              .limit(1),
            supabaseAdmin
              .from("sb_allocated_asin_spend_daily_v3")
              .select("date")
              .eq("account_id", env.accountId)
              .eq("asin_norm", asin)
              .gte("date", startBound)
              .lte("date", endBound)
              .order("date", { ascending: false })
              .limit(1)
          );
        } catch {
          return loadDateBounds(
            "date",
            "SB allocated ASIN spend baseline",
            supabaseAdmin
              .from("sb_allocated_asin_spend_daily_v3")
              .select("date")
              .eq("account_id", env.accountId)
              .eq("purchased_asin_norm", asin)
              .gte("date", startBound)
              .lte("date", endBound)
              .order("date", { ascending: true })
              .limit(1),
            supabaseAdmin
              .from("sb_allocated_asin_spend_daily_v3")
              .select("date")
              .eq("account_id", env.accountId)
              .eq("purchased_asin_norm", asin)
              .gte("date", startBound)
              .lte("date", endBound)
              .order("date", { ascending: false })
              .limit(1)
          );
        }
      }),
    ]);

    availability = {
      sales: salesBounds,
      sp_campaign: spCampaignBounds,
      sp_target: spTargetBounds,
      sb_campaign: sbCampaignBounds,
      sb_keyword: sbKeywordBounds,
      sb_attributed_purchases: sbAttributedPurchasesBounds,
      ranking: rankingBounds,
      sqp: sqpBounds,
      sp_advertised_asin: spAdvertisedAsinBounds,
      sb_allocated_asin_spend: sbAllocatedAsinSpendBounds,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed loading dataset availability.";
    return new Response(message, { status: 500 });
  }

  const requiredAvailability: BaselineAvailabilityMap = {
    sales: availability.sales,
    sp_target: availability.sp_target,
    sb_campaign: availability.sb_campaign,
    sb_keyword: availability.sb_keyword,
    sb_attributed_purchases: availability.sb_attributed_purchases,
    sp_advertised_asin: availability.sp_advertised_asin,
    sb_allocated_asin_spend: availability.sb_allocated_asin_spend,
    ranking: availability.ranking,
    sqp: availability.sqp,
  };

  const window = computeBaselineWindow({
    requestedRange,
    endCandidate,
    availability: requiredAvailability,
  });

  const expectedEmptyDatasets = new Set<string>([
    "sales",
    "sp_advertised_asin",
    "ranking",
    "sqp",
  ]);
  if (spBulkProductAdLookup.adGroupIds.length > 0 || spCandidateCampaignIds.length > 0) {
    expectedEmptyDatasets.add("sp_target");
  }
  if (sbCandidateCampaignIds.length > 0) {
    expectedEmptyDatasets.add("sb_campaign");
    expectedEmptyDatasets.add("sb_keyword");
    expectedEmptyDatasets.add("sb_attributed_purchases");
    expectedEmptyDatasets.add("sb_allocated_asin_spend");
  }

  const datasetLabels: Record<string, string> = {
    sales: "sales baseline",
    sp_target: "SP targeting baseline",
    sb_campaign: "SB campaign baseline",
    sb_keyword: "SB keyword baseline",
    sb_attributed_purchases: "SB attributed purchases baseline",
    ranking: "ranking baseline",
    sqp: "SQP baseline",
    sp_advertised_asin: "SP advertised-product baseline",
    sb_allocated_asin_spend: "SB allocated spend baseline",
  };

  for (const [dataset, bounds] of Object.entries(availability)) {
    if ((!bounds.minDate || !bounds.maxDate) && expectedEmptyDatasets.has(dataset)) {
      const datasetLabel = datasetLabels[dataset] ?? dataset;
      addMessage(
        "info",
        "DATASET_EMPTY",
        `No ${datasetLabel} rows for this ASIN in the selected range.`,
        { dataset, through_date: endCandidate }
      );
    }
  }
  if (window.usedFallback) {
    addMessage(
      "warn",
      "WINDOW_FALLBACK",
      "Computed overlap window was empty; fallback window set to the last 60 days (capped by exclude_last_days)."
    );
  }

  let effectiveStart = window.effectiveStart;
  const effectiveEnd = window.effectiveEnd;
  const baselineDays = dayCountInclusive(effectiveStart, effectiveEnd);
  if (baselineDays > MAX_BASELINE_DAYS) {
    const cappedStart = addUtcDays(effectiveEnd, -(MAX_BASELINE_DAYS - 1));
    addMessage(
      "warn",
      "BASELINE_RANGE_CAPPED",
      `Baseline window capped to ${MAX_BASELINE_DAYS} days: ${cappedStart}..${effectiveEnd} (requested ${effectiveStart}..${effectiveEnd}).`,
      {
        max_baseline_days: MAX_BASELINE_DAYS,
        requested_start: effectiveStart,
        requested_end: effectiveEnd,
        effective_start: cappedStart,
        effective_end: effectiveEnd,
      }
    );
    effectiveStart = cappedStart;
  }
  try {
    const [spResolvedCampaignIds, sbResolvedCampaignIds] = await Promise.all([
      loadSpCampaignIdsForAsin({
        asin,
        accountId: env.accountId,
        snapshotDate: latestSnapshotDate,
        namePattern: asinNamePattern,
        startDate: effectiveStart,
        endDate: effectiveEnd,
      }),
      loadSbCampaignIdsForAsin({
        asin,
        accountId: env.accountId,
        snapshotDate: latestSnapshotDate,
        namePattern: asinNamePattern,
        startDate: effectiveStart,
        endDate: effectiveEnd,
      }),
    ]);
    if (spBulkProductAdLookup.campaignIds.length === 0) {
      spCandidateCampaignIds = spResolvedCampaignIds;
    }
    sbCandidateCampaignIds = sbResolvedCampaignIds;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed resolving ASIN campaign IDs for effective window.";
    return new Response(message, { status: 500 });
  }

  const loadRowsByDateChunks = async <T>(params: {
    label: string;
    allChunksFailedSuffix?: string;
    diagnosticsKey?: string;
    incompleteCode?: string;
    runChunk: (chunkStart: string, chunkEnd: string) => Promise<T[]>;
  }): Promise<T[]> => {
    const result = await fetchByDateChunks<T>({
      startDate: effectiveStart,
      endDate: effectiveEnd,
      runChunk: params.runChunk,
    });
    if (params.diagnosticsKey) {
      fetchDiagnostics[params.diagnosticsKey] = toFetchDiagnosticEntry(result as FetchByDateChunksResult<unknown>);
    }
    return requireCompleteChunkFetch({
      label: params.label,
      result,
      code: params.incompleteCode ?? "CHUNK_FETCH_INCOMPLETE",
      ...(params.allChunksFailedSuffix
        ? {
            context: {
              impact: params.allChunksFailedSuffix,
            },
          }
        : {}),
    });
  };

  let spSelectionProductAdLookup: SpBulkProductAdLookup = {
    snapshotDate: null,
    adGroupIds: [],
    campaignIds: [],
  };
  try {
    spSelectionProductAdLookup = await loadSpBulkProductAdLookup({
      accountId: env.accountId,
      asin,
      endCandidate: effectiveEnd,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed loading SP product-ad mappings for baseline window.";
    return new Response(message, { status: 500 });
  }
  const spSelectionCampaignIds =
    spSelectionProductAdLookup.campaignIds.length > 0
      ? [...spSelectionProductAdLookup.campaignIds]
      : [...spCandidateCampaignIds];

  const hasSpCampaignFactRows = async (campaignIds: string[]): Promise<boolean> => {
    for (const idChunk of chunkIds(campaignIds, 300)) {
      const { data, error } = await supabaseAdmin
        .from("sp_campaign_hourly_fact")
        .select("campaign_id")
        .eq("account_id", env.accountId)
        .in("campaign_id", idChunk)
        .gte("date", effectiveStart)
        .lte("date", effectiveEnd)
        .limit(1);
      if (error) {
        throw new Error(`Failed checking SP campaign fact-table existence: ${error.message}`);
      }
      if ((data ?? []).length > 0) {
        return true;
      }
    }
    return false;
  };

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
  const siPpcCostTotal = (salesRows ?? []).reduce((total, row) => total + num(row.ppc_cost), 0);

  const spAdvertisedAsinRows = await loadRowsByDateChunks<Record<string, unknown>>({
    label: "SP advertised-product baseline rows",
    allChunksFailedSuffix:
      "SP advertised-product spend is incomplete/unknown for this window; totals may appear as 0.",
    runChunk: async (chunkStart, chunkEnd) => {
      const { data, error } = await supabaseAdmin
        .from("sp_advertised_product_daily_fact_latest")
        .select("date,impressions,clicks,spend,sales,orders,units")
        .eq("account_id", env.accountId)
        .gte("date", chunkStart)
        .lte("date", chunkEnd)
        .eq("advertised_asin_norm", asin)
        .limit(200000);
      if (error) {
        throw new Error(error.message);
      }
      return (data ?? []) as Array<Record<string, unknown>>;
    },
  });
  const spAdvertisedAsinDailyByDate = new Map<
    string,
    {
      date: string;
      impressions: number;
      clicks: number;
      spend: number;
      sales: number;
      orders: number;
      units: number;
    }
  >();
  for (const row of spAdvertisedAsinRows) {
    const date = parseDateField(row.date);
    if (!date) continue;
    const prev = spAdvertisedAsinDailyByDate.get(date) ?? {
      date,
      impressions: 0,
      clicks: 0,
      spend: 0,
      sales: 0,
      orders: 0,
      units: 0,
    };
    prev.impressions += num(row.impressions);
    prev.clicks += num(row.clicks);
    prev.spend += num(row.spend);
    prev.sales += num(row.sales);
    prev.orders += num(row.orders);
    prev.units += num(row.units);
    spAdvertisedAsinDailyByDate.set(date, prev);
  }
  const spAdvertisedAsinDaily = [...spAdvertisedAsinDailyByDate.values()].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const spAdvertisedAsinTotals = spAdvertisedAsinDaily.reduce<{
    impressions: number;
    clicks: number;
    spend: number;
    sales: number;
    orders: number;
    units: number;
  }>(
    (totals, row) => {
      totals.impressions += row.impressions;
      totals.clicks += row.clicks;
      totals.spend += row.spend;
      totals.sales += row.sales;
      totals.orders += row.orders;
      totals.units += row.units;
      return totals;
    },
    { impressions: 0, clicks: 0, spend: 0, sales: 0, orders: 0, units: 0 }
  );

  let sbAttributedPurchaseCampaignIds: string[] = [];
  const sbAttributedPurchaseRows = await loadRowsByDateChunks<Record<string, unknown>>({
    label: "SB attributed purchases baseline rows",
    allChunksFailedSuffix:
      "SB attributed purchases are incomplete/unknown for this window; totals may appear as 0.",
    runChunk: async (chunkStart, chunkEnd) => {
      const { data, error } = await supabaseAdmin
        .from("sb_attributed_purchases_daily_fact_latest")
        .select("date,campaign_id,impressions,clicks,spend,sales,orders,units")
        .eq("account_id", env.accountId)
        .gte("date", chunkStart)
        .lte("date", chunkEnd)
        .eq("purchased_asin_norm", asin)
        .limit(200000);
      if (error) {
        throw new Error(error.message);
      }
      return (data ?? []) as Array<Record<string, unknown>>;
    },
  });
  sbAttributedPurchaseCampaignIds = normalizeIds(sbAttributedPurchaseRows.map((row) => row.campaign_id));
  if (sbAttributedPurchaseCampaignIds.length > 0) {
    sbCandidateCampaignIds = normalizeIds([
      ...sbCandidateCampaignIds,
      ...sbAttributedPurchaseCampaignIds,
    ]);
  }
  const sbAttributedPurchasesDailyByDate = new Map<
    string,
    {
      date: string;
      impressions: number;
      clicks: number;
      spend: number;
      sales: number;
      orders: number;
      units: number;
    }
  >();
  for (const row of sbAttributedPurchaseRows) {
    const date = parseDateField(row.date);
    if (!date) continue;
    const prev = sbAttributedPurchasesDailyByDate.get(date) ?? {
      date,
      impressions: 0,
      clicks: 0,
      spend: 0,
      sales: 0,
      orders: 0,
      units: 0,
    };
    prev.impressions += num(row.impressions);
    prev.clicks += num(row.clicks);
    prev.spend += num(row.spend);
    prev.sales += num(row.sales);
    prev.orders += num(row.orders);
    prev.units += num(row.units);
    sbAttributedPurchasesDailyByDate.set(date, prev);
  }
  const sbAttributedPurchasesDaily = [...sbAttributedPurchasesDailyByDate.values()].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const sbAttributedPurchasesTotals = sbAttributedPurchasesDaily.reduce<{
    impressions: number;
    clicks: number;
    spend: number;
    sales: number;
    orders: number;
    units: number;
  }>(
    (totals, row) => {
      totals.impressions += row.impressions;
      totals.clicks += row.clicks;
      totals.spend += row.spend;
      totals.sales += row.sales;
      totals.orders += row.orders;
      totals.units += row.units;
      return totals;
    },
    { impressions: 0, clicks: 0, spend: 0, sales: 0, orders: 0, units: 0 }
  
  );

  // NOTE: SB Attributed Purchases report does not include spend in many exports.
  // We derive ASIN-level SB spend by allocating SB campaign spend to purchased ASIN
  // using attributed purchases (sales/orders/units) as weights (see sb_allocated_asin_spend_daily_v3).
  const sbAllocatedSpendRows = await loadRowsByDateChunks<SbAllocatedSpendRow>({
    label: "SB allocated spend rows",
    allChunksFailedSuffix:
      "SB allocated spend is incomplete/unknown for this window; totals may appear as 0.",
    runChunk: async (chunkStart, chunkEnd) => {
      const { data, error } = await supabaseAdmin
        .from("sb_allocated_asin_spend_daily_v3")
        .select("date,allocated_spend")
        .eq("account_id", env.accountId)
        .gte("date", chunkStart)
        .lte("date", chunkEnd)
        .eq("purchased_asin_norm", asin)
        .limit(200000);
      if (error) {
        throw new Error(error.message);
      }
      return (data ?? []) as SbAllocatedSpendRow[];
    },
  });

  const sbAllocatedSpendDailyByDate = new Map<string, { date: string; spend: number }>();
  for (const row of sbAllocatedSpendRows) {
    const date = parseDateField(row.date);
    if (!date) continue;
    const prev = sbAllocatedSpendDailyByDate.get(date) ?? { date, spend: 0 };
    prev.spend += num(row.allocated_spend);
    sbAllocatedSpendDailyByDate.set(date, prev);
  }
  const sbAllocatedSpendDaily = [...sbAllocatedSpendDailyByDate.values()].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const sbAllocatedSpendTotals = sbAllocatedSpendDaily.reduce<{ spend: number }>(
    (totals, row) => {
      totals.spend += row.spend;
      return totals;
    },
    { spend: 0 }
  );

  let sdCandidateCampaignIds: string[] = [];
  let sdCandidateAdGroupIds: string[] = [];
  const sdAdvertisedAsinRows = await loadRowsByDateChunks<Record<string, unknown>>({
    label: "SD advertised-product baseline rows",
    allChunksFailedSuffix:
      "SD advertised-product spend is incomplete/unknown for this window; totals may appear as 0.",
    runChunk: async (chunkStart, chunkEnd) => {
      const { data, error } = await supabaseAdmin
        .from("sd_advertised_product_daily_fact_latest")
        .select("date,campaign_id,ad_group_id,impressions,clicks,spend,sales,orders,units")
        .eq("account_id", env.accountId)
        .gte("date", chunkStart)
        .lte("date", chunkEnd)
        .eq("advertised_asin_norm", asin)
        .limit(50000);
      if (error) {
        throw new Error(error.message);
      }
      return (data ?? []) as Array<Record<string, unknown>>;
    },
  });
  sdCandidateCampaignIds = normalizeIds(sdAdvertisedAsinRows.map((row) => row.campaign_id));
  sdCandidateAdGroupIds = normalizeIds(sdAdvertisedAsinRows.map((row) => row.ad_group_id));
  const sdAdvertisedAsinTotals = sdAdvertisedAsinRows.reduce<{
    impressions: number;
    clicks: number;
    spend: number;
    sales: number;
    orders: number;
    units: number;
  }>(
    (totals, row) => {
      totals.impressions += num(row.impressions);
      totals.clicks += num(row.clicks);
      totals.spend += num(row.spend);
      totals.sales += num(row.sales);
      totals.orders += num(row.orders);
      totals.units += num(row.units);
      return totals;
    },
    { impressions: 0, clicks: 0, spend: 0, sales: 0, orders: 0, units: 0 }
  );

  const reconciliationDaily = buildAdsReconciliationDaily({
    siRows: (salesRows ?? []).map((row) => ({
      date: row.date as string | null,
      ppc_cost: row.ppc_cost as number | string | null,
    })),
    spRows: spAdvertisedAsinRows.map((row) => ({
      date: (row.date as string | null) ?? null,
      spend: row.spend as number | string | null,
    })),
    sbRows: sbAllocatedSpendDaily.map((row) => ({
      date: row.date ?? null,
      spend: row.spend,
    })),
    sdRows: sdAdvertisedAsinRows.map((row) => ({
      date: (row.date as string | null) ?? null,
      spend: row.spend as number | string | null,
    })),
    start: effectiveStart,
    end: effectiveEnd,
  });

  const loadCampaignReconciliationSpendRows = async (params: {
    channel: "sp" | "sb" | "sd";
    campaignIds: string[];
  }): Promise<Array<{ date: string | null; spend: number | string | null }>> => {
    if (params.campaignIds.length === 0) {
      if (params.channel === "sb") {
        addMessageOnce(
          "info",
          "NO_SB_FOR_ASIN",
          "No Sponsored Brands data for this ASIN in the selected range."
        );
      } else if (params.channel === "sd") {
        for (const message of buildNoChannelMessages({
          hasSbCampaignCandidates: true,
          hasSdCampaignCandidates: false,
        })) {
          addMessageOnce(message.level, message.code, message.text, message.meta);
        }
      } else {
        addMessage(
          "info",
          "NO_SP_FOR_ASIN",
          "No Sponsored Products candidate campaigns for this ASIN in the selected range; reconciliation SP spend set to 0."
        );
      }
      return [];
    }
    const label = `${params.channel.toUpperCase()} reconciliation rows`;
    return loadRowsByDateChunks<{ date: string | null; spend: number | string | null }>({
      label,
      incompleteCode: `RECONCILIATION_${params.channel.toUpperCase()}_INCOMPLETE`,
      allChunksFailedSuffix:
        `reconciliation ${params.channel.toUpperCase()} spend is incomplete/unknown for this window; values may appear as 0.`,
      diagnosticsKey: params.channel === "sp" ? "sp_reconciliation" : undefined,
      runChunk: async (chunkStart, chunkEnd) => {
        const sourceView =
          params.channel === "sp"
            ? "sp_campaign_daily_fact_latest_gold"
            : params.channel === "sb"
              ? "sb_campaign_daily_fact_latest_gold"
              : "sd_campaign_daily_fact_latest_gold";
        const { data, error } = await supabaseAdmin
          .from(sourceView)
          .select("date,spend")
          .eq("account_id", env.accountId)
          .in("campaign_id", params.campaignIds)
          .gte("date", chunkStart)
          .lte("date", chunkEnd)
          .limit(200000);
        if (error) {
          throw new Error(error.message);
        }
        return (data ?? []) as Array<{ date: string | null; spend: number | string | null }>;
      },
    });
  };

  const sbReconciliationAttributedRows = sbAllocatedSpendDaily.map((row) => ({
    date: row.date ?? null,
    spend: row.spend,
  }));
  if (sbReconciliationAttributedRows.length === 0) {
    if (sbCandidateCampaignIds.length > 0) {
      addMessage(
        "info",
        "SB_ALLOCATED_SPEND_EMPTY",
        `No SB allocated spend rows found for ASIN ${asin} in ${effectiveStart}..${effectiveEnd}; reconciliation SB spend set to 0.`
      );
    }
  }

  const [spReconciliationCampaignRows, sdReconciliationCampaignRows] = await Promise.all([
    loadCampaignReconciliationSpendRows({
      channel: "sp",
      campaignIds: spSelectionCampaignIds,
    }),
    loadCampaignReconciliationSpendRows({
      channel: "sd",
      campaignIds: sdCandidateCampaignIds,
    }),
  ]);
  if (spSelectionCampaignIds.length > 0 && spReconciliationCampaignRows.length === 0) {
    const hasUnderlyingFactRows = await hasSpCampaignFactRows(spSelectionCampaignIds);
    if (hasUnderlyingFactRows) {
      throw new PackIncompleteError(
        {
          label: "SP reconciliation rows",
          code: "GOLD_NOT_BACKFILLED",
          context: {
            reason: "gold_empty_with_underlying_facts",
            source_view: "sp_campaign_daily_fact_latest_gold",
            source_fact_table: "sp_campaign_hourly_fact",
            campaign_ids_count: spSelectionCampaignIds.length,
            start: effectiveStart,
            end: effectiveEnd,
          },
        },
        "GOLD_NOT_BACKFILLED: SP campaign gold cache is empty while underlying fact rows exist."
      );
    }
  }

  const reconciliationDailyCampaigns = buildAdsReconciliationDaily({
    siRows: (salesRows ?? []).map((row) => ({
      date: row.date as string | null,
      ppc_cost: row.ppc_cost as number | string | null,
    })),
    spRows: spReconciliationCampaignRows,
    sbRows: sbReconciliationAttributedRows,
    sdRows: sdReconciliationCampaignRows,
    start: effectiveStart,
    end: effectiveEnd,
  });

  const sbSpendTotalAccount = sbAllocatedSpendTotals.spend;

  let sdSpendTotalAccount = 0;
  const sdSpendRows = await loadRowsByDateChunks<Record<string, unknown>>({
    label: "SD spend total for attribution bridge",
    allChunksFailedSuffix:
      "SD spend total is incomplete/unknown for this window; attribution bridge values may appear as 0.",
    runChunk: async (chunkStart, chunkEnd) => {
      const { data, error } = await supabaseAdmin
        .from("sd_campaign_daily_fact_latest_gold")
        .select("spend")
        .eq("account_id", env.accountId)
        .gte("date", chunkStart)
        .lte("date", chunkEnd)
        .limit(50000);
      if (error) {
        throw new Error(error.message);
      }
      return (data ?? []) as Array<Record<string, unknown>>;
    },
  });
  sdSpendTotalAccount = sdSpendRows.reduce((total, row) => total + num(row.spend), 0);

  let spTargetFactRows: Array<Record<string, unknown>> = [];
  if (spSelectionProductAdLookup.adGroupIds.length > 0 || spSelectionCampaignIds.length > 0) {
    spTargetFactRows = await loadRowsByDateChunks<Record<string, unknown>>({
      label: "SP target baseline",
      allChunksFailedSuffix:
        "SP target baseline is incomplete/unknown for this window; mapped spend and coverage may appear as 0.",
      runChunk: async (chunkStart, chunkEnd) => {
        const baseQuery = supabaseAdmin
          .from("sp_targeting_daily_fact_latest")
          .select(
            "target_id,campaign_id,ad_group_id,campaign_name_raw,campaign_name_norm,targeting_raw,targeting_norm,match_type_norm,impressions,clicks,spend,sales,orders,units,top_of_search_impression_share"
          )
          .eq("account_id", env.accountId)
          .gte("date", chunkStart)
          .lte("date", chunkEnd)
          .limit(200000);
        const filteredQuery =
          spSelectionProductAdLookup.adGroupIds.length > 0
            ? baseQuery.in("ad_group_id", spSelectionProductAdLookup.adGroupIds)
            : baseQuery.in("campaign_id", spSelectionCampaignIds);
        const { data, error } = await filteredQuery;
        if (error) {
          throw new Error(error.message);
        }
        return (data ?? []) as Array<Record<string, unknown>>;
      },
    });
  }

  const spCampaignAgg = aggregateCampaignRows(
    spTargetFactRows as Array<
      MetricRow & { campaign_id: string; campaign_name_raw: string; campaign_name_norm: string }
    >
  );
  const spTargetAggAll = aggregateTargetRows(
    spTargetFactRows as Array<
      MetricRow & {
        target_id: string;
        campaign_id: string;
        targeting_raw: string;
        targeting_norm: string;
        match_type_norm: string | null;
      }
    >
  );
  const spMappedSpendTotal = sumSpSpend(
    spTargetFactRows as Array<{
      spend: number;
    }>
  );
  let spMappedCampaignSpendTotal = 0;
  if (spSelectionCampaignIds.length > 0) {
    const spCampaignRows = await loadRowsByDateChunks<Record<string, unknown>>({
      label: "SP mapped campaign spend total for attribution bridge",
      incompleteCode: "SP_MAPPED_CAMPAIGN_SPEND_INCOMPLETE",
      allChunksFailedSuffix:
        "SP mapped campaign spend is incomplete/unknown for this window; attribution bridge values may appear as 0.",
      runChunk: async (chunkStart, chunkEnd) => {
        const { data, error } = await supabaseAdmin
          .from("sp_campaign_daily_fact_latest_gold")
          .select("spend")
          .eq("account_id", env.accountId)
          .in("campaign_id", spSelectionCampaignIds)
          .gte("date", chunkStart)
          .lte("date", chunkEnd)
          .limit(200000);
        if (error) {
          throw new Error(error.message);
        }
        return (data ?? []) as Array<Record<string, unknown>>;
      },
    });
    if (spCampaignRows.length === 0) {
      const hasUnderlyingFactRows = await hasSpCampaignFactRows(spSelectionCampaignIds);
      if (hasUnderlyingFactRows) {
        throw new PackIncompleteError(
          {
            label: "SP mapped campaign spend total for attribution bridge",
            code: "GOLD_NOT_BACKFILLED",
            context: {
              reason: "gold_empty_with_underlying_facts",
              source_view: "sp_campaign_daily_fact_latest_gold",
              source_fact_table: "sp_campaign_hourly_fact",
              campaign_ids_count: spSelectionCampaignIds.length,
              start: effectiveStart,
              end: effectiveEnd,
            },
          },
          "GOLD_NOT_BACKFILLED: SP campaign gold cache is empty while underlying fact rows exist."
        );
      }
      addMessage(
        "info",
        "DATASET_EMPTY",
        `No SP campaign baseline rows in ${effectiveStart}..${effectiveEnd}; continuing.`
      );
    }
    spMappedCampaignSpendTotal = spCampaignRows.reduce((total, row) => total + num(row.spend), 0);
  }
  const ppcAttributionBridge = computePpcAttributionBridge({
    siPpcCostTotal,
    spAttributedSpendTotal: spMappedSpendTotal,
    spAdvertisedAsinSpendTotal: spAdvertisedAsinTotals.spend,
    spMappedCampaignSpendTotal,
    sbAttributedAsinSpendTotal: sbAllocatedSpendTotals.spend,
    sbSpendTotalUnattributed: sbSpendTotalAccount,
    sdSpendTotalUnattributed: sdSpendTotalAccount,
  });
  const spCoverageSelection = selectSpRowsForCoverage({
    mappedSpendTotal: spMappedSpendTotal,
    campaignRows: spCampaignAgg,
    targetRows: spTargetAggAll,
    campaignLimit: CAMPAIGN_LIMIT,
    targetLimit: SP_TARGET_LIMIT,
    coverageThreshold: SP_COVERAGE_THRESHOLD,
  });
  const spTopCampaigns = spCoverageSelection.campaigns;
  const spCampaignIds = spTopCampaigns.map((row) => row.campaign_id);
  const spTargetAgg = spCoverageSelection.targets;
  const spTargetTosIsByTargetId = new Map<string, number | null>();
  const spTosRowsByTarget = new Map<string, Array<{ impressions: number; share: number | null }>>();
  for (const row of spTargetFactRows) {
    const targetId = String(row.target_id ?? "").trim();
    if (!targetId) continue;
    const rows = spTosRowsByTarget.get(targetId) ?? [];
    rows.push({
      impressions: num(row.impressions),
      share: toFiniteNumberOrNull(row.top_of_search_impression_share),
    });
    spTosRowsByTarget.set(targetId, rows);
  }
  for (const [targetId, rows] of spTosRowsByTarget.entries()) {
    spTargetTosIsByTargetId.set(targetId, weightedAvgTosIs(rows));
  }

  let sbCampaignFactRows: Array<Record<string, unknown>> = [];
  if (sbCandidateCampaignIds.length > 0) {
    sbCampaignFactRows = await loadRowsByDateChunks<Record<string, unknown>>({
      label: "SB campaign baseline",
      allChunksFailedSuffix:
        "SB campaign baseline is incomplete/unknown for this window; campaign and target sections may appear as empty.",
      runChunk: async (chunkStart, chunkEnd) => {
        const { data, error } = await supabaseAdmin
          .from("sb_campaign_daily_fact_latest_gold")
          .select(
            "campaign_id,campaign_name_raw,campaign_name_norm,impressions,clicks,spend,sales,orders,units"
          )
          .eq("account_id", env.accountId)
          .in("campaign_id", sbCandidateCampaignIds)
          .gte("date", chunkStart)
          .lte("date", chunkEnd)
          .limit(50000);
        if (error) {
          throw new Error(error.message);
        }
        return (data ?? []) as Array<Record<string, unknown>>;
      },
    });
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
    const sbTargetRows = await loadRowsByDateChunks<Record<string, unknown>>({
      label: "SB target baseline",
      allChunksFailedSuffix:
        "SB target baseline is incomplete/unknown for this window; target metrics may appear as empty.",
      runChunk: async (chunkStart, chunkEnd) => {
        const { data, error } = await supabaseAdmin
          .from("sb_keyword_daily_fact_latest")
          .select(
            "target_id,campaign_id,targeting_raw,targeting_norm,match_type_norm,impressions,clicks,spend,sales,orders,units"
          )
          .eq("account_id", env.accountId)
          .gte("date", chunkStart)
          .lte("date", chunkEnd)
          .in("campaign_id", sbCampaignIds)
          .limit(50000);
        if (error) {
          throw new Error(error.message);
        }
        return (data ?? []) as Array<Record<string, unknown>>;
      },
    });
    sbTargetAgg = aggregateTargetRows(
      sbTargetRows as Array<
        MetricRow & {
          target_id: string;
          campaign_id: string;
          targeting_raw: string;
          targeting_norm: string;
          match_type_norm: string | null;
        }
      >
    ).slice(0, SB_TARGET_LIMIT);
  }

  let sdCampaignFactRows: Array<Record<string, unknown>> = [];
  if (sdCandidateCampaignIds.length > 0) {
    sdCampaignFactRows = await loadRowsByDateChunks<Record<string, unknown>>({
      label: "SD campaign baseline rows",
      allChunksFailedSuffix:
        "SD campaign baseline is incomplete/unknown for this window; campaign metrics may appear as empty.",
      runChunk: async (chunkStart, chunkEnd) => {
        const { data, error } = await supabaseAdmin
          .from("sd_campaign_daily_fact_latest_gold")
          .select("campaign_id,campaign_name_raw,campaign_name_norm,impressions,clicks,spend,sales,orders,units")
          .eq("account_id", env.accountId)
          .in("campaign_id", sdCandidateCampaignIds)
          .gte("date", chunkStart)
          .lte("date", chunkEnd)
          .limit(50000);
        if (error) {
          throw new Error(error.message);
        }
        return (data ?? []) as Array<Record<string, unknown>>;
      },
    });
  }
  const sdCampaignAgg = aggregateCampaignRows(
    sdCampaignFactRows as Array<
      MetricRow & { campaign_id: string; campaign_name_raw: string; campaign_name_norm: string }
    >
  );
  const sdTopCampaigns = sdCampaignAgg.slice(0, CAMPAIGN_LIMIT);
  const sdCampaignIds = sdTopCampaigns.map((row) => row.campaign_id);

  let sdTargetAgg: SdTargetAggregate[] = [];
  if (sdCampaignIds.length > 0) {
    const sdTargetRows = await loadRowsByDateChunks<Record<string, unknown>>({
      label: "SD target baseline rows",
      allChunksFailedSuffix:
        "SD target baseline is incomplete/unknown for this window; target metrics may appear as empty.",
      runChunk: async (chunkStart, chunkEnd) => {
        const { data, error } = await supabaseAdmin
          .from("sd_targeting_daily_fact_latest")
          .select(
            "target_key,target_id,campaign_id,ad_group_id,targeting_raw,targeting_norm,match_type_norm,impressions,clicks,spend,sales,orders,units"
          )
          .eq("account_id", env.accountId)
          .gte("date", chunkStart)
          .lte("date", chunkEnd)
          .in("campaign_id", sdCampaignIds)
          .limit(50000);
        if (error) {
          throw new Error(error.message);
        }
        return (data ?? []) as Array<Record<string, unknown>>;
      },
    });
    sdTargetAgg = aggregateSdTargetRows(
      sdTargetRows as Array<
        MetricRow & {
          target_key: string;
          target_id: string | null;
          campaign_id: string;
          ad_group_id: string;
          targeting_raw: string;
          targeting_norm: string;
          match_type_norm: string | null;
          units: number | string | null;
        }
      >
    ).slice(0, SD_TARGET_LIMIT);
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

  const buildPlacementModifierPctByKey = (
    channel: "sp" | "sb",
    rows: Array<Record<string, unknown>>
  ): Map<string, number | null> => {
    const byKey = new Map<string, number | null>();
    for (const row of rows) {
      const key = mapPlacementModifierKey(
        channel,
        String(row.placement_code ?? ""),
        channel === "sp" ? String(row.placement_raw ?? "") : String(row.placement_raw_norm ?? "")
      );
      if (!key) continue;
      byKey.set(key, toFiniteNumberOrNull(row.percentage));
    }
    return byKey;
  };

  const spPlacementModifiersByCampaign = new Map<string, Map<string, number | null>>();
  for (const [campaignId, rows] of spPlacementsByCampaign.entries()) {
    spPlacementModifiersByCampaign.set(campaignId, buildPlacementModifierPctByKey("sp", rows));
  }

  const sbPlacementModifiersByCampaign = new Map<string, Map<string, number | null>>();
  for (const [campaignId, rows] of sbPlacementsByCampaign.entries()) {
    sbPlacementModifiersByCampaign.set(campaignId, buildPlacementModifierPctByKey("sb", rows));
  }

  let spPlacementPerformanceRows: Array<Record<string, unknown>> = [];
  if (spCampaignIds.length > 0) {
    spPlacementPerformanceRows = await loadRowsByDateChunks<Record<string, unknown>>({
      label: "SP placement performance rows",
      allChunksFailedSuffix:
        "SP placement performance is incomplete/unknown for this window; placement metrics may appear as empty.",
      runChunk: async (chunkStart, chunkEnd) => {
        const { data, error } = await supabaseAdmin
          .from("ads_campaign_placement_daily_fact_latest")
          .select(
            "campaign_id,placement_code,placement_raw,placement_raw_norm,impressions,clicks,spend,sales,orders,units"
          )
          .eq("account_id", env.accountId)
          .eq("channel", "sp")
          .in("campaign_id", spCampaignIds)
          .gte("date", chunkStart)
          .lte("date", chunkEnd)
          .limit(50000);
        if (error) {
          throw new Error(error.message);
        }
        return (data ?? []) as Array<Record<string, unknown>>;
      },
    });
  }

  let sbPlacementPerformanceRows: Array<Record<string, unknown>> = [];
  if (sbCampaignIds.length > 0) {
    sbPlacementPerformanceRows = await loadRowsByDateChunks<Record<string, unknown>>({
      label: "SB placement performance rows",
      allChunksFailedSuffix:
        "SB placement performance is incomplete/unknown for this window; placement metrics may appear as empty.",
      runChunk: async (chunkStart, chunkEnd) => {
        const { data, error } = await supabaseAdmin
          .from("ads_campaign_placement_daily_fact_latest")
          .select(
            "campaign_id,placement_code,placement_raw,placement_raw_norm,impressions,clicks,spend,sales,orders,units"
          )
          .eq("account_id", env.accountId)
          .eq("channel", "sb")
          .in("campaign_id", sbCampaignIds)
          .gte("date", chunkStart)
          .lte("date", chunkEnd)
          .limit(50000);
        if (error) {
          throw new Error(error.message);
        }
        return (data ?? []) as Array<Record<string, unknown>>;
      },
    });
  }

  const spPlacementPerformanceByCampaign = new Map<string, PlacementAggregate[]>();
  for (const row of aggregatePlacementRows(
    spPlacementPerformanceRows as Array<
      MetricRow & {
        campaign_id: string;
        placement_code: string | null;
        placement_raw: string | null;
        placement_raw_norm: string | null;
        units: number | string | null;
      }
    >
  )) {
    const rows = spPlacementPerformanceByCampaign.get(row.campaign_id) ?? [];
    rows.push(row);
    spPlacementPerformanceByCampaign.set(row.campaign_id, rows);
  }

  const sbPlacementPerformanceByCampaign = new Map<string, PlacementAggregate[]>();
  for (const row of aggregatePlacementRows(
    sbPlacementPerformanceRows as Array<
      MetricRow & {
        campaign_id: string;
        placement_code: string | null;
        placement_raw: string | null;
        placement_raw_norm: string | null;
        units: number | string | null;
      }
    >
  )) {
    const rows = sbPlacementPerformanceByCampaign.get(row.campaign_id) ?? [];
    rows.push(row);
    sbPlacementPerformanceByCampaign.set(row.campaign_id, rows);
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

  const experimentIds = (experimentsRows ?? [])
    .map((row) => String(row.experiment_id ?? "").trim())
    .filter((value) => value.length > 0);
  const latestEvaluationByExperimentId = new Map<
    string,
    { experiment_id: string; evaluated_at: string; metrics_json: unknown | null }
  >();

  if (experimentIds.length > 0) {
    const { data: evaluationsRows, error: evaluationsError } = await supabaseAdmin
      .from("log_evaluations")
      .select("experiment_id,evaluated_at,metrics_json")
      .eq("account_id", env.accountId)
      .eq("marketplace", env.marketplace)
      .in("experiment_id", experimentIds)
      .order("evaluated_at", { ascending: false })
      .limit(5000);

    if (evaluationsError) {
      return new Response(`Failed loading experiment evaluations: ${evaluationsError.message}`, {
        status: 500,
      });
    }

    for (const row of evaluationsRows ?? []) {
      const experimentId = String(row.experiment_id ?? "").trim();
      if (!experimentId || latestEvaluationByExperimentId.has(experimentId)) continue;
      latestEvaluationByExperimentId.set(experimentId, {
        experiment_id: experimentId,
        evaluated_at: String(row.evaluated_at ?? ""),
        metrics_json: row.metrics_json ?? null,
      });
    }
  }

  const sdCampaignTotals = sdCampaignFactRows.reduce<{
    impressions: number;
    clicks: number;
    spend: number;
    sales: number;
    orders: number;
    units: number;
  }>(
    (totals, row) => {
      totals.impressions += num(row.impressions);
      totals.clicks += num(row.clicks);
      totals.spend += num(row.spend);
      totals.sales += num(row.sales);
      totals.orders += num(row.orders);
      totals.units += num(row.units);
      return totals;
    },
    { impressions: 0, clicks: 0, spend: 0, sales: 0, orders: 0, units: 0 }
  );

  const formatPlacementPerformance = (
    channel: "sp" | "sb",
    rows: PlacementAggregate[],
    modifierByKey: Map<string, number | null>
  ) =>
    rows.map((row) => {
      const modifierKey = mapPlacementModifierKey(channel, row.placement_code, row.placement_raw_norm);
      return {
        placement_code: row.placement_code,
        placement_raw: row.placement_raw,
        placement_raw_norm: row.placement_raw_norm,
        modifier_pct_current: modifierKey ? (modifierByKey.get(modifierKey) ?? null) : null,
        spend: row.spend,
        sales: row.sales,
        orders: row.orders,
        units: row.units,
        clicks: row.clicks,
        impressions: row.impressions,
        acos: formatPct(calcAcos(row.spend, row.sales)),
        roas: calcRoas(row.spend, row.sales),
        cpc: calcCpc(row.spend, row.clicks),
        ctr: formatPct(calcCtr(row.clicks, row.impressions)),
        cvr: formatPct(calcCvrOrdersPerClick(row.orders, row.clicks)),
      };
    });

  const spCampaignRowsForOutput = spTopCampaigns.map((row) => {
    const placementPerformance = formatPlacementPerformance(
      "sp",
      spPlacementPerformanceByCampaign.get(row.campaign_id) ?? [],
      spPlacementModifiersByCampaign.get(row.campaign_id) ?? new Map<string, number | null>()
    );
    const placementSalesTotal = placementPerformance.reduce(
      (sum, placementRow) => sum + num(placementRow.sales),
      0
    );
    const isPlacementSalesMissing = row.sales > 0 && placementSalesTotal === 0;

    if (isPlacementSalesMissing) {
      addMessage(
        "warn",
        "SP_PLACEMENT_SALES_MISSING",
        "SP placement report sales/orders appear missing (placement sales=0 while campaign sales>0). Do NOT treat placement sales=0 as waste; fix placement ingestion or reingest placement reports.",
        {
          campaign_id: row.campaign_id,
          campaign_name_norm: row.campaign_name_norm,
          campaign_sales: row.sales,
          placement_sales_total: placementSalesTotal,
        }
      );
    }

    return {
      campaign_id: row.campaign_id,
      campaign_name_raw: row.campaign_name_raw,
      campaign_name_norm: row.campaign_name_norm,
      impressions: row.impressions,
      units: row.units,
      spend: row.spend,
      sales: row.sales,
      orders: row.orders,
      clicks: row.clicks,
      ctr: formatPct(calcCtr(row.clicks, row.impressions)),
      cvr: formatPct(calcCvrOrdersPerClick(row.orders, row.clicks)),
      acos: formatPct(calcAcos(row.spend, row.sales)),
      roas: calcRoas(row.spend, row.sales),
      cpc: calcCpc(row.spend, row.clicks),
      current_bulk: spBulkCampaignById.get(row.campaign_id) ?? null,
      placement_modifiers: spPlacementsByCampaign.get(row.campaign_id) ?? [],
      placement_sales_attribution_status: isPlacementSalesMissing ? "missing" : "ok",
      placement_performance: isPlacementSalesMissing
        ? placementPerformance.map((placementRow) => ({
            ...placementRow,
            sales: null,
            orders: null,
            units: null,
            acos: null,
            roas: null,
            cvr: null,
          }))
        : placementPerformance,
    };
  });

  const warnings = legacyWarningsFromMessages(messages);
  const resolvedProductSkills = resolveSkillsByIds(profileContext.skills);
  const stisBasePath = `/products/${encodeURIComponent(asin)}/logbook/ai-data-pack-v3/stis`;
  const buildStisDownloadUrl = (channel: "sp" | "sb") =>
    `${stisBasePath}?channel=${channel}&start=${effectiveStart}&end=${effectiveEnd}&scope=included`;

  const outputBase = {
    kind: "aph_product_baseline_data_pack_v3",
    generated_at: new Date().toISOString(),
    account_id: env.accountId,
    marketplace: env.marketplace,
    meta: {
      fetch_diagnostics: fetchDiagnostics,
    },
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
      messages,
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
      short_name: profileContext.short_name,
      notes: profileContext.notes,
      intent: profileContext.intent,
      driver_campaign_intents: driverCampaignIntents,
      kiv_backlog: kivBacklog,
      skills: {
        ids: profileContext.skills,
        resolved: resolvedProductSkills,
      },
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
      notes: {
        attribution_model:
          "Scale Insights ppc_cost is an attributed cost to the ASIN (based on conversion attribution windows). It may be >0 on days where advertised-ASIN spend is 0, and may be < advertised spend on days where ads spend did not attribute purchases to this ASIN.",
        sb_attributed_purchases_model:
          "Sponsored Brands Attributed Purchases is attributed to the purchased ASIN (based on Amazon attribution windows). It is not the same as advertised-ASIN spend.",
      },
      latest_bulk_snapshot_date: latestSnapshotDate,
      sp: {
        product_ads_snapshot_date: spSelectionProductAdLookup.snapshotDate,
        stis: {
          export: {
            start: effectiveStart,
            end: effectiveEnd,
            download_url: buildStisDownloadUrl("sp"),
          },
        },
        advertised_product: {
          daily: spAdvertisedAsinDaily.map((row) => ({
            date: row.date,
            impressions: row.impressions,
            clicks: row.clicks,
            spend: row.spend,
            sales: row.sales,
            orders: row.orders,
            units: row.units,
          })),
          totals: {
            impressions: spAdvertisedAsinTotals.impressions,
            clicks: spAdvertisedAsinTotals.clicks,
            spend: spAdvertisedAsinTotals.spend,
            sales: spAdvertisedAsinTotals.sales,
            orders: spAdvertisedAsinTotals.orders,
            units: spAdvertisedAsinTotals.units,
          },
        },
        totals: {
          mapped_campaign_count: spCampaignAgg.length,
          mapped_target_count: spTargetAggAll.length,
          included_campaign_count: spTopCampaigns.length,
          included_target_count: spTargetAgg.length,
          mapped_spend_total: spMappedSpendTotal,
          included_campaign_spend_total: spCoverageSelection.campaignIncludedSpend,
          included_target_spend_total: spCoverageSelection.targetIncludedSpend,
        },
        coverage: {
          mapped_spend_total: spMappedSpendTotal,
          included_spend_total: spCoverageSelection.includedSpendTotal,
          coverage_pct: formatPct(spCoverageSelection.coveragePct),
        },
        campaigns: spCampaignRowsForOutput,
        targets: spTargetAgg.map((row) => ({
          target_id: row.target_id,
          campaign_id: row.campaign_id,
          targeting_raw: row.targeting_raw,
          targeting_norm: row.targeting_norm,
          match_type_norm: row.match_type_norm,
          impressions: row.impressions,
          units: row.units,
          spend: row.spend,
          sales: row.sales,
          orders: row.orders,
          clicks: row.clicks,
          ctr: formatPct(calcCtr(row.clicks, row.impressions)),
          cvr: formatPct(calcCvrOrdersPerClick(row.orders, row.clicks)),
          acos: formatPct(calcAcos(row.spend, row.sales)),
          roas: calcRoas(row.spend, row.sales),
          cpc: calcCpc(row.spend, row.clicks),
          top_of_search_impression_share: formatPct(
            spTargetTosIsByTargetId.get(row.target_id) ?? null
          ),
          current_bulk: spBulkTargetById.get(row.target_id) ?? null,
        })),
      },
      sb: {
        stis: {
          export: {
            start: effectiveStart,
            end: effectiveEnd,
            download_url: buildStisDownloadUrl("sb"),
          },
        },
        attributed_purchases: {
          campaign_count: sbAttributedPurchaseCampaignIds.length,
          daily: sbAttributedPurchasesDaily,
          totals: sbAttributedPurchasesTotals,
        },
        campaigns: sbTopCampaigns.map((row) => ({
          campaign_id: row.campaign_id,
          campaign_name_raw: row.campaign_name_raw,
          campaign_name_norm: row.campaign_name_norm,
          impressions: row.impressions,
          units: row.units,
          spend: row.spend,
          sales: row.sales,
          orders: row.orders,
          clicks: row.clicks,
          ctr: formatPct(calcCtr(row.clicks, row.impressions)),
          cvr: formatPct(calcCvrOrdersPerClick(row.orders, row.clicks)),
          acos: formatPct(calcAcos(row.spend, row.sales)),
          roas: calcRoas(row.spend, row.sales),
          cpc: calcCpc(row.spend, row.clicks),
          current_bulk: sbBulkCampaignById.get(row.campaign_id) ?? null,
          placement_modifiers: sbPlacementsByCampaign.get(row.campaign_id) ?? [],
          placement_performance: formatPlacementPerformance(
            "sb",
            sbPlacementPerformanceByCampaign.get(row.campaign_id) ?? [],
            sbPlacementModifiersByCampaign.get(row.campaign_id) ?? new Map<string, number | null>()
          ),
        })),
        targets: sbTargetAgg.map((row) => ({
          target_id: row.target_id,
          campaign_id: row.campaign_id,
          targeting_raw: row.targeting_raw,
          targeting_norm: row.targeting_norm,
          match_type_norm: row.match_type_norm,
          impressions: row.impressions,
          units: row.units,
          spend: row.spend,
          sales: row.sales,
          orders: row.orders,
          clicks: row.clicks,
          ctr: formatPct(calcCtr(row.clicks, row.impressions)),
          cvr: formatPct(calcCvrOrdersPerClick(row.orders, row.clicks)),
          acos: formatPct(calcAcos(row.spend, row.sales)),
          roas: calcRoas(row.spend, row.sales),
          cpc: calcCpc(row.spend, row.clicks),
          current_bulk: sbBulkTargetById.get(row.target_id) ?? null,
        })),
      },
      sd: {
        totals: {
          candidate_campaign_count: sdCandidateCampaignIds.length,
          candidate_ad_group_count: sdCandidateAdGroupIds.length,
          campaign_count: sdCampaignAgg.length,
          included_campaign_count: sdTopCampaigns.length,
          target_count: sdTargetAgg.length,
          spend_total: sdCampaignTotals.spend,
          sales_total: sdCampaignTotals.sales,
          orders_total: sdCampaignTotals.orders,
          clicks_total: sdCampaignTotals.clicks,
          impressions_total: sdCampaignTotals.impressions,
          units_total: sdCampaignTotals.units,
        },
        campaigns: sdTopCampaigns.map((row) => ({
          campaign_id: row.campaign_id,
          campaign_name_raw: row.campaign_name_raw,
          campaign_name_norm: row.campaign_name_norm,
          spend: row.spend,
          sales: row.sales,
          orders: row.orders,
          clicks: row.clicks,
          impressions: row.impressions,
          acos: formatPct(calcAcos(row.spend, row.sales)),
          roas: calcRoas(row.spend, row.sales),
          cpc: calcCpc(row.spend, row.clicks),
          ctr: formatPct(calcCtr(row.clicks, row.impressions)),
        })),
        targets: sdTargetAgg.map((row) => ({
          target_key: row.target_key,
          target_id: row.target_id,
          campaign_id: row.campaign_id,
          ad_group_id: row.ad_group_id,
          targeting_raw: row.targeting_raw,
          targeting_norm: row.targeting_norm,
          match_type_norm: row.match_type_norm,
          spend: row.spend,
          sales: row.sales,
          orders: row.orders,
          units: row.units,
          clicks: row.clicks,
          impressions: row.impressions,
          acos: formatPct(calcAcos(row.spend, row.sales)),
          roas: calcRoas(row.spend, row.sales),
          cpc: calcCpc(row.spend, row.clicks),
          ctr: formatPct(calcCtr(row.clicks, row.impressions)),
        })),
        advertised_product: {
          campaign_count: sdCandidateCampaignIds.length,
          ad_group_count: sdCandidateAdGroupIds.length,
          impressions: sdAdvertisedAsinTotals.impressions,
          clicks: sdAdvertisedAsinTotals.clicks,
          spend: sdAdvertisedAsinTotals.spend,
          sales: sdAdvertisedAsinTotals.sales,
          orders: sdAdvertisedAsinTotals.orders,
          units: sdAdvertisedAsinTotals.units,
          acos: formatPct(calcAcos(sdAdvertisedAsinTotals.spend, sdAdvertisedAsinTotals.sales)),
          roas: calcRoas(sdAdvertisedAsinTotals.spend, sdAdvertisedAsinTotals.sales),
          cpc: calcCpc(sdAdvertisedAsinTotals.spend, sdAdvertisedAsinTotals.clicks),
          ctr: formatPct(calcCtr(sdAdvertisedAsinTotals.clicks, sdAdvertisedAsinTotals.impressions)),
        },
      },
      reconciliation_daily: reconciliationDaily,
      reconciliation_daily_campaigns: reconciliationDailyCampaigns,
      ppc_attribution_bridge: {
        ...ppcAttributionBridge,
        si_ppc_cost_attributed_total: ppcAttributionBridge.si_ppc_cost_total,
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
      const latestEvaluation = latestEvaluationByExperimentId.get(String(row.experiment_id));
      return {
        experiment_id: row.experiment_id,
        name: row.name,
        status: (scope.status as string | undefined) ?? "planned",
        created_at: row.created_at,
        latest_evaluated_at: latestEvaluation?.evaluated_at ?? null,
        latest_outcome: extractEvaluationOutcome(latestEvaluation?.metrics_json ?? null),
      };
    }),
  };
  const output = {
    ...outputBase,
    computed_summary: computeBaselineSummary(outputBase),
  };

  const filename = `${sanitizeFileSegment(asin)}_product_baseline_data_pack_v3.json`;
  return new Response(`${JSON.stringify(output, null, 2)}\n`, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
  } catch (error) {
    if (error instanceof PackIncompleteError) {
      return buildPackIncompleteResponse({
        error,
        messages: packMessages,
        fetchDiagnostics,
      });
    }
    const message =
      error instanceof Error ? error.message : "Failed generating product baseline data pack.";
    return new Response(message, { status: 500 });
  }
}
