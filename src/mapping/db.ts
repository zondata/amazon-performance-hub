import { getSupabaseClient } from "../db/supabaseClient";
import { chunkArray } from "../ingest/utils";
import { upsertImportSourceStatus } from "../importStatus/db";
import {
  BulkLookup,
  ManualOverrideRow,
  NameHistoryRow,
  normalizeMatchType,
  pickBulkSnapshotFromList,
} from "./core";
import {
  mapSpCampaignRows,
  mapSpPlacementRows,
  mapSpAdvertisedProductRows,
  mapSpTargetingRows,
  mapSpStisRows,
  SpStisAutoTargetBridge,
  SpAdvertisedProductRawRow,
  SpCampaignRawRow,
  SpPlacementRawRow,
  SpTargetingRawRow,
  SpStisRawRow,
} from "./mappers";

const FETCH_LIMIT = 1000;
const SP_AUTO_TARGETING_NORMS = ["close-match", "loose-match", "substitutes", "complements"] as const;

type UploadRow = {
  upload_id: string;
  account_id: string;
  source_type: string;
  original_filename: string | null;
  exported_at: string | null;
  coverage_start: string | null;
  coverage_end: string | null;
};

function extractDate(iso: string | null): string | null {
  if (!iso) return null;
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

async function tableExists(tableName: string): Promise<boolean> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("information_schema.tables")
    .select("table_name")
    .eq("table_schema", "public")
    .eq("table_name", tableName)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

async function fetchAllRows<T>(table: string, select: string, filters: Record<string, string>) {
  const client = getSupabaseClient();
  let offset = 0;
  const rows: T[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let query = client.from(table).select(select).range(offset, offset + FETCH_LIMIT - 1);
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }
    const { data, error } = await query;
    if (error) throw new Error(`Failed fetching ${table}: ${error.message}`);
    const chunk = (data ?? []) as T[];
    rows.push(...chunk);
    if (chunk.length < FETCH_LIMIT) break;
    offset += FETCH_LIMIT;
  }
  return rows;
}

function dateToUtcMs(dateIso: string): number {
  const [y, m, d] = dateIso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export async function pickBulkSnapshotForExport(accountId: string, exportedAtDate: string) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("uploads")
    .select("snapshot_date")
    .eq("account_id", accountId)
    .eq("source_type", "bulk")
    .not("snapshot_date", "is", null);
  if (error) throw new Error(`Failed fetching bulk uploads: ${error.message}`);
  const snapshotDates = (data ?? [])
    .map((row) => row.snapshot_date as string)
    .filter(Boolean);
  return pickBulkSnapshotFromList(exportedAtDate, snapshotDates);
}

function getRawTableForReportType(
  reportType:
    | "sp_campaign"
    | "sp_placement"
    | "sp_targeting"
    | "sp_stis"
    | "sp_advertised_product"
) {
  if (reportType === "sp_campaign") return "sp_campaign_daily_raw";
  if (reportType === "sp_placement") return "sp_placement_daily_raw";
  if (reportType === "sp_targeting") return "sp_targeting_daily_raw";
  if (reportType === "sp_advertised_product") return "sp_advertised_product_daily_fact";
  return "sp_stis_daily_raw";
}

async function fetchDistinctCampaignNameNorms(
  params: {
    reportType:
      | "sp_campaign"
      | "sp_placement"
      | "sp_targeting"
      | "sp_stis"
      | "sp_advertised_product";
    uploadId: string;
    accountId: string;
    exportedAt: string;
  }
): Promise<string[]> {
  const table = getRawTableForReportType(params.reportType);
  const rows = await fetchAllRows<{ campaign_name_norm: string }>(
    table,
    "campaign_name_norm",
    params.reportType === "sp_advertised_product"
      ? {
          account_id: params.accountId,
          exported_at: params.exportedAt,
        }
      : { upload_id: params.uploadId }
  );
  const set = new Set<string>();
  for (const row of rows) {
    const norm = row.campaign_name_norm?.trim();
    if (norm) set.add(norm);
  }
  return [...set];
}

async function fetchCandidateSnapshotDates(accountId: string, exportedAtDate: string): Promise<string[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("uploads")
    .select("snapshot_date")
    .eq("account_id", accountId)
    .eq("source_type", "bulk")
    .not("snapshot_date", "is", null);
  if (error) throw new Error(`Failed fetching bulk uploads: ${error.message}`);
  const snapshotDates = (data ?? [])
    .map((row) => row.snapshot_date as string)
    .filter(Boolean);

  const exportedMs = dateToUtcMs(exportedAtDate);
  const maxAfterMs = 7 * 24 * 60 * 60 * 1000;
  return snapshotDates.filter((date) => {
    if (date <= exportedAtDate) return true;
    const diff = dateToUtcMs(date) - exportedMs;
    return diff > 0 && diff <= maxAfterMs;
  });
}

async function countBulkCampaignNameMatches(
  accountId: string,
  snapshotDate: string,
  campaignNameNorms: string[]
): Promise<number> {
  if (!campaignNameNorms.length) return 0;
  const client = getSupabaseClient();
  const matched = new Set<string>();
  for (const chunk of chunkArray(campaignNameNorms, 500)) {
    const { data, error } = await client
      .from("bulk_campaigns")
      .select("campaign_name_norm")
      .eq("account_id", accountId)
      .eq("snapshot_date", snapshotDate)
      .in("campaign_name_norm", chunk);
    if (error) throw new Error(`Failed fetching bulk_campaigns matches: ${error.message}`);
    for (const row of data ?? []) {
      const norm = (row as { campaign_name_norm: string }).campaign_name_norm;
      if (norm) matched.add(norm);
    }
  }
  return matched.size;
}

async function pickBestBulkSnapshotForUpload(params: {
  accountId: string;
  uploadId: string;
  reportType:
    | "sp_campaign"
    | "sp_placement"
    | "sp_targeting"
    | "sp_stis"
    | "sp_advertised_product";
  exportedAtDate: string;
  exportedAt: string;
}): Promise<string | null> {
  const { accountId, uploadId, reportType, exportedAtDate, exportedAt } = params;
  const campaignNames = await fetchDistinctCampaignNameNorms({
    reportType,
    uploadId,
    accountId,
    exportedAt,
  });
  if (!campaignNames.length) {
    return pickBulkSnapshotForExport(accountId, exportedAtDate);
  }

  const candidateDates = await fetchCandidateSnapshotDates(accountId, exportedAtDate);
  if (!candidateDates.length) return null;

  const exportedMs = dateToUtcMs(exportedAtDate);
  let best: { snapshotDate: string; score: number; diffMs: number; isBefore: boolean } | null = null;
  for (const snapshotDate of candidateDates) {
    const score = await countBulkCampaignNameMatches(accountId, snapshotDate, campaignNames);
    const snapshotMs = dateToUtcMs(snapshotDate);
    const diffMs = Math.abs(snapshotMs - exportedMs);
    const isBefore = snapshotDate <= exportedAtDate;
    if (!best) {
      best = { snapshotDate, score, diffMs, isBefore };
      continue;
    }
    if (score > best.score) {
      best = { snapshotDate, score, diffMs, isBefore };
      continue;
    }
    if (score === best.score) {
      if (diffMs < best.diffMs) {
        best = { snapshotDate, score, diffMs, isBefore };
        continue;
      }
      if (diffMs === best.diffMs && isBefore && !best.isBefore) {
        best = { snapshotDate, score, diffMs, isBefore };
      }
    }
  }
  return best?.snapshotDate ?? null;
}

export async function loadBulkLookup(accountId: string, snapshotDate: string): Promise<BulkLookup> {
  const [campaigns, adGroups, targets, portfolios, overrides, categoryMap] = await Promise.all([
    fetchAllRows<{
      campaign_id: string;
      campaign_name_norm: string;
      portfolio_id: string | null;
    }>("bulk_campaigns", "campaign_id,campaign_name_norm,portfolio_id", {
      account_id: accountId,
      snapshot_date: snapshotDate,
    }),
    fetchAllRows<{
      ad_group_id: string;
      campaign_id: string;
      ad_group_name_norm: string;
    }>("bulk_ad_groups", "ad_group_id,campaign_id,ad_group_name_norm", {
      account_id: accountId,
      snapshot_date: snapshotDate,
    }),
    fetchAllRows<{
      target_id: string;
      ad_group_id: string;
      expression_norm: string;
      match_type: string;
      is_negative: boolean;
    }>("bulk_targets", "target_id,ad_group_id,expression_norm,match_type,is_negative", {
      account_id: accountId,
      snapshot_date: snapshotDate,
    }),
    fetchAllRows<{
      portfolio_id: string;
      portfolio_name_norm: string;
    }>("bulk_portfolios", "portfolio_id,portfolio_name_norm", {
      account_id: accountId,
      snapshot_date: snapshotDate,
    }),
    fetchAllRows<{
      entity_level: string;
      entity_id: string;
      name_norm: string;
      valid_from: string | null;
      valid_to: string | null;
    }>("sp_manual_name_overrides", "entity_level,entity_id,name_norm,valid_from,valid_to", {
      account_id: accountId,
    }),
    fetchAllRows<{
      category_name_norm: string;
      category_id: string;
    }>("sp_category_id_map", "category_name_norm,category_id", {
      account_id: accountId,
    }),
  ]);

  const campaignByName = new Map<string, { campaign_id: string; portfolio_id: string | null }[]>();
  const campaignById = new Map<string, { campaign_id: string; portfolio_id: string | null }>();
  for (const row of campaigns) {
    if (!campaignByName.has(row.campaign_name_norm)) {
      campaignByName.set(row.campaign_name_norm, []);
    }
    campaignByName.get(row.campaign_name_norm)?.push({
      campaign_id: row.campaign_id,
      portfolio_id: row.portfolio_id ?? null,
    });
    campaignById.set(row.campaign_id, {
      campaign_id: row.campaign_id,
      portfolio_id: row.portfolio_id ?? null,
    });
  }

  const adGroupByCampaignName = new Map<string, { ad_group_id: string; campaign_id: string }[]>();
  const adGroupById = new Map<string, { ad_group_id: string; campaign_id: string }>();
  for (const row of adGroups) {
    const key = `${row.campaign_id}::${row.ad_group_name_norm}`;
    if (!adGroupByCampaignName.has(key)) adGroupByCampaignName.set(key, []);
    adGroupByCampaignName.get(key)?.push({ ad_group_id: row.ad_group_id, campaign_id: row.campaign_id });
    adGroupById.set(row.ad_group_id, { ad_group_id: row.ad_group_id, campaign_id: row.campaign_id });
  }

  const targetByAdGroupKey = new Map<string, { target_id: string; ad_group_id: string; match_type_norm: string; is_negative: boolean }[]>();
  const targetById = new Map<string, { target_id: string; ad_group_id: string; match_type_norm: string; is_negative: boolean }>();
  for (const row of targets) {
    const matchTypeNorm = normalizeMatchType(row.match_type);
    const key = `${row.ad_group_id}::${row.expression_norm}::${matchTypeNorm}::${row.is_negative ? "1" : "0"}`;
    if (!targetByAdGroupKey.has(key)) targetByAdGroupKey.set(key, []);
    targetByAdGroupKey.get(key)?.push({
      target_id: row.target_id,
      ad_group_id: row.ad_group_id,
      match_type_norm: matchTypeNorm,
      is_negative: row.is_negative,
    });
    targetById.set(row.target_id, {
      target_id: row.target_id,
      ad_group_id: row.ad_group_id,
      match_type_norm: matchTypeNorm,
      is_negative: row.is_negative,
    });
  }

  const portfolioByName = new Map<string, string[]>();
  for (const row of portfolios) {
    if (!portfolioByName.has(row.portfolio_name_norm)) portfolioByName.set(row.portfolio_name_norm, []);
    portfolioByName.get(row.portfolio_name_norm)?.push(row.portfolio_id);
  }

  const overridesByName = new Map<string, ManualOverrideRow[]>();
  for (const row of overrides) {
    const key = `${row.entity_level}::${row.name_norm}`;
    if (!overridesByName.has(key)) overridesByName.set(key, []);
    overridesByName.get(key)?.push({
      entity_id: row.entity_id,
      name_norm: row.name_norm,
      valid_from: row.valid_from,
      valid_to: row.valid_to,
    });
  }

  const categoryIdByNameNorm = new Map<string, string>();
  for (const row of categoryMap) {
    if (!categoryIdByNameNorm.has(row.category_name_norm)) {
      categoryIdByNameNorm.set(row.category_name_norm, row.category_id);
    }
  }

  const campaignHistoryByName = new Map<string, NameHistoryRow[]>();
  if (await tableExists("campaign_name_history")) {
    const historyRows = await fetchAllRows<{
      campaign_id: string;
      name_norm: string;
      valid_from: string;
      valid_to: string | null;
    }>("campaign_name_history", "campaign_id,name_norm,valid_from,valid_to", {
      account_id: accountId,
    });
    for (const row of historyRows) {
      if (!campaignHistoryByName.has(row.name_norm)) campaignHistoryByName.set(row.name_norm, []);
      campaignHistoryByName.get(row.name_norm)?.push({
        entity_id: row.campaign_id,
        name_norm: row.name_norm,
        valid_from: row.valid_from,
        valid_to: row.valid_to,
      });
    }
  }

  const adGroupHistoryByName = new Map<string, NameHistoryRow[]>();
  if (await tableExists("ad_group_name_history")) {
    const historyRows = await fetchAllRows<{
      ad_group_id: string;
      campaign_id: string;
      name_norm: string;
      valid_from: string;
      valid_to: string | null;
    }>("ad_group_name_history", "ad_group_id,campaign_id,name_norm,valid_from,valid_to", {
      account_id: accountId,
    });
    for (const row of historyRows) {
      const key = `${row.campaign_id}::${row.name_norm}`;
      if (!adGroupHistoryByName.has(key)) adGroupHistoryByName.set(key, []);
      adGroupHistoryByName.get(key)?.push({
        entity_id: row.ad_group_id,
        name_norm: row.name_norm,
        valid_from: row.valid_from,
        valid_to: row.valid_to,
        campaign_id: row.campaign_id,
      });
    }
  }

  return {
    campaignByName,
    campaignById,
    adGroupByCampaignName,
    adGroupById,
    targetByAdGroupKey,
    targetById,
    portfolioByName,
    campaignHistoryByName,
    adGroupHistoryByName,
    overridesByName,
    categoryIdByNameNorm,
  } satisfies BulkLookup;
}

async function fetchUpload(uploadId: string): Promise<UploadRow> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("uploads")
    .select("upload_id,account_id,source_type,original_filename,exported_at,coverage_start,coverage_end")
    .eq("upload_id", uploadId)
    .single();
  if (error) throw new Error(`Failed fetching upload: ${error.message}`);
  return data as UploadRow;
}

async function persistMapStatus(params: {
  upload: UploadRow;
  reportType:
    | "sp_campaign"
    | "sp_placement"
    | "sp_targeting"
    | "sp_stis"
    | "sp_advertised_product";
  mapStatus: "ok" | "missing_snapshot" | "error";
  factRows?: number | null;
  issueRows?: number | null;
  message?: string | null;
}) {
  await upsertImportSourceStatus({
    account_id: params.upload.account_id,
    source_type: params.reportType,
    last_original_filename: params.upload.original_filename,
    last_upload_id: params.upload.upload_id,
    map_status: params.mapStatus,
    map_fact_rows: params.factRows ?? null,
    map_issue_rows: params.issueRows ?? null,
    map_message: params.message ?? null,
  });
}

type AdvertisedProductBatchRow = SpAdvertisedProductRawRow & {
  exported_at: string;
};

type AdvertisedProductBatchCandidate = {
  exportedAt: string;
  minDate: string;
  maxDate: string;
  rowCount: number;
};

function dayDiffAbs(left: string, right: string): number {
  return Math.abs(dateToUtcMs(left) - dateToUtcMs(right));
}

function timestampDiffAbs(left: string, right: string): number {
  return Math.abs(Date.parse(left) - Date.parse(right));
}

export function pickAdvertisedProductBatchCandidate(params: {
  uploadExportedAt: string;
  coverageStart: string | null;
  coverageEnd: string | null;
  candidates: AdvertisedProductBatchCandidate[];
}): AdvertisedProductBatchCandidate | null {
  const { uploadExportedAt, coverageStart, coverageEnd, candidates } = params;
  if (!candidates.length) return null;

  const uploadExportedDate = extractDate(uploadExportedAt);
  if (!uploadExportedDate) return candidates[0] ?? null;

  const sorted = [...candidates].sort((left, right) => {
    const leftExactCoverage =
      coverageStart !== null &&
      coverageEnd !== null &&
      left.minDate === coverageStart &&
      left.maxDate === coverageEnd;
    const rightExactCoverage =
      coverageStart !== null &&
      coverageEnd !== null &&
      right.minDate === coverageStart &&
      right.maxDate === coverageEnd;
    if (leftExactCoverage !== rightExactCoverage) {
      return leftExactCoverage ? -1 : 1;
    }

    const leftSameExportedDate = extractDate(left.exportedAt) === uploadExportedDate;
    const rightSameExportedDate = extractDate(right.exportedAt) === uploadExportedDate;
    if (leftSameExportedDate !== rightSameExportedDate) {
      return leftSameExportedDate ? -1 : 1;
    }

    const leftCoverageDistance =
      coverageStart !== null && coverageEnd !== null
        ? dayDiffAbs(left.minDate, coverageStart) + dayDiffAbs(left.maxDate, coverageEnd)
        : 0;
    const rightCoverageDistance =
      coverageStart !== null && coverageEnd !== null
        ? dayDiffAbs(right.minDate, coverageStart) + dayDiffAbs(right.maxDate, coverageEnd)
        : 0;
    if (leftCoverageDistance !== rightCoverageDistance) {
      return leftCoverageDistance - rightCoverageDistance;
    }

    if (left.rowCount !== right.rowCount) {
      return right.rowCount - left.rowCount;
    }

    return timestampDiffAbs(left.exportedAt, uploadExportedAt) - timestampDiffAbs(right.exportedAt, uploadExportedAt);
  });

  return sorted[0] ?? null;
}

async function discoverAdvertisedProductBatch(params: {
  accountId: string;
  uploadId: string;
  uploadExportedAt: string;
  coverageStart: string | null;
  coverageEnd: string | null;
}): Promise<{ batchExportedAt: string; rows: AdvertisedProductBatchRow[] }> {
  const { accountId, uploadId, uploadExportedAt, coverageStart, coverageEnd } = params;
  if (!coverageStart || !coverageEnd) {
    throw new Error(
      `Advertised-product remap requires coverage_start and coverage_end on upload ${uploadId}.`
    );
  }

  const factRows = await fetchAllRows<AdvertisedProductBatchRow>(
    "sp_advertised_product_daily_fact",
    "date,campaign_id,ad_group_id,campaign_name_raw,campaign_name_norm,ad_group_name_raw,ad_group_name_norm,advertised_asin_raw,advertised_asin_norm,sku_raw,impressions,clicks,spend,sales,orders,units,exported_at",
    {
      account_id: accountId,
    }
  );

  const rowsInCoverage = factRows.filter((row) => row.date >= coverageStart && row.date <= coverageEnd);
  if (rowsInCoverage.length === 0) {
    throw new Error(
      `No sp_advertised_product_daily_fact rows found for upload ${uploadId} in coverage window ${coverageStart}..${coverageEnd}.`
    );
  }

  const rowsByBatch = new Map<string, AdvertisedProductBatchRow[]>();
  for (const row of rowsInCoverage) {
    const batch = row.exported_at;
    const list = rowsByBatch.get(batch) ?? [];
    list.push(row);
    rowsByBatch.set(batch, list);
  }

  const candidates = [...rowsByBatch.entries()].map(([exportedAt, rows]) => {
    const dates = rows.map((row) => row.date).sort();
    return {
      exportedAt,
      minDate: dates[0] ?? coverageStart,
      maxDate: dates[dates.length - 1] ?? coverageEnd,
      rowCount: rows.length,
    };
  });

  const selected = pickAdvertisedProductBatchCandidate({
    uploadExportedAt,
    coverageStart,
    coverageEnd,
    candidates,
  });
  if (!selected) {
    throw new Error(
      `No sp_advertised_product_daily_fact batch candidates could be selected for upload ${uploadId}.`
    );
  }

  const rows = rowsByBatch.get(selected.exportedAt) ?? [];
  if (rows.length === 0) {
    throw new Error(
      `Selected advertised-product batch ${selected.exportedAt} for upload ${uploadId}, but it contains zero rows.`
    );
  }

  return {
    batchExportedAt: selected.exportedAt,
    rows,
  };
}

async function clearExistingIssues(uploadId: string, reportType: string) {
  const client = getSupabaseClient();
  const { error: issueError } = await client
    .from("sp_mapping_issues")
    .delete()
    .eq("upload_id", uploadId)
    .eq("report_type", reportType);
  if (issueError) throw new Error(`Failed clearing mapping issues: ${issueError.message}`);
}

async function clearExisting(uploadId: string, reportType: string, factTable: string) {
  const client = getSupabaseClient();
  await clearExistingIssues(uploadId, reportType);
  const { error: factError } = await client
    .from(factTable)
    .delete()
    .eq("upload_id", uploadId);
  if (factError) throw new Error(`Failed clearing facts from ${factTable}: ${factError.message}`);
}

async function clearExistingAdvertisedProductFacts(accountId: string, batchExportedAt: string) {
  const client = getSupabaseClient();
  const { error } = await client
    .from("sp_advertised_product_daily_fact")
    .delete()
    .eq("account_id", accountId)
    .eq("exported_at", batchExportedAt);
  if (error) {
    throw new Error(`Failed clearing facts from sp_advertised_product_daily_fact: ${error.message}`);
  }
}

async function insertChunked(table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const client = getSupabaseClient();
  for (const chunk of chunkArray(rows, 500)) {
    const { error } = await client.from(table).insert(chunk);
    if (error) throw new Error(`Failed inserting into ${table}: ${error.message}`);
  }
}

async function insertIssues(
  accountId: string,
  uploadId: string,
  reportType: string,
  issues: { entity_level: string; issue_type: string; key_json: Record<string, unknown>; candidates_json?: unknown; row_count: number }[]
) {
  const rows = issues.map((issue) => ({
    account_id: accountId,
    upload_id: uploadId,
    report_type: reportType,
    entity_level: issue.entity_level,
    issue_type: issue.issue_type,
    key_json: issue.key_json,
    candidates_json: issue.candidates_json ?? null,
    row_count: issue.row_count,
  }));
  await insertChunked("sp_mapping_issues", rows);
}

function buildSpStisAutoTargetBridgeKey(params: {
  date: string;
  campaignId: string;
  adGroupId: string;
}): string {
  return `${params.date}::${params.campaignId}::${params.adGroupId}`;
}

type SpTargetingAutoBridgeRow = {
  date: string;
  campaign_id: string;
  ad_group_id: string;
  target_id: string | null;
  targeting_norm: string;
};

export function buildSpStisAutoTargetBridge(
  rows: SpTargetingAutoBridgeRow[]
): SpStisAutoTargetBridge {
  const bridge = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.target_id) continue;
    if (!SP_AUTO_TARGETING_NORMS.includes(row.targeting_norm as (typeof SP_AUTO_TARGETING_NORMS)[number])) {
      continue;
    }
    const key = buildSpStisAutoTargetBridgeKey({
      date: row.date,
      campaignId: row.campaign_id,
      adGroupId: row.ad_group_id,
    });
    const targetIds = bridge.get(key) ?? new Set<string>();
    targetIds.add(row.target_id);
    bridge.set(key, targetIds);
  }

  return new Map(
    [...bridge.entries()].map(([key, targetIds]) => [key, [...targetIds].sort()])
  );
}

async function fetchSpStisAutoTargetBridge(params: {
  accountId: string;
  coverageStart: string | null;
  coverageEnd: string | null;
  stisRows: SpStisRawRow[];
}): Promise<SpStisAutoTargetBridge> {
  const { accountId, coverageStart, coverageEnd, stisRows } = params;
  const needsBridge = stisRows.some((row) => {
    const hasSearchTerm =
      !!row.customer_search_term_norm && row.customer_search_term_norm.trim() !== "";
    const isUnknownMatchType =
      row.match_type_raw === "-" || row.match_type_norm === "UNKNOWN";
    return row.targeting_norm === "*" && hasSearchTerm && isUnknownMatchType;
  });
  if (!needsBridge) return new Map();

  const distinctDates = [...new Set(stisRows.map((row) => row.date).filter(Boolean))].sort();
  if (!coverageStart && !coverageEnd && distinctDates.length === 0) return new Map();

  const client = getSupabaseClient();
  const rows: SpTargetingAutoBridgeRow[] = [];
  let offset = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let query = client
      .from("sp_targeting_daily_fact_latest")
      .select("date,campaign_id,ad_group_id,target_id,targeting_norm")
      .eq("account_id", accountId)
      .in("targeting_norm", [...SP_AUTO_TARGETING_NORMS])
      .not("target_id", "is", null)
      .range(offset, offset + FETCH_LIMIT - 1);

    if (coverageStart) {
      query = query.gte("date", coverageStart);
    }
    if (coverageEnd) {
      query = query.lte("date", coverageEnd);
    }
    if (!coverageStart && !coverageEnd) {
      query = query.in("date", distinctDates);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed fetching sp_targeting_daily_fact_latest auto bridge rows: ${error.message}`);
    }

    const chunk = (data ?? []) as SpTargetingAutoBridgeRow[];
    rows.push(...chunk);
    if (chunk.length < FETCH_LIMIT) break;
    offset += FETCH_LIMIT;
  }

  return buildSpStisAutoTargetBridge(rows);
}

async function refreshSpCampaignHourlyFactGold(uploadId: string) {
  const client = getSupabaseClient();
  const { error } = await client.rpc("refresh_sp_campaign_hourly_fact_gold", {
    p_upload_id: uploadId,
  });
  if (error) {
    throw new Error(`Failed refreshing SP campaign gold rows: ${error.message}`);
  }
}

export async function mapUpload(
  uploadId: string,
  reportType:
    | "sp_campaign"
    | "sp_placement"
    | "sp_targeting"
    | "sp_stis"
    | "sp_advertised_product"
) {
  const upload = await fetchUpload(uploadId);
  try {
    if (upload.source_type !== reportType) {
      throw new Error(`Upload ${uploadId} is ${upload.source_type}, expected ${reportType}`);
    }

    const exportedAtDate = extractDate(upload.exported_at);
    if (!exportedAtDate) throw new Error(`Upload ${uploadId} has no exported_at`);

    const exportedAt = upload.exported_at ?? new Date().toISOString();
    let advertisedRows: SpAdvertisedProductRawRow[] = [];
    let advertisedBatchExportedAt: string | null = null;

    if (reportType === "sp_advertised_product") {
      const discoveredBatch = await discoverAdvertisedProductBatch({
        accountId: upload.account_id,
        uploadId,
        uploadExportedAt: exportedAt,
        coverageStart: upload.coverage_start,
        coverageEnd: upload.coverage_end,
      });
      advertisedRows = discoveredBatch.rows.map(({ exported_at: _exportedAt, ...row }) => row);
      advertisedBatchExportedAt = discoveredBatch.batchExportedAt;
      await clearExistingIssues(uploadId, reportType);
    } else {
      await clearExisting(
        uploadId,
        reportType,
        reportType === "sp_campaign"
          ? "sp_campaign_hourly_fact"
          : reportType === "sp_placement"
            ? "sp_placement_daily_fact"
            : reportType === "sp_targeting"
              ? "sp_targeting_daily_fact"
              : "sp_stis_daily_fact"
      );
    }

    const snapshotDate =
      (await pickBestBulkSnapshotForUpload({
        accountId: upload.account_id,
        uploadId,
        reportType,
        exportedAtDate,
        exportedAt,
      })) ?? (await pickBulkSnapshotForExport(upload.account_id, exportedAtDate));
    if (!snapshotDate) {
      const message = "No compatible bulk snapshot was found for this upload.";
      await insertIssues(upload.account_id, uploadId, reportType, [
        {
          entity_level: "snapshot",
          issue_type: "missing_bulk_snapshot",
          key_json: { exported_at_date: exportedAtDate },
          row_count: 1,
        },
      ]);
      await persistMapStatus({
        upload,
        reportType,
        mapStatus: "missing_snapshot",
        factRows: 0,
        issueRows: 1,
        message,
      });
      return { status: "missing_snapshot" as const, factRows: 0, issueRows: 1 };
    }

    const lookup = await loadBulkLookup(upload.account_id, snapshotDate);
    const referenceDate = exportedAtDate;

    if (reportType === "sp_advertised_product") {
      if (!advertisedBatchExportedAt) {
        throw new Error(`No advertised-product batch was discovered for upload ${uploadId}.`);
      }
      const { facts, issues } = mapSpAdvertisedProductRows({
        rows: advertisedRows,
        lookup,
        accountId: upload.account_id,
        exportedAt: advertisedBatchExportedAt,
        referenceDate,
      });
      await clearExistingAdvertisedProductFacts(upload.account_id, advertisedBatchExportedAt);
      await insertChunked("sp_advertised_product_daily_fact", facts);
      await insertIssues(upload.account_id, uploadId, reportType, issues);
      await persistMapStatus({
        upload,
        reportType,
        mapStatus: "ok",
        factRows: facts.length,
        issueRows: issues.length,
      });
      return { status: "ok" as const, factRows: facts.length, issueRows: issues.length };
    }

    if (reportType === "sp_campaign") {
      const rows = await fetchAllRows<SpCampaignRawRow>(
        "sp_campaign_daily_raw",
        "date,start_time,portfolio_name_raw,portfolio_name_norm,campaign_name_raw,campaign_name_norm,impressions,clicks,spend,sales,orders,units",
        { upload_id: uploadId }
      );
      const { facts, issues } = mapSpCampaignRows({
        rows,
        lookup,
        uploadId,
        accountId: upload.account_id,
        exportedAt,
        referenceDate,
      });
      await insertChunked("sp_campaign_hourly_fact", facts);
      await refreshSpCampaignHourlyFactGold(uploadId);
      await insertIssues(upload.account_id, uploadId, reportType, issues);
      await persistMapStatus({
        upload,
        reportType,
        mapStatus: "ok",
        factRows: facts.length,
        issueRows: issues.length,
      });
      return { status: "ok" as const, factRows: facts.length, issueRows: issues.length };
    }

    if (reportType === "sp_placement") {
      const rows = await fetchAllRows<SpPlacementRawRow>(
        "sp_placement_daily_raw",
        "date,portfolio_name_raw,portfolio_name_norm,campaign_name_raw,campaign_name_norm,bidding_strategy,placement_raw,placement_raw_norm,placement_code,impressions,clicks,spend,sales,orders,units,cpc,ctr,acos,roas",
        { upload_id: uploadId }
      );
      const { facts, issues } = mapSpPlacementRows({
        rows,
        lookup,
        uploadId,
        accountId: upload.account_id,
        exportedAt,
        referenceDate,
      });
      await insertChunked("sp_placement_daily_fact", facts);
      await insertIssues(upload.account_id, uploadId, reportType, issues);
      await persistMapStatus({
        upload,
        reportType,
        mapStatus: "ok",
        factRows: facts.length,
        issueRows: issues.length,
      });
      return { status: "ok" as const, factRows: facts.length, issueRows: issues.length };
    }

    if (reportType === "sp_targeting") {
      const rows = await fetchAllRows<SpTargetingRawRow>(
        "sp_targeting_daily_raw",
        "date,portfolio_name_raw,portfolio_name_norm,campaign_name_raw,campaign_name_norm,ad_group_name_raw,ad_group_name_norm,targeting_raw,targeting_norm,match_type_raw,match_type_norm,impressions,clicks,spend,sales,orders,units,cpc,ctr,acos,roas,conversion_rate,top_of_search_impression_share",
        { upload_id: uploadId }
      );
      const { facts, issues } = mapSpTargetingRows({
        rows,
        lookup,
        uploadId,
        accountId: upload.account_id,
        exportedAt,
        referenceDate,
      });
      await insertChunked("sp_targeting_daily_fact", facts);
      await insertIssues(upload.account_id, uploadId, reportType, issues);
      await persistMapStatus({
        upload,
        reportType,
        mapStatus: "ok",
        factRows: facts.length,
        issueRows: issues.length,
      });
      return { status: "ok" as const, factRows: facts.length, issueRows: issues.length };
    }

    const rows = await fetchAllRows<SpStisRawRow>(
      "sp_stis_daily_raw",
      "date,portfolio_name_raw,portfolio_name_norm,campaign_name_raw,campaign_name_norm,ad_group_name_raw,ad_group_name_norm,targeting_raw,targeting_norm,match_type_raw,match_type_norm,customer_search_term_raw,customer_search_term_norm,search_term_impression_rank,search_term_impression_share,impressions,clicks,spend,sales,orders,units,cpc,ctr,acos,roas,conversion_rate",
      { upload_id: uploadId }
    );
    const autoTargetBridge = await fetchSpStisAutoTargetBridge({
      accountId: upload.account_id,
      coverageStart: upload.coverage_start,
      coverageEnd: upload.coverage_end,
      stisRows: rows,
    });
    const { facts, issues } = mapSpStisRows({
      rows,
      lookup,
      uploadId,
      accountId: upload.account_id,
      exportedAt,
      referenceDate,
      autoTargetBridge,
    });
    await insertChunked("sp_stis_daily_fact", facts);
    await insertIssues(upload.account_id, uploadId, reportType, issues);
    await persistMapStatus({
      upload,
      reportType,
      mapStatus: "ok",
      factRows: facts.length,
      issueRows: issues.length,
    });
    return { status: "ok" as const, factRows: facts.length, issueRows: issues.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await persistMapStatus({
      upload,
      reportType,
      mapStatus: "error",
      message,
    });
    throw error;
  }
}

export async function findUploadIdByFileHash(accountId: string, fileHash: string): Promise<string | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("uploads")
    .select("upload_id")
    .eq("account_id", accountId)
    .eq("file_hash_sha256", fileHash)
    .maybeSingle();
  if (error) throw new Error(`Failed fetching upload by hash: ${error.message}`);
  return data?.upload_id ?? null;
}
