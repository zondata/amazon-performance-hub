import {
  FetchCurrentSbResult,
  getPlacementKey,
  CurrentSbCampaign,
  CurrentSbAdGroup,
  CurrentSbTarget,
  CurrentSbPlacement,
} from "./fetchCurrent";
import { SbUpdateAction } from "./types";
import { mergeSbUploadRows } from "./mergeRows";
import { normText } from "../bulk/parseSponsoredProductsBulk";

export const SB_DEFAULT_SHEET_NAME = "SB Multi Ad Group Campaigns";

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

function parsePlacementPct(value: unknown): number {
  const num = parseNonNegativeNumber(value, "new_pct");
  if (num > 900) throw new Error(`Invalid new_pct: ${value} (must be <= 900)`);
  return num;
}

function normalizeState(value: string, currentState?: string | null): string {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  if (!ALLOWED_STATES.has(lower)) {
    throw new Error(`Invalid state: ${value}. Allowed: enabled, paused, archived.`);
  }
  if (!currentState) return lower;
  if (currentState === currentState.toUpperCase()) return lower.toUpperCase();
  if (currentState === currentState.toLowerCase()) return lower;
  const title = lower[0].toUpperCase() + lower.slice(1);
  if (currentState === title) return title;
  return lower;
}

function ensure(value: string | null | undefined, label: string): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) throw new Error(`Missing ${label}`);
  return trimmed;
}

function getTargetEntity(target: CurrentSbTarget): {
  entity: string;
  isKeyword: boolean;
} {
  const isProductTargeting = target.match_type === "TARGETING_EXPRESSION";
  if (target.is_negative && isProductTargeting) {
    return { entity: "Negative Product Targeting", isKeyword: false };
  }
  if (target.is_negative) {
    return { entity: "Negative Keyword", isKeyword: true };
  }
  if (isProductTargeting) {
    return { entity: "Product Targeting", isKeyword: false };
  }
  return { entity: "Keyword", isKeyword: true };
}

function campaignNameFromMap(campaign: CurrentSbCampaign | undefined): string {
  return campaign?.campaign_name_raw ?? "";
}

function adGroupNameFromMap(adGroup: CurrentSbAdGroup | undefined): string {
  return adGroup?.ad_group_name_raw ?? "";
}

function buildCampaignBaseCells(campaign: CurrentSbCampaign): Record<string, string | number | boolean | null> {
  return {
    Product: "Sponsored Brands",
    Entity: "Campaign",
    Operation: "Update",
    "Campaign ID": campaign.campaign_id,
    "Campaign Name": campaign.campaign_name_raw ?? "",
  };
}

function buildTargetBaseCells(params: {
  target: CurrentSbTarget;
  campaign?: CurrentSbCampaign;
  adGroup?: CurrentSbAdGroup;
}): Record<string, string | number | boolean | null> {
  const { target, campaign, adGroup } = params;
  const entity = getTargetEntity(target);
  const keywordId = entity.isKeyword ? target.target_id : "";
  const productTargetId = entity.isKeyword ? "" : target.target_id;
  const matchType = entity.isKeyword ? target.match_type : "TARGETING_EXPRESSION";

  return {
    Product: "Sponsored Brands",
    Entity: entity.entity,
    Operation: "Update",
    "Campaign ID": ensure(target.campaign_id, "target.campaign_id"),
    "Campaign Name": campaignNameFromMap(campaign),
    "Ad Group ID": ensure(target.ad_group_id, "target.ad_group_id"),
    "Ad Group Name": adGroupNameFromMap(adGroup),
    "Keyword ID": keywordId,
    "Product Targeting ID": productTargetId,
    "Keyword Text": entity.isKeyword ? target.expression_raw : "",
    "Product Targeting Expression": entity.isKeyword ? "" : target.expression_raw,
    "Match Type": matchType,
  };
}

function buildPlacementBaseCells(
  placement: CurrentSbPlacement,
  campaign?: CurrentSbCampaign
): Record<string, string | number | boolean | null> {
  return {
    Product: "Sponsored Brands",
    Entity: "Bidding Adjustment by Placement",
    Operation: "Update",
    "Campaign ID": placement.campaign_id,
    "Campaign Name": campaignNameFromMap(campaign),
    Placement: placement.placement_raw || placement.placement_code,
  };
}

function buildAdGroupBaseCells(params: {
  adGroup: CurrentSbAdGroup;
  campaign?: CurrentSbCampaign;
}): Record<string, string | number | boolean | null> {
  const { adGroup, campaign } = params;
  return {
    Product: "Sponsored Brands",
    Entity: "Ad Group",
    Operation: "Update",
    "Campaign ID": adGroup.campaign_id,
    "Campaign Name": campaignNameFromMap(campaign),
    "Ad Group ID": adGroup.ad_group_id,
    "Ad Group Name": adGroup.ad_group_name_raw ?? "",
  };
}

function normalizePlacementCode(raw: string): string {
  const norm = normText(raw);
  if (!norm) return "UNKNOWN";
  if (norm === "top of search") return "TOS";
  if (norm === "rest of search") return "ROS";
  if (norm === "product pages") return "PP";
  if (norm === "home page" || norm === "homepage" || norm === "home") return "HOME";
  if (norm === "other") return "OTHER";
  const safe = norm
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return safe || "UNKNOWN";
}

function findPlacement(params: {
  current: FetchCurrentSbResult;
  campaignId: string;
  placementRaw?: string;
  placementCode?: string;
}): CurrentSbPlacement {
  const { current, campaignId, placementRaw, placementCode } = params;
  const rawNorm = placementRaw ? normText(placementRaw) : "";
  const codeNorm = placementCode
    ? placementCode.trim().toUpperCase()
    : placementRaw
      ? normalizePlacementCode(placementRaw)
      : "";

  if (!rawNorm && !codeNorm) {
    throw new Error(
      `Placement update requires placement_raw or placement_code: campaign_id=${campaignId}`
    );
  }

  if (rawNorm && codeNorm) {
    const key = getPlacementKey(campaignId, rawNorm, codeNorm);
    const placement = current.placementsByKey.get(key);
    if (!placement) {
      throw new Error(
        `Placement not found: campaign_id=${campaignId} placement_raw=${placementRaw} placement_code=${placementCode}`
      );
    }
    return placement;
  }

  const matches = [...current.placementsByKey.values()].filter(
    (placement) =>
      placement.campaign_id === campaignId &&
      (rawNorm ? placement.placement_raw_norm === rawNorm : true) &&
      (codeNorm ? placement.placement_code === codeNorm : true)
  );

  if (matches.length === 0) {
    throw new Error(
      `Placement not found: campaign_id=${campaignId} placement_raw=${placementRaw ?? ""} placement_code=${placementCode ?? ""}`
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `Placement ambiguous: campaign_id=${campaignId} placement_raw=${placementRaw ?? ""} placement_code=${placementCode ?? ""}`
    );
  }
  return matches[0];
}

function sortRows(rows: UploadRow[]): UploadRow[] {
  const entityOrder = [
    "Campaign",
    "Ad Group",
    "Keyword",
    "Product Targeting",
    "Negative Keyword",
    "Negative Product Targeting",
    "Bidding Adjustment by Placement",
  ];
  const entityRank = new Map(entityOrder.map((entity, idx) => [entity, idx]));

  return [...rows].sort((a, b) => {
    const aEntity = String(a.cells["Entity"] ?? "");
    const bEntity = String(b.cells["Entity"] ?? "");
    const aRank = entityRank.get(aEntity) ?? 999;
    const bRank = entityRank.get(bEntity) ?? 999;
    if (aRank !== bRank) return aRank - bRank;

    const aCampaign = String(a.cells["Campaign ID"] ?? "");
    const bCampaign = String(b.cells["Campaign ID"] ?? "");
    if (aCampaign !== bCampaign) return aCampaign.localeCompare(bCampaign);

    const aAdGroup = String(a.cells["Ad Group ID"] ?? "");
    const bAdGroup = String(b.cells["Ad Group ID"] ?? "");
    if (aAdGroup !== bAdGroup) return aAdGroup.localeCompare(bAdGroup);

    const aTarget = String(a.cells["Keyword ID"] ?? "") || String(a.cells["Product Targeting ID"] ?? "");
    const bTarget = String(b.cells["Keyword ID"] ?? "") || String(b.cells["Product Targeting ID"] ?? "");
    if (aTarget !== bTarget) return aTarget.localeCompare(bTarget);

    const aPlacement = String(a.cells["Placement"] ?? "");
    const bPlacement = String(b.cells["Placement"] ?? "");
    return aPlacement.localeCompare(bPlacement);
  });
}

export function buildUploadRows(params: {
  actions: SbUpdateAction[];
  current: FetchCurrentSbResult;
  notes?: string;
  sheetName?: string;
  budgetColumn?: string;
}): UploadRow[] {
  const { actions, current, notes, sheetName, budgetColumn } = params;
  const rows: UploadRow[] = [];
  const targetSheet = sheetName ?? SB_DEFAULT_SHEET_NAME;

  for (const action of actions) {
    if (action.type === "update_campaign_budget") {
      const campaign = current.campaignsById.get(action.campaign_id);
      if (!campaign) throw new Error(`Campaign not found: ${action.campaign_id}`);
      const newBudget = parseNonNegativeNumber(action.new_budget, "new_budget");
      const currentBudget = campaign.daily_budget ?? null;
      const budgetHeader = budgetColumn ?? "Daily Budget";

      const cells = {
        ...buildCampaignBaseCells(campaign),
        [budgetHeader]: newBudget,
      };
      rows.push({
        sheetName: targetSheet,
        cells,
        review: {
          action_type: action.type,
          notes: notes ?? "",
          current_value: currentBudget,
          new_value: newBudget,
          delta: currentBudget !== null ? newBudget - currentBudget : null,
        },
      });
      continue;
    }

    if (action.type === "update_campaign_state") {
      const campaign = current.campaignsById.get(action.campaign_id);
      if (!campaign) throw new Error(`Campaign not found: ${action.campaign_id}`);
      const newState = normalizeState(action.new_state, campaign.state);
      const cells = {
        ...buildCampaignBaseCells(campaign),
        State: newState,
      };
      rows.push({
        sheetName: targetSheet,
        cells,
        review: {
          action_type: action.type,
          notes: notes ?? "",
          current_value: campaign.state ?? null,
          new_value: newState,
          delta: null,
        },
      });
      continue;
    }

    if (action.type === "update_campaign_bidding_strategy") {
      const campaign = current.campaignsById.get(action.campaign_id);
      if (!campaign) throw new Error(`Campaign not found: ${action.campaign_id}`);
      const newStrategy = String(action.new_strategy ?? "").trim();
      if (!newStrategy) throw new Error("Invalid new_strategy: must be non-empty.");
      const cells = {
        ...buildCampaignBaseCells(campaign),
        "Bidding Strategy": newStrategy,
      };
      rows.push({
        sheetName: targetSheet,
        cells,
        review: {
          action_type: action.type,
          notes: notes ?? "",
          current_value: campaign.bidding_strategy ?? null,
          new_value: newStrategy,
          delta: null,
        },
      });
      continue;
    }

    if (action.type === "update_target_bid") {
      const target = current.targetsById.get(action.target_id);
      if (!target) throw new Error(`Target not found: ${action.target_id}`);
      if (target.is_negative) {
        throw new Error(`Cannot update bid for negative target: ${action.target_id}`);
      }
      const newBid = parseNonNegativeNumber(action.new_bid, "new_bid");
      const campaign = current.campaignsById.get(target.campaign_id);
      const adGroup = current.adGroupsById.get(target.ad_group_id);

      const cells = {
        ...buildTargetBaseCells({ target, campaign, adGroup }),
        Bid: newBid,
      };
      rows.push({
        sheetName: targetSheet,
        cells,
        review: {
          action_type: action.type,
          notes: notes ?? "",
          current_value: target.bid ?? null,
          new_value: newBid,
          delta: target.bid !== null ? newBid - target.bid : null,
        },
      });
      continue;
    }

    if (action.type === "update_target_state") {
      const target = current.targetsById.get(action.target_id);
      if (!target) throw new Error(`Target not found: ${action.target_id}`);
      const newState = normalizeState(action.new_state, target.state);
      const campaign = current.campaignsById.get(target.campaign_id);
      const adGroup = current.adGroupsById.get(target.ad_group_id);

      const cells = {
        ...buildTargetBaseCells({ target, campaign, adGroup }),
        State: newState,
      };
      rows.push({
        sheetName: targetSheet,
        cells,
        review: {
          action_type: action.type,
          notes: notes ?? "",
          current_value: target.state ?? null,
          new_value: newState,
          delta: null,
        },
      });
      continue;
    }

    if (action.type === "update_ad_group_state") {
      const adGroup = current.adGroupsById.get(action.ad_group_id);
      if (!adGroup) throw new Error(`Ad group not found: ${action.ad_group_id}`);
      const campaign = current.campaignsById.get(adGroup.campaign_id);
      const newState = normalizeState(action.new_state, adGroup.state);
      const cells = {
        ...buildAdGroupBaseCells({ adGroup, campaign }),
        State: newState,
      };
      rows.push({
        sheetName: targetSheet,
        cells,
        review: {
          action_type: action.type,
          notes: notes ?? "",
          current_value: adGroup.state ?? null,
          new_value: newState,
          delta: null,
        },
      });
      continue;
    }

    if (action.type === "update_ad_group_default_bid") {
      const adGroup = current.adGroupsById.get(action.ad_group_id);
      if (!adGroup) throw new Error(`Ad group not found: ${action.ad_group_id}`);
      const campaign = current.campaignsById.get(adGroup.campaign_id);
      const newBid = parseNonNegativeNumber(action.new_default_bid, "new_default_bid");
      const cells = {
        ...buildAdGroupBaseCells({ adGroup, campaign }),
        "Ad Group Default Bid": newBid,
      };
      rows.push({
        sheetName: targetSheet,
        cells,
        review: {
          action_type: action.type,
          notes: notes ?? "",
          current_value: adGroup.default_bid ?? null,
          new_value: newBid,
          delta: adGroup.default_bid !== null ? newBid - adGroup.default_bid : null,
        },
      });
      continue;
    }

    if (action.type === "update_placement_modifier") {
      const placement = findPlacement({
        current,
        campaignId: action.campaign_id,
        placementRaw: action.placement_raw,
        placementCode: action.placement_code,
      });
      const newPct = parsePlacementPct(action.new_pct);
      const campaign = current.campaignsById.get(action.campaign_id);
      const cells = {
        ...buildPlacementBaseCells(placement, campaign),
        Percentage: newPct,
      };
      rows.push({
        sheetName: targetSheet,
        cells,
        review: {
          action_type: action.type,
          notes: notes ?? "",
          current_value: placement.percentage ?? null,
          new_value: newPct,
          delta: placement.percentage !== null ? newPct - placement.percentage : null,
        },
      });
      continue;
    }

    const neverAction: never = action;
    throw new Error(`Unsupported action: ${JSON.stringify(neverAction)}`);
  }

  const merged = mergeSbUploadRows(rows);
  return sortRows(merged);
}
