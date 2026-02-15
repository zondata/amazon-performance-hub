import { normText } from "../bulk/parseSponsoredProductsBulk";
import crypto from "node:crypto";
import {
  CreateAdGroupAction,
  CreateCampaignAction,
  CreateKeywordAction,
  CreateProductAdAction,
  SpCreateAction,
  SpCreateResolvedRefs,
} from "./types";

export const SP_CREATE_SHEET_NAME = "Sponsored Products Campaigns";

export type UploadRow = {
  sheetName: string;
  cells: Record<string, string | number | boolean | null>;
  review: Record<string, string | number | boolean | null>;
};

const ALLOWED_STATES = new Set(["enabled", "paused", "archived"]);

function parseNonNegativeNumber(value: unknown, label: string): number {
  const num = typeof value === "number" ? value : Number(String(value));
  if (!Number.isFinite(num)) throw new Error(`Invalid ${label}: ${value}`);
  if (num < 0) throw new Error(`Invalid ${label}: ${value} (negative)`);
  return num;
}

function normalizeStateForCreate(value: string | undefined, allowEnabled: boolean): string {
  const raw = String(value ?? "Paused").trim();
  const lower = raw.toLowerCase();
  if (!ALLOWED_STATES.has(lower)) {
    throw new Error(`Invalid state: ${raw}. Allowed: enabled, paused, archived.`);
  }
  if (lower === "enabled" && !allowEnabled) {
    throw new Error("Enabled state requires --allow-enabled.");
  }
  return lower[0].toUpperCase() + lower.slice(1);
}

function ensureNonEmpty(value: string | null | undefined, label: string): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) throw new Error(`Missing ${label}`);
  return trimmed;
}

function resolveCampaignName(
  action: { campaign_name?: string; campaign_temp_id?: string },
  refs: SpCreateResolvedRefs
): string {
  if (action.campaign_name) return action.campaign_name.trim();
  if (action.campaign_temp_id) {
    const name = refs.campaignsByTempId.get(action.campaign_temp_id);
    if (!name) {
      throw new Error(`Unknown campaign_temp_id: ${action.campaign_temp_id}`);
    }
    return name;
  }
  throw new Error("Missing campaign_name or campaign_temp_id");
}

function resolveCampaignTempId(
  action: { campaign_name?: string; campaign_temp_id?: string; name?: string },
  refs: SpCreateResolvedRefs
): string {
  if (action.campaign_temp_id) return action.campaign_temp_id;
  const name = action.name ? action.name.trim() : resolveCampaignName(action, refs);
  const tempId = refs.campaignsByName.get(normText(name));
  if (!tempId) {
    throw new Error(`Missing temp campaign ID for campaign_name: ${name}`);
  }
  return tempId;
}

function resolveAdGroupName(
  action: { ad_group_name?: string; ad_group_temp_id?: string },
  refs: SpCreateResolvedRefs
): string {
  if (action.ad_group_name) return action.ad_group_name.trim();
  if (action.ad_group_temp_id) {
    const ref = refs.adGroupsByTempId.get(action.ad_group_temp_id);
    if (!ref) {
      throw new Error(`Unknown ad_group_temp_id: ${action.ad_group_temp_id}`);
    }
    return ref.adGroupName;
  }
  throw new Error("Missing ad_group_name or ad_group_temp_id");
}

function resolveAdGroupTempId(
  action: { ad_group_name?: string; ad_group_temp_id?: string; campaign_name?: string; campaign_temp_id?: string },
  refs: SpCreateResolvedRefs
): string {
  if (action.ad_group_temp_id) return action.ad_group_temp_id;
  const campaignName = resolveCampaignName(action, refs);
  const adGroupName = resolveAdGroupName(action, refs);
  const key = `${normText(campaignName)}::${normText(adGroupName)}`;
  const tempId = refs.adGroupsByKey.get(key);
  if (!tempId) {
    throw new Error(`Missing temp ad group ID for ${campaignName} / ${adGroupName}`);
  }
  return tempId;
}

function resolveAdGroupCampaignName(
  action: { ad_group_name?: string; ad_group_temp_id?: string },
  refs: SpCreateResolvedRefs
): string {
  if (action.ad_group_temp_id) {
    const ref = refs.adGroupsByTempId.get(action.ad_group_temp_id);
    if (!ref) {
      throw new Error(`Unknown ad_group_temp_id: ${action.ad_group_temp_id}`);
    }
    return ref.campaignName;
  }
  return "";
}

function buildCampaignRow(
  action: CreateCampaignAction,
  params: {
    allowEnabled: boolean;
    maxBudget: number;
    notes?: string;
    portfolioId?: string;
    availableHeaders?: Set<string>;
    campaignTempId: string;
  }
): UploadRow {
  const targetingType = (() => {
    const raw = String(action.targeting_type ?? "").trim();
    if (!raw) throw new Error("Missing targeting_type for create_campaign");
    const lower = raw.toLowerCase();
    if (lower === "auto") return "Auto";
    if (lower === "manual") return "Manual";
    throw new Error(`Invalid targeting_type: ${raw}. Allowed: auto, manual.`);
  })();
  const name = ensureNonEmpty(action.name, "campaign name");
  const dailyBudget = parseNonNegativeNumber(action.daily_budget, "daily_budget");
  if (dailyBudget > params.maxBudget) {
    throw new Error(`daily_budget exceeds max budget cap (${params.maxBudget})`);
  }
  const state = normalizeStateForCreate(action.state, params.allowEnabled);
  const biddingStrategy = String(action.bidding_strategy ?? "").trim();

  const cells: Record<string, string | number | boolean | null> = {
    Product: "Sponsored Products",
    Entity: "Campaign",
    Operation: "Create",
    "Campaign ID": params.campaignTempId,
    "Campaign Name": name,
    "Daily Budget": dailyBudget,
    State: state,
    "Targeting Type": targetingType,
  };
  if (biddingStrategy) {
    cells["Bidding Strategy"] = biddingStrategy;
  }
  if (params.portfolioId) {
    if (!params.availableHeaders?.has("Portfolio ID")) {
      throw new Error("Template missing required column for --portfolio-id: Portfolio ID");
    }
    cells["Portfolio ID"] = params.portfolioId;
  }

  return {
    sheetName: SP_CREATE_SHEET_NAME,
    cells,
    review: {
      action_type: action.type,
      notes: params.notes ?? "",
      current_value: null,
      new_value: dailyBudget,
      delta: null,
    },
  };
}

function buildAdGroupRow(
  action: CreateAdGroupAction,
  params: {
    refs: SpCreateResolvedRefs;
    allowEnabled: boolean;
    maxBid: number;
    notes?: string;
    campaignTempId: string;
    adGroupTempId: string;
  }
): UploadRow {
  const campaignName = resolveCampaignName(action, params.refs);
  const adGroupName = ensureNonEmpty(action.ad_group_name, "ad group name");
  const state = normalizeStateForCreate(action.state, params.allowEnabled);

  const cells: Record<string, string | number | boolean | null> = {
    Product: "Sponsored Products",
    Entity: "Ad Group",
    Operation: "Create",
    "Campaign ID": params.campaignTempId,
    "Campaign Name": campaignName,
    "Ad Group ID": params.adGroupTempId,
    "Ad Group Name": adGroupName,
    State: state,
  };

  if (action.default_bid !== undefined && action.default_bid !== null) {
    const bid = parseNonNegativeNumber(action.default_bid, "default_bid");
    if (bid > params.maxBid) {
      throw new Error(`default_bid exceeds max bid cap (${params.maxBid})`);
    }
    cells["Ad Group Default Bid"] = bid;
  }

  return {
    sheetName: SP_CREATE_SHEET_NAME,
    cells,
    review: {
      action_type: action.type,
      notes: params.notes ?? "",
      current_value: null,
      new_value: action.default_bid ?? null,
      delta: null,
    },
  };
}

function buildProductAdRow(
  action: CreateProductAdAction,
  params: {
    refs: SpCreateResolvedRefs;
    notes?: string;
    allowEnabled: boolean;
    campaignTempId: string;
    adGroupTempId: string;
  }
): UploadRow {
  const campaignName = resolveCampaignName(action, params.refs);
  const adGroupName = resolveAdGroupName(action, params.refs);
  const sku = String(action.sku ?? "").trim();
  const asin = String(action.asin ?? "").trim();
  if (!sku && !asin) {
    throw new Error("create_product_ad requires sku or asin");
  }
  const state = normalizeStateForCreate(action.state, params.allowEnabled);

  const cells: Record<string, string | number | boolean | null> = {
    Product: "Sponsored Products",
    Entity: "Product Ad",
    Operation: "Create",
    "Campaign ID": params.campaignTempId,
    "Campaign Name": campaignName,
    "Ad Group ID": params.adGroupTempId,
    "Ad Group Name": adGroupName,
    State: state,
  };
  if (sku) cells.SKU = sku;
  if (asin) cells.ASIN = asin;

  return {
    sheetName: SP_CREATE_SHEET_NAME,
    cells,
    review: {
      action_type: action.type,
      notes: params.notes ?? "",
      current_value: null,
      new_value: sku || asin,
      delta: null,
    },
  };
}

function buildKeywordRow(
  action: CreateKeywordAction,
  params: {
    refs: SpCreateResolvedRefs;
    allowEnabled: boolean;
    maxBid: number;
    notes?: string;
    campaignTempId: string;
    adGroupTempId: string;
  }
): UploadRow {
  const campaignName = resolveCampaignName(action, params.refs);
  const adGroupName = resolveAdGroupName(action, params.refs);
  const keywordText = ensureNonEmpty(action.keyword_text, "keyword_text");
  const matchType = ensureNonEmpty(action.match_type, "match_type");
  const bid = parseNonNegativeNumber(action.bid, "bid");
  if (bid > params.maxBid) {
    throw new Error(`bid exceeds max bid cap (${params.maxBid})`);
  }
  const state = normalizeStateForCreate(action.state, params.allowEnabled);

  const cells: Record<string, string | number | boolean | null> = {
    Product: "Sponsored Products",
    Entity: "Keyword",
    Operation: "Create",
    "Campaign ID": params.campaignTempId,
    "Campaign Name": campaignName,
    "Ad Group ID": params.adGroupTempId,
    "Ad Group Name": adGroupName,
    "Keyword Text": keywordText,
    "Match Type": matchType,
    Bid: bid,
    State: state,
  };

  return {
    sheetName: SP_CREATE_SHEET_NAME,
    cells,
    review: {
      action_type: action.type,
      notes: params.notes ?? "",
      current_value: null,
      new_value: bid,
      delta: null,
    },
  };
}

function mergeKeyForRow(row: UploadRow): string {
  const cells = row.cells;
  const entity = String(cells["Entity"] ?? "");
  const campaignName = normText(cells["Campaign Name"] ?? "");
  const adGroupName = normText(cells["Ad Group Name"] ?? "");
  const keywordText = normText(cells["Keyword Text"] ?? "");
  const matchType = normText(cells["Match Type"] ?? "");
  const sku = normText(cells.SKU ?? "");
  const asin = normText(cells.ASIN ?? "");
  return [row.sheetName, entity, campaignName, adGroupName, keywordText, matchType, sku, asin].join(
    "||"
  );
}

function mergeRows(rows: UploadRow[]): UploadRow[] {
  const merged: UploadRow[] = [];
  const indexByKey = new Map<string, number>();

  for (const row of rows) {
    const key = mergeKeyForRow(row);
    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      merged.push({ ...row, cells: { ...row.cells }, review: { ...row.review } });
      indexByKey.set(key, merged.length - 1);
      continue;
    }

    const existing = merged[existingIndex];
    merged[existingIndex] = {
      sheetName: existing.sheetName,
      cells: { ...existing.cells, ...row.cells },
      review: {
        ...existing.review,
        action_type: `${existing.review.action_type}+${row.review.action_type}`,
      },
    };
  }

  return merged;
}

function sortRows(rows: UploadRow[]): UploadRow[] {
  const entityOrder = ["Campaign", "Ad Group", "Product Ad", "Keyword"];
  const entityRank = new Map(entityOrder.map((entity, idx) => [entity, idx]));

  return [...rows].sort((a, b) => {
    const aEntity = String(a.cells["Entity"] ?? "");
    const bEntity = String(b.cells["Entity"] ?? "");
    const aRank = entityRank.get(aEntity) ?? 999;
    const bRank = entityRank.get(bEntity) ?? 999;
    if (aRank !== bRank) return aRank - bRank;

    const aCampaign = String(a.cells["Campaign Name"] ?? "");
    const bCampaign = String(b.cells["Campaign Name"] ?? "");
    if (aCampaign !== bCampaign) return aCampaign.localeCompare(bCampaign);

    const aAdGroup = String(a.cells["Ad Group Name"] ?? "");
    const bAdGroup = String(b.cells["Ad Group Name"] ?? "");
    if (aAdGroup !== bAdGroup) return aAdGroup.localeCompare(bAdGroup);

    const aKeyword = String(a.cells["Keyword Text"] ?? "");
    const bKeyword = String(b.cells["Keyword Text"] ?? "");
    if (aKeyword !== bKeyword) return aKeyword.localeCompare(bKeyword);

    const aSku = String(a.cells.SKU ?? "");
    const bSku = String(b.cells.SKU ?? "");
    if (aSku !== bSku) return aSku.localeCompare(bSku);

    const aAsin = String(a.cells.ASIN ?? "");
    const bAsin = String(b.cells.ASIN ?? "");
    return aAsin.localeCompare(bAsin);
  });
}

function shortHash(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 8);
}

function generateCampaignTempId(runId: string, campaignName: string): string {
  const hash = shortHash(`${runId}::campaign::${normText(campaignName)}`);
  return `TMP-CAMP-${hash}`;
}

function generateAdGroupTempId(
  runId: string,
  campaignName: string,
  adGroupName: string
): string {
  const hash = shortHash(
    `${runId}::adgroup::${normText(campaignName)}::${normText(adGroupName)}`
  );
  return `TMP-AG-${hash}`;
}

export function resolveCreateRefs(
  actions: SpCreateAction[],
  runId: string
): SpCreateResolvedRefs {
  const campaignsByTempId = new Map<string, string>();
  const campaignsByName = new Map<string, string>();
  const adGroupsByTempId = new Map<string, { campaignName: string; adGroupName: string }>();
  const adGroupsByKey = new Map<string, string>();

  for (const action of actions) {
    if (action.type === "create_campaign" && action.temp_id) {
      if (campaignsByTempId.has(action.temp_id)) {
        throw new Error(`Duplicate campaign temp_id: ${action.temp_id}`);
      }
      campaignsByTempId.set(action.temp_id, action.name.trim());
    }
  }

  for (const action of actions) {
    if (action.type === "create_campaign") {
      const name = action.name.trim();
      const nameKey = normText(name);
      if (campaignsByName.has(nameKey)) continue;
      const tempId = action.temp_id ?? generateCampaignTempId(runId, name);
      campaignsByName.set(nameKey, tempId);
      if (!campaignsByTempId.has(tempId)) {
        campaignsByTempId.set(tempId, name);
      }
    }
  }

  const refs: SpCreateResolvedRefs = {
    campaignsByTempId,
    campaignsByName,
    adGroupsByTempId,
    adGroupsByKey,
  };

  for (const action of actions) {
    if (action.type === "create_ad_group" && action.temp_id) {
      if (adGroupsByTempId.has(action.temp_id)) {
        throw new Error(`Duplicate ad_group temp_id: ${action.temp_id}`);
      }
      const campaignName = resolveCampaignName(action, refs);
      adGroupsByTempId.set(action.temp_id, {
        campaignName,
        adGroupName: action.ad_group_name.trim(),
      });
    }
  }

  for (const action of actions) {
    if (action.type === "create_ad_group") {
      const campaignName = resolveCampaignName(action, refs);
      const adGroupName = action.ad_group_name.trim();
      const key = `${normText(campaignName)}::${normText(adGroupName)}`;
      if (adGroupsByKey.has(key)) continue;
      const tempId = action.temp_id ?? generateAdGroupTempId(runId, campaignName, adGroupName);
      adGroupsByKey.set(key, tempId);
      if (!adGroupsByTempId.has(tempId)) {
        adGroupsByTempId.set(tempId, { campaignName, adGroupName });
      }
    }
  }

  return { campaignsByTempId, campaignsByName, adGroupsByTempId, adGroupsByKey };
}

export function buildUploadRows(params: {
  actions: SpCreateAction[];
  refs: SpCreateResolvedRefs;
  allowEnabled: boolean;
  maxBudget: number;
  maxBid: number;
  portfolioId?: string;
  availableHeaders?: Set<string>;
  runId: string;
  notes?: string;
}): UploadRow[] {
  const rows: UploadRow[] = [];
  const { refs } = params;

  const hasAutoCampaign = params.actions.some(
    (action) =>
      action.type === "create_campaign" &&
      String((action as CreateCampaignAction).targeting_type ?? "")
        .trim()
        .toLowerCase() === "auto"
  );
  const hasKeyword = params.actions.some((action) => action.type === "create_keyword");
  if (hasAutoCampaign && hasKeyword) {
    throw new Error(
      "Auto targeting campaigns cannot include create_keyword actions. Use Manual targeting."
    );
  }

  for (const action of params.actions) {
    if (action.type === "create_campaign") {
      const campaignTempId = resolveCampaignTempId(action, refs);
      rows.push(buildCampaignRow(action, { ...params, campaignTempId }));
      continue;
    }
    if (action.type === "create_ad_group") {
      const campaignTempId = resolveCampaignTempId(action, refs);
      const adGroupTempId = action.temp_id ?? resolveAdGroupTempId(action, refs);
      rows.push(buildAdGroupRow(action, { ...params, refs, campaignTempId, adGroupTempId }));
      continue;
    }
    if (action.type === "create_product_ad") {
      const campaignName = resolveCampaignName(action, refs);
      if (action.ad_group_temp_id) {
        const refCampaign = resolveAdGroupCampaignName(action, refs);
        if (refCampaign && refCampaign !== campaignName) {
          throw new Error(
            `ad_group_temp_id campaign mismatch for create_product_ad: ${action.ad_group_temp_id}`
          );
        }
      }
      const campaignTempId = resolveCampaignTempId(action, refs);
      const adGroupTempId = resolveAdGroupTempId(action, refs);
      rows.push(
        buildProductAdRow(action, {
          refs,
          notes: params.notes,
          allowEnabled: params.allowEnabled,
          campaignTempId,
          adGroupTempId,
        })
      );
      continue;
    }
    if (action.type === "create_keyword") {
      const campaignTempId = resolveCampaignTempId(action, refs);
      const adGroupTempId = resolveAdGroupTempId(action, refs);
      rows.push(buildKeywordRow(action, { ...params, refs, campaignTempId, adGroupTempId }));
      continue;
    }
    const neverAction: never = action;
    throw new Error(`Unsupported action: ${JSON.stringify(neverAction)}`);
  }

  return sortRows(mergeRows(rows));
}
