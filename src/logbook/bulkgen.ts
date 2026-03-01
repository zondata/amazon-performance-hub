import { normText } from "../bulk/parseSponsoredProductsBulk";
import { UploadRow as SpUploadRow } from "../bulksheet_gen_sp/buildUploadRows";
import { UploadRow as SbUploadRow } from "../bulksheet_gen_sb/buildUploadRows";
import { FetchCurrentResult } from "../bulksheet_gen_sp/fetchCurrent";
import { FetchCurrentSbResult, CurrentSbPlacement } from "../bulksheet_gen_sb/fetchCurrent";
import { SpCreateManifest } from "../bulksheet_gen_sp_create/manifest";
import { LogChangeEntityInput, LogChangeInput } from "./types";
import {
  findLogChangeByDedupeKey,
  insertLogChangeEntities,
  linkExperimentChange,
  upsertLogChangeWithDedupe,
} from "./db";

type BulkgenOutputPaths = {
  uploadPath: string;
  reviewPath: string;
};

export type BulkgenLogEntry = {
  dedupeKey: string;
  change: LogChangeInput;
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === "number" ? value : Number(String(value));
  return Number.isFinite(num) ? num : null;
}

function toOptionalString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text.length ? text : undefined;
}

function buildDedupeKey(params: {
  runId: string;
  generator: string;
  entity: string;
  campaignId: string;
  adGroupId: string;
  targetId: string;
  placementRaw: string;
}): string {
  const placementNorm = params.placementRaw ? normText(params.placementRaw) : "";
  return [
    params.runId,
    params.generator,
    params.entity,
    params.campaignId,
    params.adGroupId,
    params.targetId,
    placementNorm,
  ].join("::");
}

function buildCreateDedupeKey(params: {
  runId: string;
  generator: string;
  entity: string;
  campaignName: string;
  adGroupName: string;
  keywordText: string;
  matchType: string;
  sku: string;
  asin: string;
}): string {
  return [
    params.runId,
    params.generator,
    params.entity,
    normText(params.campaignName),
    normText(params.adGroupName),
    normText(params.keywordText),
    normText(params.matchType),
    normText(params.sku),
    normText(params.asin),
  ].join("::");
}

function buildEntityLinks(params: {
  entity: string;
  campaignId: string;
  adGroupId: string;
  targetId: string;
  productId?: string;
  placementCode?: string;
  placementRawNorm?: string;
  placementRaw?: string;
}): LogChangeEntityInput[] {
  const links: LogChangeEntityInput[] = [];
  if (params.entity === "Campaign") {
    links.push({
      entity_type: "campaign",
      product_id: params.productId,
      campaign_id: params.campaignId,
    });
    return links;
  }
  if (params.entity === "Ad Group") {
    links.push({
      entity_type: "ad_group",
      product_id: params.productId,
      campaign_id: params.campaignId,
      ad_group_id: params.adGroupId,
    });
    return links;
  }
  if (params.entity.includes("Keyword") || params.entity.includes("Targeting")) {
    links.push({
      entity_type: "target",
      product_id: params.productId,
      campaign_id: params.campaignId,
      ad_group_id: params.adGroupId,
      target_id: params.targetId,
    });
    return links;
  }
  if (params.entity.includes("Bidding Adjustment")) {
    links.push({
      entity_type: "placement",
      product_id: params.productId,
      campaign_id: params.campaignId,
      extra: {
        placement_code: params.placementCode ?? null,
        placement_raw_norm: params.placementRawNorm ?? null,
        placement_raw: params.placementRaw ?? null,
      },
    });
  }
  return links;
}

function buildSummary(params: {
  channelLabel: string;
  entity: string;
  targetId: string;
  campaignId: string;
  adGroupId: string;
  placementRaw: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}): string {
  const parts: string[] = [];
  const addField = (label: string, key: string) => {
    const beforeValue = params.before[key];
    const afterValue = params.after[key];
    if (afterValue === undefined) return;
    if (beforeValue === undefined || beforeValue === null) {
      parts.push(`${label} -> ${afterValue}`);
      return;
    }
    parts.push(`${label} ${beforeValue} -> ${afterValue}`);
  };

  if (params.entity === "Campaign") {
    addField("budget", "daily_budget");
    addField("state", "state");
    addField("bidding_strategy", "bidding_strategy");
    return `${params.channelLabel} campaign update: campaign_id=${params.campaignId} ${parts.join(
      "; "
    )}`.trim();
  }
  if (params.entity === "Ad Group") {
    addField("state", "state");
    addField("default_bid", "default_bid");
    return `${params.channelLabel} ad group update: ad_group_id=${
      params.adGroupId
    } ${parts.join("; ")}`.trim();
  }
  if (params.entity.includes("Keyword") || params.entity.includes("Targeting")) {
    addField("bid", "bid");
    addField("state", "state");
    return `${params.channelLabel} target update: target_id=${
      params.targetId
    } ${parts.join("; ")}`.trim();
  }
  if (params.entity.includes("Bidding Adjustment")) {
    addField("percentage", "percentage");
    return `${params.channelLabel} placement update: campaign_id=${params.campaignId} placement=${params.placementRaw} ${parts.join(
      "; "
    )}`.trim();
  }
  return `${params.channelLabel} bulk update: campaign_id=${params.campaignId}`.trim();
}

function buildChangeType(entity: string): string {
  if (entity === "Campaign") return "bulk_update_campaign";
  if (entity === "Ad Group") return "bulk_update_ad_group";
  if (entity.includes("Keyword") || entity.includes("Targeting")) return "bulk_update_target";
  if (entity.includes("Bidding Adjustment")) return "bulk_update_placement";
  return "bulk_update";
}

function buildAfterJson(params: {
  runId: string;
  generator: string;
  outputPaths: BulkgenOutputPaths;
  finalPlanPackId?: string;
  fields: Record<string, unknown>;
  dedupeKey: string;
}): Record<string, unknown> {
  return {
    ...params.fields,
    run_id: params.runId,
    generator: params.generator,
    upload_path: params.outputPaths.uploadPath,
    review_path: params.outputPaths.reviewPath,
    dedupe_key: params.dedupeKey,
    ...(params.finalPlanPackId ? { final_plan_pack_id: params.finalPlanPackId } : {}),
  };
}

function findSbPlacementByRaw(params: {
  current: FetchCurrentSbResult;
  campaignId: string;
  placementRaw: string;
}): CurrentSbPlacement | null {
  const placementNorm = normText(params.placementRaw);
  for (const placement of params.current.placementsByKey.values()) {
    if (
      placement.campaign_id === params.campaignId &&
      placement.placement_raw_norm === placementNorm
    ) {
      return placement;
    }
  }
  return null;
}

export function buildSpBulkgenLogEntries(params: {
  rows: SpUploadRow[];
  current: FetchCurrentResult;
  runId: string;
  generator: string;
  outputPaths: BulkgenOutputPaths;
  productId?: string;
  finalPlanPackId?: string;
}): BulkgenLogEntry[] {
  const entries: BulkgenLogEntry[] = [];
  const channelLabel = "SP";

  for (const row of params.rows) {
    const entity = String(row.cells["Entity"] ?? "");
    const campaignId = String(row.cells["Campaign ID"] ?? "");
    const adGroupId = String(row.cells["Ad Group ID"] ?? "");
    const keywordId = String(row.cells["Keyword ID"] ?? "");
    const productTargetId = String(row.cells["Product Targeting ID"] ?? "");
    const targetId = keywordId || productTargetId;
    const placementRaw = String(row.cells["Placement"] ?? "");

    const dedupeKey = buildDedupeKey({
      runId: params.runId,
      generator: params.generator,
      entity,
      campaignId,
      adGroupId,
      targetId,
      placementRaw,
    });

    const before: Record<string, unknown> = {};
    const afterFields: Record<string, unknown> = {};

    if (entity === "Campaign") {
      const campaign = params.current.campaignsById.get(campaignId);
      if (campaign) {
        before.daily_budget = campaign.daily_budget ?? null;
        before.state = campaign.state ?? null;
        before.bidding_strategy = campaign.bidding_strategy ?? null;
      }
      const dailyBudget = toNumber(row.cells["Daily Budget"]);
      if (dailyBudget !== null) afterFields.daily_budget = dailyBudget;
      if (row.cells.State !== undefined && row.cells.State !== null && row.cells.State !== "") {
        afterFields.state = row.cells.State;
      }
      if (
        row.cells["Bidding Strategy"] !== undefined &&
        row.cells["Bidding Strategy"] !== null &&
        row.cells["Bidding Strategy"] !== ""
      ) {
        afterFields.bidding_strategy = row.cells["Bidding Strategy"];
      }
    } else if (entity === "Ad Group") {
      const adGroup = params.current.adGroupsById.get(adGroupId);
      if (adGroup) {
        before.state = adGroup.state ?? null;
        before.default_bid = adGroup.default_bid ?? null;
      }
      if (row.cells.State !== undefined && row.cells.State !== null && row.cells.State !== "") {
        afterFields.state = row.cells.State;
      }
      const defaultBid = toNumber(row.cells["Ad Group Default Bid"]);
      if (defaultBid !== null) afterFields.default_bid = defaultBid;
    } else if (entity.includes("Keyword") || entity.includes("Targeting")) {
      const target = params.current.targetsById.get(targetId);
      if (target) {
        before.state = target.state ?? null;
        before.bid = target.bid ?? null;
        before.match_type = target.match_type;
        before.expression_raw = target.expression_raw;
      }
      const bid = toNumber(row.cells.Bid);
      if (bid !== null) afterFields.bid = bid;
      if (row.cells.State !== undefined && row.cells.State !== null && row.cells.State !== "") {
        afterFields.state = row.cells.State;
      }
    } else if (entity.includes("Bidding Adjustment")) {
      const placementNorm = normText(placementRaw);
      const placement = [...params.current.placementsByKey.values()].find(
        (value) =>
          value.campaign_id === campaignId &&
          normText(value.placement_raw || value.placement_code) === placementNorm
      );
      if (placement) {
        before.percentage = placement.percentage ?? null;
        before.placement_code = placement.placement_code;
        before.placement_raw_norm = normText(placement.placement_raw || placement.placement_code);
        afterFields.placement_code = placement.placement_code;
        afterFields.placement_raw_norm = normText(
          placement.placement_raw || placement.placement_code
        );
        afterFields.placement_raw = placement.placement_raw || null;
      }
      const percentage = toNumber(row.cells.Percentage);
      if (percentage !== null) afterFields.percentage = percentage;
    }

    const after = buildAfterJson({
      runId: params.runId,
      generator: params.generator,
      outputPaths: params.outputPaths,
      finalPlanPackId: params.finalPlanPackId,
      fields: afterFields,
      dedupeKey,
    });

    const change: LogChangeInput = {
      channel: "ads",
      change_type: buildChangeType(entity),
      summary: buildSummary({
        channelLabel,
        entity,
        targetId,
        campaignId,
        adGroupId,
        placementRaw,
        before,
        after: afterFields,
      }),
      before_json: before,
      after_json: after,
      source: "bulkgen",
      dedupe_key: dedupeKey,
      entities: buildEntityLinks({
        entity,
        campaignId,
        adGroupId,
        targetId,
        productId: params.productId,
        placementCode: toOptionalString(afterFields.placement_code),
        placementRawNorm: toOptionalString(afterFields.placement_raw_norm),
        placementRaw: toOptionalString(afterFields.placement_raw),
      }),
    };

    entries.push({ dedupeKey, change });
  }

  return entries;
}

export function buildSbBulkgenLogEntries(params: {
  rows: SbUploadRow[];
  current: FetchCurrentSbResult;
  runId: string;
  generator: string;
  outputPaths: BulkgenOutputPaths;
  productId?: string;
  finalPlanPackId?: string;
}): BulkgenLogEntry[] {
  const entries: BulkgenLogEntry[] = [];
  const channelLabel = "SB";

  for (const row of params.rows) {
    const entity = String(row.cells["Entity"] ?? "");
    const campaignId = String(row.cells["Campaign ID"] ?? "");
    const adGroupId = String(row.cells["Ad Group ID"] ?? "");
    const keywordId = String(row.cells["Keyword ID"] ?? "");
    const productTargetId = String(row.cells["Product Targeting ID"] ?? "");
    const targetId = keywordId || productTargetId;
    const placementRaw = String(row.cells["Placement"] ?? "");

    const dedupeKey = buildDedupeKey({
      runId: params.runId,
      generator: params.generator,
      entity,
      campaignId,
      adGroupId,
      targetId,
      placementRaw,
    });

    const before: Record<string, unknown> = {};
    const afterFields: Record<string, unknown> = {};

    if (entity === "Campaign") {
      const campaign = params.current.campaignsById.get(campaignId);
      if (campaign) {
        before.daily_budget = campaign.daily_budget ?? null;
        before.state = campaign.state ?? null;
        before.bidding_strategy = campaign.bidding_strategy ?? null;
      }
      const budget = toNumber(row.cells["Daily Budget"] ?? row.cells.Budget);
      if (budget !== null) afterFields.daily_budget = budget;
      if (row.cells.State !== undefined && row.cells.State !== null && row.cells.State !== "") {
        afterFields.state = row.cells.State;
      }
      if (
        row.cells["Bidding Strategy"] !== undefined &&
        row.cells["Bidding Strategy"] !== null &&
        row.cells["Bidding Strategy"] !== ""
      ) {
        afterFields.bidding_strategy = row.cells["Bidding Strategy"];
      }
    } else if (entity === "Ad Group") {
      const adGroup = params.current.adGroupsById.get(adGroupId);
      if (adGroup) {
        before.state = adGroup.state ?? null;
        before.default_bid = adGroup.default_bid ?? null;
      }
      if (row.cells.State !== undefined && row.cells.State !== null && row.cells.State !== "") {
        afterFields.state = row.cells.State;
      }
      const defaultBid = toNumber(row.cells["Ad Group Default Bid"]);
      if (defaultBid !== null) afterFields.default_bid = defaultBid;
    } else if (entity.includes("Keyword") || entity.includes("Targeting")) {
      const target = params.current.targetsById.get(targetId);
      if (target) {
        before.state = target.state ?? null;
        before.bid = target.bid ?? null;
        before.match_type = target.match_type;
        before.expression_raw = target.expression_raw;
      }
      const bid = toNumber(row.cells.Bid);
      if (bid !== null) afterFields.bid = bid;
      if (row.cells.State !== undefined && row.cells.State !== null && row.cells.State !== "") {
        afterFields.state = row.cells.State;
      }
    } else if (entity.includes("Bidding Adjustment")) {
      const placement = findSbPlacementByRaw({
        current: params.current,
        campaignId,
        placementRaw,
      });
      if (placement) {
        before.percentage = placement.percentage ?? null;
        before.placement_code = placement.placement_code;
        before.placement_raw_norm = placement.placement_raw_norm;
        afterFields.placement_code = placement.placement_code;
        afterFields.placement_raw_norm = placement.placement_raw_norm;
        afterFields.placement_raw = placement.placement_raw;
      }
      const percentage = toNumber(row.cells.Percentage);
      if (percentage !== null) afterFields.percentage = percentage;
    }

    const after = buildAfterJson({
      runId: params.runId,
      generator: params.generator,
      outputPaths: params.outputPaths,
      finalPlanPackId: params.finalPlanPackId,
      fields: afterFields,
      dedupeKey,
    });

    const change: LogChangeInput = {
      channel: "ads",
      change_type: buildChangeType(entity),
      summary: buildSummary({
        channelLabel,
        entity,
        targetId,
        campaignId,
        adGroupId,
        placementRaw,
        before,
        after: afterFields,
      }),
      before_json: before,
      after_json: after,
      source: "bulkgen",
      dedupe_key: dedupeKey,
      entities: buildEntityLinks({
        entity,
        campaignId,
        adGroupId,
        targetId,
        productId: params.productId,
        placementCode: toOptionalString(afterFields.placement_code),
        placementRawNorm: toOptionalString(afterFields.placement_raw_norm),
        placementRaw: toOptionalString(afterFields.placement_raw),
      }),
    };

    entries.push({ dedupeKey, change });
  }

  return entries;
}

export function buildSpBulkgenCreateLogEntries(params: {
  manifest: SpCreateManifest;
  runId: string;
  generator: string;
  outputPaths: BulkgenOutputPaths;
}): BulkgenLogEntry[] {
  const entries: BulkgenLogEntry[] = [];
  const channelLabel = "SP";

  for (const campaign of params.manifest.campaigns) {
    const dedupeKey = buildCreateDedupeKey({
      runId: params.runId,
      generator: params.generator,
      entity: "Campaign",
      campaignName: campaign.name,
      adGroupName: "",
      keywordText: "",
      matchType: "",
      sku: "",
      asin: "",
    });
    const after = buildAfterJson({
      runId: params.runId,
      generator: params.generator,
      outputPaths: params.outputPaths,
      fields: { campaign_name: campaign.name },
      dedupeKey,
    });
    entries.push({
      dedupeKey,
      change: {
        channel: "ads",
        change_type: "bulk_create_campaign",
        summary: `${channelLabel} campaign create: campaign_name=${campaign.name}`,
        before_json: null,
        after_json: after,
        source: "bulkgen",
        dedupe_key: dedupeKey,
        entities: [],
      },
    });
  }

  for (const adGroup of params.manifest.ad_groups) {
    const dedupeKey = buildCreateDedupeKey({
      runId: params.runId,
      generator: params.generator,
      entity: "Ad Group",
      campaignName: adGroup.campaign_name,
      adGroupName: adGroup.ad_group_name,
      keywordText: "",
      matchType: "",
      sku: "",
      asin: "",
    });
    const after = buildAfterJson({
      runId: params.runId,
      generator: params.generator,
      outputPaths: params.outputPaths,
      fields: {
        campaign_name: adGroup.campaign_name,
        ad_group_name: adGroup.ad_group_name,
      },
      dedupeKey,
    });
    entries.push({
      dedupeKey,
      change: {
        channel: "ads",
        change_type: "bulk_create_ad_group",
        summary: `${channelLabel} ad group create: ad_group_name=${adGroup.ad_group_name}`,
        before_json: null,
        after_json: after,
        source: "bulkgen",
        dedupe_key: dedupeKey,
        entities: [],
      },
    });
  }

  for (const productAd of params.manifest.product_ads) {
    const dedupeKey = buildCreateDedupeKey({
      runId: params.runId,
      generator: params.generator,
      entity: "Product Ad",
      campaignName: productAd.campaign_name,
      adGroupName: productAd.ad_group_name,
      keywordText: "",
      matchType: "",
      sku: productAd.sku ?? "",
      asin: productAd.asin ?? "",
    });
    const after = buildAfterJson({
      runId: params.runId,
      generator: params.generator,
      outputPaths: params.outputPaths,
      fields: {
        campaign_name: productAd.campaign_name,
        ad_group_name: productAd.ad_group_name,
        sku: productAd.sku ?? null,
        asin: productAd.asin ?? null,
      },
      dedupeKey,
    });
    entries.push({
      dedupeKey,
      change: {
        channel: "ads",
        change_type: "bulk_create_product_ad",
        summary: `${channelLabel} product ad create: ad_group_name=${productAd.ad_group_name}`,
        before_json: null,
        after_json: after,
        source: "bulkgen",
        dedupe_key: dedupeKey,
        entities: [],
      },
    });
  }

  for (const keyword of params.manifest.keywords) {
    const dedupeKey = buildCreateDedupeKey({
      runId: params.runId,
      generator: params.generator,
      entity: "Keyword",
      campaignName: keyword.campaign_name,
      adGroupName: keyword.ad_group_name,
      keywordText: keyword.keyword_text,
      matchType: keyword.match_type,
      sku: "",
      asin: "",
    });
    const after = buildAfterJson({
      runId: params.runId,
      generator: params.generator,
      outputPaths: params.outputPaths,
      fields: {
        campaign_name: keyword.campaign_name,
        ad_group_name: keyword.ad_group_name,
        keyword_text: keyword.keyword_text,
        match_type: keyword.match_type,
        bid: keyword.bid,
      },
      dedupeKey,
    });
    entries.push({
      dedupeKey,
      change: {
        channel: "ads",
        change_type: "bulk_create_keyword",
        summary: `${channelLabel} keyword create: keyword_text=${keyword.keyword_text}`,
        before_json: null,
        after_json: after,
        source: "bulkgen",
        dedupe_key: dedupeKey,
        entities: [],
      },
    });
  }

  return entries;
}

export async function writeBulkgenLogs(params: {
  accountId: string;
  marketplace: string;
  entries: BulkgenLogEntry[];
  experimentId?: string;
}): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  for (const entry of params.entries) {
    const existing = await findLogChangeByDedupeKey({
      accountId: params.accountId,
      dedupeKey: entry.dedupeKey,
    });

    const changeRow = await upsertLogChangeWithDedupe({
      accountId: params.accountId,
      marketplace: params.marketplace,
      input: entry.change,
    });

    if (!existing) {
      created += 1;
      await insertLogChangeEntities({
        changeId: changeRow.change_id,
        entities: entry.change.entities,
      });
    } else {
      skipped += 1;
    }

    if (params.experimentId) {
      await linkExperimentChange({
        experimentId: params.experimentId,
        changeId: changeRow.change_id,
      });
    }
  }

  return { created, skipped };
}
