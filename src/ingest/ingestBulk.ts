import fs from "node:fs";
import path from "node:path";
import { parseSponsoredProductsBulk } from "../bulk/parseSponsoredProductsBulk";
import { parseBulkFilenameMeta } from "../bulk/bulkFileMeta";
import { inferSnapshotDate } from "../cli/snapshotDate";
import { getSupabaseClient } from "../db/supabaseClient";
import { chunkArray, hashFileSha256 } from "./utils";
import { planNameHistoryUpdates } from "./nameHistoryUtils";

type IngestResult = {
  status: "ok" | "already ingested";
  uploadId?: string;
  snapshotDate?: string;
  counts?: {
    portfolios: number;
    campaigns: number;
    adGroups: number;
    targets: number;
    placements: number;
    nameHistoryInserted: number;
    nameHistoryClosed: number;
  };
};

type BulkPlacementRow = {
  account_id: string;
  snapshot_date: string;
  campaign_id: string;
  placement_raw: string;
  placement_code: string;
  percentage: number;
};

function normalizePlacementCode(raw: string): string {
  const norm = raw.trim().toLowerCase();
  if (norm === "top of search") return "TOS";
  if (norm === "rest of search") return "ROS";
  if (norm === "product pages") return "PP";
  const safe = norm
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return safe || "UNKNOWN";
}

function inferCoverage(filename: string) {
  const meta = parseBulkFilenameMeta(filename);
  return {
    coverageStart: meta.coverageStart,
    coverageEnd: meta.coverageEnd,
    exportTimestampMs: meta.exportTimestampMs,
  };
}

export async function ingestBulk(
  xlsxPath: string,
  accountId: string,
  marketplace?: string,
  snapshotDateOverride?: string
): Promise<IngestResult> {
  const client = getSupabaseClient();
  const fileHash = hashFileSha256(xlsxPath);
  const filename = path.basename(xlsxPath);

  const { coverageStart, coverageEnd, exportTimestampMs } = inferCoverage(filename);
  const snapshotDate =
    snapshotDateOverride ?? inferSnapshotDate(xlsxPath, coverageEnd ?? undefined);

  const stats = fs.statSync(xlsxPath);
  const exportedAt = exportTimestampMs
    ? new Date(exportTimestampMs).toISOString()
    : stats.mtime.toISOString();

  const { data: existingUpload, error: existingError } = await client
    .from("uploads")
    .select("upload_id")
    .eq("account_id", accountId)
    .eq("file_hash_sha256", fileHash)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to check existing upload: ${existingError.message}`);
  }

  if (existingUpload?.upload_id) {
    return { status: "already ingested" };
  }

  const accountRow: { account_id: string; marketplace?: string } = { account_id: accountId };
  if (marketplace) accountRow.marketplace = marketplace;
  const { error: accountError } = await client
    .from("accounts")
    .upsert(accountRow, { onConflict: "account_id" });
  if (accountError) {
    throw new Error(`Failed to upsert account: ${accountError.message}`);
  }

  const uploadPayload = {
    account_id: accountId,
    source_type: "bulk",
    original_filename: filename,
    file_hash_sha256: fileHash,
    exported_at: exportedAt,
    coverage_start: coverageStart,
    coverage_end: coverageEnd,
    snapshot_date: snapshotDate,
  };

  const { data: uploadRow, error: uploadError } = await client
    .from("uploads")
    .insert(uploadPayload)
    .select("upload_id")
    .single();
  if (uploadError) {
    throw new Error(`Failed to insert upload: ${uploadError.message}`);
  }

  const snapshot = await parseSponsoredProductsBulk(xlsxPath, snapshotDate);

  const bulkPortfolios = snapshot.portfolios
    .filter((row) => row.portfolioId)
    .map((row) => ({
      account_id: accountId,
      snapshot_date: snapshotDate,
      portfolio_id: row.portfolioId,
      portfolio_name_raw: row.portfolioNameRaw,
      portfolio_name_norm: row.portfolioNameNorm,
    }));

  const bulkCampaigns = snapshot.campaigns
    .filter((row) => row.campaignId)
    .map((row) => ({
      account_id: accountId,
      snapshot_date: snapshotDate,
      campaign_id: row.campaignId,
      campaign_name_raw: row.campaignNameRaw,
      campaign_name_norm: row.campaignNameNorm,
      portfolio_id: row.portfolioId,
      state: row.state || null,
      daily_budget: row.dailyBudget,
      bidding_strategy: row.biddingStrategy || null,
    }));

  const bulkAdGroups = snapshot.adGroups
    .filter((row) => row.adGroupId && row.campaignId)
    .map((row) => ({
      account_id: accountId,
      snapshot_date: snapshotDate,
      ad_group_id: row.adGroupId,
      campaign_id: row.campaignId,
      ad_group_name_raw: row.adGroupNameRaw,
      ad_group_name_norm: row.adGroupNameNorm,
      state: row.state || null,
      default_bid: row.defaultBid,
    }));

  const bulkTargets = snapshot.targets
    .filter((row) => row.targetId && row.adGroupId && row.campaignId)
    .map((row) => ({
      account_id: accountId,
      snapshot_date: snapshotDate,
      target_id: row.targetId,
      ad_group_id: row.adGroupId,
      campaign_id: row.campaignId,
      expression_raw: row.expressionRaw,
      expression_norm: row.expressionNorm,
      match_type: row.matchType,
      is_negative: row.isNegative,
      state: row.state || null,
      bid: row.bid,
    }));

  const bulkPlacements: BulkPlacementRow[] = snapshot.placements
    .filter((row) => row.campaignId)
    .map((row) => ({
      account_id: accountId,
      snapshot_date: snapshotDate,
      campaign_id: row.campaignId as string,
      placement_raw: row.placement,
      placement_code: normalizePlacementCode(row.placement),
      percentage: row.percentage ?? 0,
    }));

  async function upsertChunked(table: string, rows: Record<string, unknown>[], onConflict: string) {
    for (const chunk of chunkArray(rows, 500)) {
      const { error } = await client.from(table).upsert(chunk, { onConflict });
      if (error) throw new Error(`Failed upserting ${table}: ${error.message}`);
    }
  }

  await upsertChunked(
    "bulk_portfolios",
    bulkPortfolios,
    "account_id,snapshot_date,portfolio_id"
  );
  await upsertChunked(
    "bulk_campaigns",
    bulkCampaigns,
    "account_id,snapshot_date,campaign_id"
  );
  await upsertChunked(
    "bulk_ad_groups",
    bulkAdGroups,
    "account_id,snapshot_date,ad_group_id"
  );
  await upsertChunked(
    "bulk_targets",
    bulkTargets,
    "account_id,snapshot_date,target_id"
  );
  await upsertChunked(
    "bulk_placements",
    bulkPlacements,
    "account_id,snapshot_date,campaign_id,placement_code"
  );

  const { data: previousSnap, error: prevError } = await client
    .from("bulk_campaigns")
    .select("snapshot_date")
    .eq("account_id", accountId)
    .lt("snapshot_date", snapshotDate)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (prevError) {
    throw new Error(`Failed fetching previous snapshot: ${prevError.message}`);
  }

  if (previousSnap?.snapshot_date) {
    const previousDate = previousSnap.snapshot_date;
    await client
      .from("bulk_campaigns")
      .select("campaign_id,campaign_name_raw,campaign_name_norm")
      .eq("account_id", accountId)
      .eq("snapshot_date", previousDate);
    await client
      .from("bulk_ad_groups")
      .select("ad_group_id,ad_group_name_raw,ad_group_name_norm")
      .eq("account_id", accountId)
      .eq("snapshot_date", previousDate);
    await client
      .from("bulk_portfolios")
      .select("portfolio_id,portfolio_name_raw,portfolio_name_norm")
      .eq("account_id", accountId)
      .eq("snapshot_date", previousDate);
  }

  let nameHistoryInserted = 0;
  let nameHistoryClosed = 0;

  async function updateNameHistory(
    table: string,
    idKey: string,
    rows: { id: string; nameRaw: string; nameNorm: string; extra?: Record<string, unknown> }[]
  ) {
    const ids = rows.map((row) => row.id).filter((id) => id);
    if (!ids.length) return;

    const openRows: { entityId: string; nameRaw: string; nameNorm: string; validFrom: string }[] = [];
    for (const chunk of chunkArray(ids, 500)) {
      const { data, error } = await client
        .from(table)
        .select("valid_from,name_raw,name_norm," + idKey)
        .eq("account_id", accountId)
        .is("valid_to", null)
        .in(idKey, chunk);
      if (error) throw new Error(`Failed loading ${table} open rows: ${error.message}`);
      for (const row of data ?? []) {
        openRows.push({
          entityId: String((row as any)[idKey]),
          nameRaw: String((row as any).name_raw),
          nameNorm: String((row as any).name_norm),
          validFrom: String((row as any).valid_from),
        });
      }
    }

    const current = rows.map((row) => ({
      entityId: row.id,
      nameRaw: row.nameRaw,
      nameNorm: row.nameNorm,
    }));

    const plan = planNameHistoryUpdates(current, openRows, snapshotDate);

    for (const close of plan.toClose) {
      const { error } = await client
        .from(table)
        .update({ valid_to: close.validTo })
        .eq("account_id", accountId)
        .eq(idKey, close.entityId)
        .eq("valid_from", close.validFrom)
        .is("valid_to", null);
      if (error) throw new Error(`Failed closing ${table} row: ${error.message}`);
      nameHistoryClosed += 1;
    }

    const rowById = new Map(rows.map((row) => [row.id, row] as const));
    const inserts = plan.toInsert.map((row) => {
      const base: Record<string, unknown> = {
        account_id: accountId,
        [idKey]: row.entityId,
        name_raw: row.nameRaw,
        name_norm: row.nameNorm,
        valid_from: row.validFrom,
        valid_to: null,
      };
      const extra = rowById.get(row.entityId)?.extra;
      if (extra) {
        Object.assign(base, extra);
      }
      return base;
    });

    for (const chunk of chunkArray(inserts, 500)) {
      const { error } = await client.from(table).insert(chunk);
      if (error) throw new Error(`Failed inserting ${table} rows: ${error.message}`);
      nameHistoryInserted += chunk.length;
    }
  }

  await updateNameHistory(
    "campaign_name_history",
    "campaign_id",
    snapshot.campaigns
      .filter((row) => row.campaignId)
      .map((row) => ({
        id: row.campaignId as string,
        nameRaw: row.campaignNameRaw,
        nameNorm: row.campaignNameNorm,
      }))
  );

  await updateNameHistory(
    "ad_group_name_history",
    "ad_group_id",
    snapshot.adGroups
      .filter((row) => row.adGroupId)
      .map((row) => ({
        id: row.adGroupId as string,
        nameRaw: row.adGroupNameRaw,
        nameNorm: row.adGroupNameNorm,
        extra: { campaign_id: row.campaignId },
      }))
  );

  await updateNameHistory(
    "portfolio_name_history",
    "portfolio_id",
    snapshot.portfolios
      .filter((row) => row.portfolioId)
      .map((row) => ({
        id: row.portfolioId as string,
        nameRaw: row.portfolioNameRaw,
        nameNorm: row.portfolioNameNorm,
      }))
  );

  return {
    status: "ok",
    uploadId: uploadRow.upload_id,
    snapshotDate,
    counts: {
      portfolios: bulkPortfolios.length,
      campaigns: bulkCampaigns.length,
      adGroups: bulkAdGroups.length,
      targets: bulkTargets.length,
      placements: bulkPlacements.length,
      nameHistoryInserted,
      nameHistoryClosed,
    },
  };
}
