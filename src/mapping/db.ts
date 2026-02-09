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
  mapSpCampaignRows,
  mapSpPlacementRows,
  mapSpTargetingRows,
  mapSpStisRows,
  SpCampaignRawRow,
  SpPlacementRawRow,
  SpTargetingRawRow,
  SpStisRawRow,
} from "./mappers";

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

export async function loadBulkLookup(accountId: string, snapshotDate: string): Promise<BulkLookup> {
  const [campaigns, adGroups, targets, portfolios, overrides] = await Promise.all([
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
    .from("sp_mapping_issues")
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

export async function mapUpload(uploadId: string, reportType: "sp_campaign" | "sp_placement" | "sp_targeting" | "sp_stis") {
  const upload = await fetchUpload(uploadId);
  if (upload.source_type !== reportType) {
    throw new Error(`Upload ${uploadId} is ${upload.source_type}, expected ${reportType}`);
  }

  const exportedAtDate = extractDate(upload.exported_at);
  if (!exportedAtDate) throw new Error(`Upload ${uploadId} has no exported_at`);

  await clearExisting(uploadId, reportType, reportType === "sp_campaign" ? "sp_campaign_hourly_fact"
    : reportType === "sp_placement" ? "sp_placement_daily_fact"
    : reportType === "sp_targeting" ? "sp_targeting_daily_fact"
    : "sp_stis_daily_fact");

  const snapshotDate = await pickBulkSnapshotForExport(upload.account_id, exportedAtDate);
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
    await insertIssues(upload.account_id, uploadId, reportType, issues);
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
    return { status: "ok" as const, factRows: facts.length, issueRows: issues.length };
  }

  const rows = await fetchAllRows<SpStisRawRow>(
    "sp_stis_daily_raw",
    "date,portfolio_name_raw,portfolio_name_norm,campaign_name_raw,campaign_name_norm,ad_group_name_raw,ad_group_name_norm,targeting_raw,targeting_norm,match_type_raw,match_type_norm,customer_search_term_raw,customer_search_term_norm,search_term_impression_rank,search_term_impression_share,impressions,clicks,spend,sales,orders,units,cpc,ctr,acos,roas,conversion_rate",
    { upload_id: uploadId }
  );
  const { facts, issues } = mapSpStisRows({
    rows,
    lookup,
    uploadId,
    accountId: upload.account_id,
    exportedAt,
    referenceDate,
  });
  await insertChunked("sp_stis_daily_fact", facts);
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
