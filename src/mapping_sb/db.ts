import { getSupabaseClient } from "../db/supabaseClient";
import { chunkArray } from "../ingest/utils";
import {
  BulkLookup,
  ManualOverrideRow,
  NameHistoryRow,
  normalizeMatchType,
  pickBulkSnapshotFromList,
} from "./core";
import {
  mapSbCampaignRows,
  mapSbCampaignPlacementRows,
  mapSbKeywordRows,
  mapSbStisRows,
  SbCampaignRawRow,
  SbCampaignPlacementRawRow,
  SbKeywordRawRow,
  SbStisRawRow,
} from "./mappers";
import { dedupeFactRows, getOnConflictColumns, SbReportType } from "./upsert";

const FETCH_LIMIT = 1000;

type UploadRow = {
  upload_id: string;
  account_id: string;
  source_type: string;
  exported_at: string | null;
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
  reportType: "sb_campaign" | "sb_campaign_placement" | "sb_keyword" | "sb_stis"
) {
  if (reportType === "sb_campaign") return "sb_campaign_daily_raw";
  if (reportType === "sb_campaign_placement") return "sb_campaign_placement_daily_raw";
  if (reportType === "sb_keyword") return "sb_keyword_daily_raw";
  return "sb_stis_daily_raw";
}

async function fetchDistinctCampaignNameNorms(
  reportType: "sb_campaign" | "sb_campaign_placement" | "sb_keyword" | "sb_stis",
  uploadId: string
): Promise<string[]> {
  const table = getRawTableForReportType(reportType);
  const rows = await fetchAllRows<{ campaign_name_norm: string }>(
    table,
    "campaign_name_norm",
    { upload_id: uploadId }
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
      .from("bulk_sb_campaigns")
      .select("campaign_name_norm")
      .eq("account_id", accountId)
      .eq("snapshot_date", snapshotDate)
      .in("campaign_name_norm", chunk);
    if (error) throw new Error(`Failed fetching bulk_sb_campaigns matches: ${error.message}`);
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
  reportType: "sb_campaign" | "sb_campaign_placement" | "sb_keyword" | "sb_stis";
  exportedAtDate: string;
}): Promise<string | null> {
  const { accountId, uploadId, reportType, exportedAtDate } = params;
  const campaignNames = await fetchDistinctCampaignNameNorms(reportType, uploadId);
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
    }>("bulk_sb_campaigns", "campaign_id,campaign_name_norm,portfolio_id", {
      account_id: accountId,
      snapshot_date: snapshotDate,
    }),
    fetchAllRows<{
      ad_group_id: string;
      campaign_id: string;
      ad_group_name_norm: string;
    }>("bulk_sb_ad_groups", "ad_group_id,campaign_id,ad_group_name_norm", {
      account_id: accountId,
      snapshot_date: snapshotDate,
    }),
    fetchAllRows<{
      target_id: string;
      ad_group_id: string;
      expression_norm: string;
      match_type: string;
      is_negative: boolean;
    }>("bulk_sb_targets", "target_id,ad_group_id,expression_norm,match_type,is_negative", {
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
    }>("sb_manual_name_overrides", "entity_level,entity_id,name_norm,valid_from,valid_to", {
      account_id: accountId,
    }),
    (async () => {
      if (!(await tableExists("sp_category_id_map"))) return [] as { category_name_norm: string; category_id: string }[];
      return fetchAllRows<{ category_name_norm: string; category_id: string }>(
        "sp_category_id_map",
        "category_name_norm,category_id",
        { account_id: accountId }
      );
    })(),
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
  if (await tableExists("sb_campaign_name_history")) {
    const historyRows = await fetchAllRows<{
      campaign_id: string;
      name_norm: string;
      valid_from: string;
      valid_to: string | null;
    }>("sb_campaign_name_history", "campaign_id,name_norm,valid_from,valid_to", {
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
  if (await tableExists("sb_ad_group_name_history")) {
    const historyRows = await fetchAllRows<{
      ad_group_id: string;
      campaign_id: string;
      name_norm: string;
      valid_from: string;
      valid_to: string | null;
    }>("sb_ad_group_name_history", "ad_group_id,campaign_id,name_norm,valid_from,valid_to", {
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
    .select("upload_id,account_id,source_type,exported_at")
    .eq("upload_id", uploadId)
    .single();
  if (error) throw new Error(`Failed fetching upload: ${error.message}`);
  return data as UploadRow;
}

async function clearExisting(uploadId: string, reportType: string, factTable: string) {
  const client = getSupabaseClient();
  const { error: issueError } = await client
    .from("sb_mapping_issues")
    .delete()
    .eq("upload_id", uploadId)
    .eq("report_type", reportType);
  if (issueError) throw new Error(`Failed clearing mapping issues: ${issueError.message}`);

  const { error: factError } = await client
    .from(factTable)
    .delete()
    .eq("upload_id", uploadId);
  if (factError) throw new Error(`Failed clearing facts from ${factTable}: ${factError.message}`);
}

async function insertChunked(
  table: string,
  rows: Record<string, unknown>[],
  reportType?: SbReportType
) {
  if (!rows.length) return;
  const client = getSupabaseClient();
  const payload = reportType ? dedupeFactRows(reportType, rows as never) : rows;
  for (const chunk of chunkArray(payload, 500)) {
    const query = reportType
      ? client.from(table).upsert(chunk, { onConflict: getOnConflictColumns(reportType) })
      : client.from(table).insert(chunk);
    const { error } = await query;
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
  await insertChunked("sb_mapping_issues", rows);
}

export async function mapUpload(
  uploadId: string,
  reportType: "sb_campaign" | "sb_campaign_placement" | "sb_keyword" | "sb_stis"
) {
  const upload = await fetchUpload(uploadId);
  if (upload.source_type !== reportType) {
    throw new Error(`Upload ${uploadId} is ${upload.source_type}, expected ${reportType}`);
  }

  const exportedAtDate = extractDate(upload.exported_at);
  if (!exportedAtDate) throw new Error(`Upload ${uploadId} has no exported_at`);

  await clearExisting(
    uploadId,
    reportType,
    reportType === "sb_campaign"
      ? "sb_campaign_daily_fact"
      : reportType === "sb_campaign_placement"
        ? "sb_campaign_placement_daily_fact"
        : reportType === "sb_keyword"
          ? "sb_keyword_daily_fact"
          : "sb_stis_daily_fact"
  );

  const snapshotDate =
    (await pickBestBulkSnapshotForUpload({
      accountId: upload.account_id,
      uploadId,
      reportType,
      exportedAtDate,
    })) ?? (await pickBulkSnapshotForExport(upload.account_id, exportedAtDate));
  if (!snapshotDate) {
    await insertIssues(upload.account_id, uploadId, reportType, [
      {
        entity_level: "snapshot",
        issue_type: "missing_bulk_snapshot",
        key_json: { exported_at_date: exportedAtDate },
        row_count: 1,
      },
    ]);
    return { status: "missing_snapshot" as const, factRows: 0, issueRows: 1 };
  }

  const lookup = await loadBulkLookup(upload.account_id, snapshotDate);
  const referenceDate = exportedAtDate;
  const exportedAt = upload.exported_at ?? new Date().toISOString();

  if (reportType === "sb_campaign") {
    const rows = await fetchAllRows<SbCampaignRawRow>(
      "sb_campaign_daily_raw",
      "date,portfolio_name_raw,portfolio_name_norm,campaign_name_raw,campaign_name_norm,impressions,clicks,spend,sales,orders,units",
      { upload_id: uploadId }
    );
    const { facts, issues } = mapSbCampaignRows({
      rows,
      lookup,
      uploadId,
      accountId: upload.account_id,
      exportedAt,
      referenceDate,
    });
    await insertChunked("sb_campaign_daily_fact", facts, "sb_campaign");
    await insertIssues(upload.account_id, uploadId, reportType, issues);
    return { status: "ok" as const, factRows: facts.length, issueRows: issues.length };
  }

  if (reportType === "sb_campaign_placement") {
    const rows = await fetchAllRows<SbCampaignPlacementRawRow>(
      "sb_campaign_placement_daily_raw",
      "date,portfolio_name_raw,portfolio_name_norm,campaign_name_raw,campaign_name_norm,placement_raw,placement_raw_norm,placement_code,impressions,clicks,spend,sales,orders,units,cpc,ctr,acos,roas",
      { upload_id: uploadId }
    );
    const { facts, issues } = mapSbCampaignPlacementRows({
      rows,
      lookup,
      uploadId,
      accountId: upload.account_id,
      exportedAt,
      referenceDate,
    });
    await insertChunked("sb_campaign_placement_daily_fact", facts, "sb_campaign_placement");
    await insertIssues(upload.account_id, uploadId, reportType, issues);
    return { status: "ok" as const, factRows: facts.length, issueRows: issues.length };
  }

  if (reportType === "sb_keyword") {
    const rows = await fetchAllRows<SbKeywordRawRow>(
      "sb_keyword_daily_raw",
      "date,portfolio_name_raw,portfolio_name_norm,campaign_name_raw,campaign_name_norm,ad_group_name_raw,ad_group_name_norm,targeting_raw,targeting_norm,match_type_raw,match_type_norm,impressions,clicks,spend,sales,orders,units,cpc,ctr,acos,roas,conversion_rate",
      { upload_id: uploadId }
    );
    const { facts, issues } = mapSbKeywordRows({
      rows,
      lookup,
      uploadId,
      accountId: upload.account_id,
      exportedAt,
      referenceDate,
    });
    await insertChunked("sb_keyword_daily_fact", facts, "sb_keyword");
    await insertIssues(upload.account_id, uploadId, reportType, issues);
    return { status: "ok" as const, factRows: facts.length, issueRows: issues.length };
  }

  const rows = await fetchAllRows<SbStisRawRow>(
    "sb_stis_daily_raw",
    "date,portfolio_name_raw,portfolio_name_norm,campaign_name_raw,campaign_name_norm,ad_group_name_raw,ad_group_name_norm,targeting_raw,targeting_norm,match_type_raw,match_type_norm,customer_search_term_raw,customer_search_term_norm,search_term_impression_rank,search_term_impression_share,impressions,clicks,spend,sales,orders,units,cpc,ctr,acos,roas,conversion_rate",
    { upload_id: uploadId }
  );
  const { facts, issues } = mapSbStisRows({
    rows,
    lookup,
    uploadId,
    accountId: upload.account_id,
    exportedAt,
    referenceDate,
  });
  await insertChunked("sb_stis_daily_fact", facts, "sb_stis");
  await insertIssues(upload.account_id, uploadId, reportType, issues);
  return { status: "ok" as const, factRows: facts.length, issueRows: issues.length };
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
