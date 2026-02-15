import { normText } from "../bulk/parseSponsoredProductsBulk";
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
  params: { allowEnabled: boolean; maxBudget: number; notes?: string }
): UploadRow {
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
    "Campaign Name": name,
    "Daily Budget": dailyBudget,
    State: state,
  };
  if (biddingStrategy) {
    cells["Bidding Strategy"] = biddingStrategy;
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
  params: { refs: SpCreateResolvedRefs; allowEnabled: boolean; maxBid: number; notes?: string }
): UploadRow {
  const campaignName = resolveCampaignName(action, params.refs);
  const adGroupName = ensureNonEmpty(action.ad_group_name, "ad group name");
  const state = normalizeStateForCreate(action.state, params.allowEnabled);

  const cells: Record<string, string | number | boolean | null> = {
    Product: "Sponsored Products",
    Entity: "Ad Group",
    Operation: "Create",
    "Campaign Name": campaignName,
    "Ad Group Name": adGroupName,
    State: state,
  };

  if (action.default_bid !== undefined && action.default_bid !== null) {
    const bid = parseNonNegativeNumber(action.default_bid, "default_bid");
    if (bid > params.maxBid) {
      throw new Error(`default_bid exceeds max bid cap (${params.maxBid})`);
    }
    cells.Bid = bid;
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
  params: { refs: SpCreateResolvedRefs; notes?: string }
): UploadRow {
  const campaignName = resolveCampaignName(action, params.refs);
  const adGroupName = resolveAdGroupName(action, params.refs);
  const sku = String(action.sku ?? "").trim();
  const asin = String(action.asin ?? "").trim();
  if (!sku && !asin) {
    throw new Error("create_product_ad requires sku or asin");
  }

  const cells: Record<string, string | number | boolean | null> = {
    Product: "Sponsored Products",
    Entity: "Product Ad",
    Operation: "Create",
    "Campaign Name": campaignName,
    "Ad Group Name": adGroupName,
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
  params: { refs: SpCreateResolvedRefs; allowEnabled: boolean; maxBid: number; notes?: string }
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
    "Campaign Name": campaignName,
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

export function resolveCreateRefs(actions: SpCreateAction[]): SpCreateResolvedRefs {
  const campaignsByTempId = new Map<string, string>();
  const adGroupsByTempId = new Map<string, { campaignName: string; adGroupName: string }>();

  for (const action of actions) {
    if (action.type === "create_campaign" && action.temp_id) {
      if (campaignsByTempId.has(action.temp_id)) {
        throw new Error(`Duplicate campaign temp_id: ${action.temp_id}`);
      }
      campaignsByTempId.set(action.temp_id, action.name.trim());
    }
  }

  for (const action of actions) {
    if (action.type === "create_ad_group" && action.temp_id) {
      if (adGroupsByTempId.has(action.temp_id)) {
        throw new Error(`Duplicate ad_group temp_id: ${action.temp_id}`);
      }
      const campaignName = resolveCampaignName(action, { campaignsByTempId, adGroupsByTempId });
      adGroupsByTempId.set(action.temp_id, {
        campaignName,
        adGroupName: action.ad_group_name.trim(),
      });
    }
  }

  return { campaignsByTempId, adGroupsByTempId };
}

export function buildUploadRows(params: {
  actions: SpCreateAction[];
  refs: SpCreateResolvedRefs;
  allowEnabled: boolean;
  maxBudget: number;
  maxBid: number;
  notes?: string;
}): UploadRow[] {
  const rows: UploadRow[] = [];
  const { refs } = params;

  for (const action of params.actions) {
    if (action.type === "create_campaign") {
      rows.push(buildCampaignRow(action, params));
      continue;
    }
    if (action.type === "create_ad_group") {
      rows.push(buildAdGroupRow(action, { ...params, refs }));
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
      const adGroupName = resolveAdGroupName(action, refs);
      rows.push(buildProductAdRow(action, { refs, notes: params.notes }));
      continue;
    }
    if (action.type === "create_keyword") {
      rows.push(buildKeywordRow(action, { ...params, refs }));
      continue;
    }
    const neverAction: never = action;
    throw new Error(`Unsupported action: ${JSON.stringify(neverAction)}`);
  }

  return sortRows(mergeRows(rows));
}
