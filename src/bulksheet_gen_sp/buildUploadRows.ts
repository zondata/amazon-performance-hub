import {
  FetchCurrentResult,
  getPlacementKey,
  CurrentCampaign,
  CurrentAdGroup,
  CurrentTarget,
  CurrentPlacement,
} from "./fetchCurrent";
import { SpUpdateAction } from "./types";

export const SP_SHEET_NAME = "Sponsored Products Campaigns";

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

function getTargetEntity(target: CurrentTarget): {
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

function campaignNameFromMap(campaign: CurrentCampaign | undefined): string {
  return campaign?.campaign_name_raw ?? "";
}

function adGroupNameFromMap(adGroup: CurrentAdGroup | undefined): string {
  return adGroup?.ad_group_name_raw ?? "";
}

function buildCampaignBaseCells(campaign: CurrentCampaign): Record<string, string | number | boolean | null> {
  return {
    Product: "Sponsored Products",
    Entity: "Campaign",
    Operation: "Update",
    "Campaign ID": campaign.campaign_id,
    "Campaign Name": campaign.campaign_name_raw ?? "",
  };
}

function buildTargetBaseCells(params: {
  target: CurrentTarget;
  campaign?: CurrentCampaign;
  adGroup?: CurrentAdGroup;
}): Record<string, string | number | boolean | null> {
  const { target, campaign, adGroup } = params;
  const entity = getTargetEntity(target);
  const keywordId = entity.isKeyword ? target.target_id : "";
  const productTargetId = entity.isKeyword ? "" : target.target_id;
  const matchType = entity.isKeyword ? target.match_type : "TARGETING_EXPRESSION";

  return {
    Product: "Sponsored Products",
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
  placement: CurrentPlacement,
  campaign?: CurrentCampaign
): Record<string, string | number | boolean | null> {
  return {
    Product: "Sponsored Products",
    Entity: "Bidding Adjustment",
    Operation: "Update",
    "Campaign ID": placement.campaign_id,
    "Campaign Name": campaignNameFromMap(campaign),
    Placement: placement.placement_raw || placement.placement_code,
  };
}

function buildAdGroupBaseCells(params: {
  adGroup: CurrentAdGroup;
  campaign?: CurrentCampaign;
}): Record<string, string | number | boolean | null> {
  const { adGroup, campaign } = params;
  return {
    Product: "Sponsored Products",
    Entity: "Ad Group",
    Operation: "Update",
    "Campaign ID": adGroup.campaign_id,
    "Campaign Name": campaignNameFromMap(campaign),
    "Ad Group ID": adGroup.ad_group_id,
    "Ad Group Name": adGroup.ad_group_name_raw ?? "",
  };
}

export function buildUploadRows(params: {
  actions: SpUpdateAction[];
  current: FetchCurrentResult;
  notes?: string;
}): UploadRow[] {
  const { actions, current, notes } = params;
  const rows: UploadRow[] = [];

  for (const action of actions) {
    if (action.type === "update_campaign_budget") {
      const campaign = current.campaignsById.get(action.campaign_id);
      if (!campaign) throw new Error(`Campaign not found: ${action.campaign_id}`);
      const newBudget = parseNonNegativeNumber(action.new_budget, "new_budget");
      const currentBudget = campaign.daily_budget ?? null;

      const cells = {
        ...buildCampaignBaseCells(campaign),
        "Daily Budget": newBudget,
      };
      rows.push({
        sheetName: SP_SHEET_NAME,
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
        sheetName: SP_SHEET_NAME,
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

    if (action.type === "update_target_bid") {
      const target = current.targetsById.get(action.target_id);
      if (!target) throw new Error(`Target not found: ${action.target_id}`);
      if (target.is_negative) {
        throw new Error(`Cannot update bid for negative target: ${action.target_id}`);
      }
      const newBid = parseNonNegativeNumber(action.new_bid, "new_bid");
      const campaign = target.campaign_id
        ? current.campaignsById.get(target.campaign_id)
        : undefined;
      const adGroup = target.ad_group_id
        ? current.adGroupsById.get(target.ad_group_id)
        : undefined;

      const cells = {
        ...buildTargetBaseCells({ target, campaign, adGroup }),
        Bid: newBid,
      };
      rows.push({
        sheetName: SP_SHEET_NAME,
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
      const campaign = target.campaign_id
        ? current.campaignsById.get(target.campaign_id)
        : undefined;
      const adGroup = target.ad_group_id
        ? current.adGroupsById.get(target.ad_group_id)
        : undefined;

      const cells = {
        ...buildTargetBaseCells({ target, campaign, adGroup }),
        State: newState,
      };
      rows.push({
        sheetName: SP_SHEET_NAME,
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
        sheetName: SP_SHEET_NAME,
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

    if (action.type === "update_placement_modifier") {
      const key = getPlacementKey(action.campaign_id, action.placement_code);
      const placement = current.placementsByKey.get(key);
      if (!placement) {
        throw new Error(
          `Placement not found: campaign_id=${action.campaign_id} placement_code=${action.placement_code}`
        );
      }
      const newPct = parseNonNegativeNumber(action.new_pct, "new_pct");
      const campaign = current.campaignsById.get(action.campaign_id);
      const cells = {
        ...buildPlacementBaseCells(placement, campaign),
        Percentage: newPct,
      };
      rows.push({
        sheetName: SP_SHEET_NAME,
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

  return mergeUploadRows(rows);
}

function mergeKeyForRow(row: UploadRow): string {
  const cells = row.cells;
  const entity = String(cells["Entity"] ?? "");
  const campaignId = String(cells["Campaign ID"] ?? "");
  const adGroupId = String(cells["Ad Group ID"] ?? "");
  const keywordId = String(cells["Keyword ID"] ?? "");
  const productTargetId = String(cells["Product Targeting ID"] ?? "");
  const placement = String(cells["Placement"] ?? "");
  return [
    row.sheetName,
    entity,
    campaignId,
    adGroupId,
    keywordId,
    productTargetId,
    placement,
  ].join("||");
}

export function mergeUploadRows(rows: UploadRow[]): UploadRow[] {
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
    const mergedCells = { ...existing.cells, ...row.cells };

    const actionTypeParts = [existing.review.action_type, row.review.action_type]
      .map((value) => String(value ?? "").trim())
      .filter((value) => value.length > 0);
    const mergedActionType = actionTypeParts.join("+");

    const mergedNotes = (() => {
      const first = String(existing.review.notes ?? "").trim();
      if (first) return first;
      const next = String(row.review.notes ?? "").trim();
      return next;
    })();

    merged[existingIndex] = {
      sheetName: existing.sheetName,
      cells: mergedCells,
      review: {
        ...existing.review,
        action_type: mergedActionType,
        notes: mergedNotes,
        current_value: null,
        new_value: null,
        delta: null,
      },
    };
  }

  return merged;
}
