import { getSupabaseClient } from "../db/supabaseClient";
import { chunkArray } from "../ingest/utils";
import { normText } from "../bulk/parseSponsoredProductsBulk";
import {
  BulkLookup,
  ManualOverrideRow,
  NameHistoryRow,
  pickBulkSnapshotFromList,
} from "./core";
import {
  mapSdAdvertisedProductRows,
  mapSdCampaignRows,
  mapSdMatchedTargetRows,
  mapSdPurchasedProductRows,
  mapSdTargetingRows,
  SdAdvertisedProductRawRow,
  SdCampaignRawRow,
  SdMatchedTargetRawRow,
  SdPurchasedProductRawRow,
  SdTargetingRawRow,
} from "./mappers";
import { dedupeFactRows, getOnConflictColumns, SdReportType } from "./upsert";

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

async function pickBulkSnapshotForExport(accountId: string, exportedAtDate: string) {
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
  const [campaigns, adGroups, targets, productAds, portfolios, overrides] = await Promise.all([
    fetchAllRows<{
      campaign_id: string;
      campaign_name_norm: string;
      portfolio_id: string | null;
    }>("bulk_sd_campaigns", "campaign_id,campaign_name_norm,portfolio_id", {
      account_id: accountId,
      snapshot_date: snapshotDate,
    }),
    fetchAllRows<{
      ad_group_id: string;
      campaign_id: string;
      ad_group_name_norm: string;
    }>("bulk_sd_ad_groups", "ad_group_id,campaign_id,ad_group_name_norm", {
      account_id: accountId,
      snapshot_date: snapshotDate,
    }),
    fetchAllRows<{
      targeting_id: string;
      ad_group_id: string;
      campaign_id: string;
      expression_norm: string;
      target_type: string;
    }>("bulk_sd_targets", "targeting_id,ad_group_id,campaign_id,expression_norm,target_type", {
      account_id: accountId,
      snapshot_date: snapshotDate,
    }),
    fetchAllRows<{
      ad_id: string;
      ad_group_id: string;
      campaign_id: string;
      sku_raw: string | null;
      asin_raw: string | null;
    }>("bulk_sd_product_ads", "ad_id,ad_group_id,campaign_id,sku_raw,asin_raw", {
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
    }>("sd_manual_name_overrides", "entity_level,entity_id,name_norm,valid_from,valid_to", {
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

  const targetByAdGroupKey = new Map<string, { target_id: string; ad_group_id: string; campaign_id: string; target_type: string }[]>();
  const targetByCampaignKey = new Map<string, { target_id: string; ad_group_id: string; campaign_id: string; target_type: string }[]>();
  const targetById = new Map<string, { target_id: string; ad_group_id: string; campaign_id: string; target_type: string }>();
  for (const row of targets) {
    const adGroupKey = `${row.ad_group_id}::${row.expression_norm}`;
    if (!targetByAdGroupKey.has(adGroupKey)) targetByAdGroupKey.set(adGroupKey, []);
    targetByAdGroupKey.get(adGroupKey)?.push({
      target_id: row.targeting_id,
      ad_group_id: row.ad_group_id,
      campaign_id: row.campaign_id,
      target_type: row.target_type,
    });

    const campaignKey = `${row.campaign_id}::${row.expression_norm}`;
    if (!targetByCampaignKey.has(campaignKey)) targetByCampaignKey.set(campaignKey, []);
    targetByCampaignKey.get(campaignKey)?.push({
      target_id: row.targeting_id,
      ad_group_id: row.ad_group_id,
      campaign_id: row.campaign_id,
      target_type: row.target_type,
    });

    targetById.set(row.targeting_id, {
      target_id: row.targeting_id,
      ad_group_id: row.ad_group_id,
      campaign_id: row.campaign_id,
      target_type: row.target_type,
    });
  }

  const adByGroupSku = new Map<string, { ad_id: string; ad_group_id: string; campaign_id: string }[]>();
  const adByGroupAsin = new Map<string, { ad_id: string; ad_group_id: string; campaign_id: string }[]>();
  const adById = new Map<string, { ad_id: string; ad_group_id: string; campaign_id: string }>();
  for (const row of productAds) {
    const skuNorm = row.sku_raw ? normText(row.sku_raw) : "";
    const asinNorm = row.asin_raw ? normText(row.asin_raw) : "";
    if (skuNorm) {
      const key = `${row.ad_group_id}::${skuNorm}`;
      if (!adByGroupSku.has(key)) adByGroupSku.set(key, []);
      adByGroupSku.get(key)?.push({ ad_id: row.ad_id, ad_group_id: row.ad_group_id, campaign_id: row.campaign_id });
    }
    if (asinNorm) {
      const key = `${row.ad_group_id}::${asinNorm}`;
      if (!adByGroupAsin.has(key)) adByGroupAsin.set(key, []);
      adByGroupAsin.get(key)?.push({ ad_id: row.ad_id, ad_group_id: row.ad_group_id, campaign_id: row.campaign_id });
    }
    adById.set(row.ad_id, { ad_id: row.ad_id, ad_group_id: row.ad_group_id, campaign_id: row.campaign_id });
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
  if (await tableExists("sd_campaign_name_history")) {
    const historyRows = await fetchAllRows<{
      campaign_id: string;
      name_norm: string;
      valid_from: string;
      valid_to: string | null;
    }>("sd_campaign_name_history", "campaign_id,name_norm,valid_from,valid_to", {
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
  if (await tableExists("sd_ad_group_name_history")) {
    const historyRows = await fetchAllRows<{
      ad_group_id: string;
      campaign_id: string;
      name_norm: string;
      valid_from: string;
      valid_to: string | null;
    }>("sd_ad_group_name_history", "ad_group_id,campaign_id,name_norm,valid_from,valid_to", {
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
    targetByCampaignKey,
    targetById,
    adByGroupSku,
    adByGroupAsin,
    adById,
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
    .from("sd_mapping_issues")
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

async function insertChunked(table: string, rows: Record<string, unknown>[], reportType?: SdReportType) {
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
  await insertChunked("sd_mapping_issues", rows);
}

async function refreshSdCampaignDailyFactGold(uploadId: string) {
  const client = getSupabaseClient();
  const { error } = await client.rpc("refresh_sd_campaign_daily_fact_gold", {
    p_upload_id: uploadId,
  });
  if (error) {
    throw new Error(`Failed refreshing SD campaign gold rows: ${error.message}`);
  }
}

export async function mapUpload(
  uploadId: string,
  reportType: SdReportType
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
    reportType === "sd_campaign"
      ? "sd_campaign_daily_fact"
      : reportType === "sd_advertised_product"
        ? "sd_advertised_product_daily_fact"
        : reportType === "sd_targeting"
          ? "sd_targeting_daily_fact"
          : reportType === "sd_matched_target"
            ? "sd_matched_target_daily_fact"
            : "sd_purchased_product_daily_fact"
  );

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

  if (reportType === "sd_campaign") {
    const rows = await fetchAllRows<SdCampaignRawRow>(
      "sd_campaign_daily_raw",
      "date,portfolio_name_raw,portfolio_name_norm,campaign_name_raw,campaign_name_norm,cost_type,impressions,clicks,spend,sales,orders,units,cpc,ctr,acos,roas,conversion_rate",
      { upload_id: uploadId }
    );
    const { facts, issues } = mapSdCampaignRows({
      rows,
      lookup,
      uploadId,
      accountId: upload.account_id,
      exportedAt,
      referenceDate,
    });
    await insertChunked("sd_campaign_daily_fact", facts, "sd_campaign");
    await refreshSdCampaignDailyFactGold(uploadId);
    await insertIssues(upload.account_id, uploadId, reportType, issues);
    return { status: "ok" as const, factRows: facts.length, issueRows: issues.length };
  }

  if (reportType === "sd_advertised_product") {
    const rows = await fetchAllRows<SdAdvertisedProductRawRow>(
      "sd_advertised_product_daily_raw",
      "date,portfolio_name_raw,portfolio_name_norm,campaign_name_raw,campaign_name_norm,ad_group_name_raw,ad_group_name_norm,advertised_sku_raw,advertised_sku_norm,advertised_asin_raw,advertised_asin_norm,cost_type,impressions,clicks,spend,sales,orders,units,cpc,ctr,acos,roas,conversion_rate",
      { upload_id: uploadId }
    );
    const { facts, issues } = mapSdAdvertisedProductRows({
      rows,
      lookup,
      uploadId,
      accountId: upload.account_id,
      exportedAt,
      referenceDate,
    });
    await insertChunked("sd_advertised_product_daily_fact", facts, "sd_advertised_product");
    await insertIssues(upload.account_id, uploadId, reportType, issues);
    return { status: "ok" as const, factRows: facts.length, issueRows: issues.length };
  }

  if (reportType === "sd_targeting") {
    const rows = await fetchAllRows<SdTargetingRawRow>(
      "sd_targeting_daily_raw",
      "date,portfolio_name_raw,portfolio_name_norm,campaign_name_raw,campaign_name_norm,ad_group_name_raw,ad_group_name_norm,targeting_raw,targeting_norm,match_type_raw,match_type_norm,cost_type,impressions,clicks,spend,sales,orders,units,cpc,ctr,acos,roas,conversion_rate",
      { upload_id: uploadId }
    );
    const { facts, issues } = mapSdTargetingRows({
      rows,
      lookup,
      uploadId,
      accountId: upload.account_id,
      exportedAt,
      referenceDate,
    });
    await insertChunked("sd_targeting_daily_fact", facts, "sd_targeting");
    await insertIssues(upload.account_id, uploadId, reportType, issues);
    return { status: "ok" as const, factRows: facts.length, issueRows: issues.length };
  }

  if (reportType === "sd_matched_target") {
    const rows = await fetchAllRows<SdMatchedTargetRawRow>(
      "sd_matched_target_daily_raw",
      "date,portfolio_name_raw,portfolio_name_norm,campaign_name_raw,campaign_name_norm,ad_group_name_raw,ad_group_name_norm,targeting_raw,targeting_norm,matched_target_raw,matched_target_norm,cost_type,impressions,clicks,spend,sales,orders,units,cpc,ctr,acos,roas,conversion_rate",
      { upload_id: uploadId }
    );
    const { facts, issues } = mapSdMatchedTargetRows({
      rows,
      lookup,
      uploadId,
      accountId: upload.account_id,
      exportedAt,
      referenceDate,
    });
    await insertChunked("sd_matched_target_daily_fact", facts, "sd_matched_target");
    await insertIssues(upload.account_id, uploadId, reportType, issues);
    return { status: "ok" as const, factRows: facts.length, issueRows: issues.length };
  }

  const rows = await fetchAllRows<SdPurchasedProductRawRow>(
    "sd_purchased_product_daily_raw",
    "date,portfolio_name_raw,portfolio_name_norm,campaign_name_raw,campaign_name_norm,ad_group_name_raw,ad_group_name_norm,purchased_sku_raw,purchased_sku_norm,purchased_asin_raw,purchased_asin_norm,cost_type,impressions,clicks,spend,sales,orders,units,cpc,ctr,acos,roas,conversion_rate",
    { upload_id: uploadId }
  );
  const { facts, issues } = mapSdPurchasedProductRows({
    rows,
    lookup,
    uploadId,
    accountId: upload.account_id,
    exportedAt,
    referenceDate,
  });
  await insertChunked("sd_purchased_product_daily_fact", facts, "sd_purchased_product");
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
