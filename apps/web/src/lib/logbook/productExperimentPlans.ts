import "server-only";

import type { SbUpdateAction } from "../../../../../src/bulksheet_gen_sb/types";
import type { SpUpdateAction } from "../../../../../src/bulksheet_gen_sp/types";
import {
  CurrentAdGroup,
  CurrentCampaign,
  CurrentSbAdGroup,
  CurrentSbCampaign,
  CurrentSbPlacement,
  CurrentSbTarget,
  CurrentTarget,
  FetchCurrentResult,
  FetchCurrentSbResult,
  fetchCurrentSbData,
  fetchCurrentSpData,
} from "@/lib/bulksheets/fetchCurrent";
import {
  selectBulkgenPlansForExecution,
  type ExecutableBulkgenPlanV1,
} from "@/lib/logbook/contracts/reviewPatchPlan";

export type BulkgenPlan = ExecutableBulkgenPlanV1;

export type PlanReviewRow = {
  action_type: string;
  entity: string;
  campaign_id: string | null;
  ad_group_id: string | null;
  target_id: string | null;
  placement: string | null;
  field: string;
  before: unknown;
  after: unknown;
  delta: number | null;
  notes: string | null;
};

export type PlanBulksheetRow = {
  sheet_name: string;
  cells: Record<string, unknown>;
};

export type PlanPreview = {
  channel: "SP" | "SB";
  run_id: string;
  notes?: string;
  plan_source: "final_plan" | "proposal" | "none";
  plan_warning?: string;
  final_plan_pack_id?: string | null;
  review_rows: PlanReviewRow[];
  bulksheet_rows: PlanBulksheetRow[];
  snapshot_date: string;
  error?: string;
};

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item));
};

const spPlacementKey = (campaignId: string, placementCode: string) =>
  `${campaignId}::${placementCode.trim().toLowerCase()}`;

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

const targetEntity = (target: CurrentTarget | CurrentSbTarget) => {
  const isProductTargeting = target.match_type === "TARGETING_EXPRESSION";
  if (target.is_negative && isProductTargeting) return "Negative Product Targeting";
  if (target.is_negative) return "Negative Keyword";
  if (isProductTargeting) return "Product Targeting";
  return "Keyword";
};

const mergedRowKey = (row: PlanBulksheetRow) => {
  const cells = row.cells;
  return [
    row.sheet_name,
    String(cells.Entity ?? ""),
    String(cells["Campaign ID"] ?? ""),
    String(cells["Ad Group ID"] ?? ""),
    String(cells["Keyword ID"] ?? ""),
    String(cells["Product Targeting ID"] ?? ""),
    String(cells.Placement ?? ""),
  ].join("||");
};

const mergeBulksheetRows = (rows: PlanBulksheetRow[]): PlanBulksheetRow[] => {
  const merged: PlanBulksheetRow[] = [];
  const indexByKey = new Map<string, number>();

  for (const row of rows) {
    const key = mergedRowKey(row);
    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      merged.push({
        sheet_name: row.sheet_name,
        cells: { ...row.cells },
      });
      indexByKey.set(key, merged.length - 1);
      continue;
    }
    const existing = merged[existingIndex];
    merged[existingIndex] = {
      sheet_name: existing.sheet_name,
      cells: { ...existing.cells, ...row.cells },
    };
  }

  return merged;
};

const spCampaignBase = (campaign: CurrentCampaign) => ({
  Product: "Sponsored Products",
  Entity: "Campaign",
  Operation: "Update",
  "Campaign ID": campaign.campaign_id,
  "Campaign Name": campaign.campaign_name_raw ?? "",
});

const spAdGroupBase = (adGroup: CurrentAdGroup, campaign?: CurrentCampaign) => ({
  Product: "Sponsored Products",
  Entity: "Ad Group",
  Operation: "Update",
  "Campaign ID": adGroup.campaign_id,
  "Campaign Name": campaign?.campaign_name_raw ?? "",
  "Ad Group ID": adGroup.ad_group_id,
  "Ad Group Name": adGroup.ad_group_name_raw ?? "",
});

const spTargetBase = (target: CurrentTarget, campaign?: CurrentCampaign, adGroup?: CurrentAdGroup) => {
  const entity = targetEntity(target);
  const isKeyword = entity.includes("Keyword");
  return {
    Product: "Sponsored Products",
    Entity: entity,
    Operation: "Update",
    "Campaign ID": target.campaign_id ?? "",
    "Campaign Name": campaign?.campaign_name_raw ?? "",
    "Ad Group ID": target.ad_group_id ?? "",
    "Ad Group Name": adGroup?.ad_group_name_raw ?? "",
    "Keyword ID": isKeyword ? target.target_id : "",
    "Product Targeting ID": isKeyword ? "" : target.target_id,
    "Keyword Text": isKeyword ? target.expression_raw : "",
    "Product Targeting Expression": isKeyword ? "" : target.expression_raw,
    "Match Type": isKeyword ? target.match_type : "TARGETING_EXPRESSION",
  };
};

const sbCampaignBase = (campaign: CurrentSbCampaign) => ({
  Product: "Sponsored Brands",
  Entity: "Campaign",
  Operation: "Update",
  "Campaign ID": campaign.campaign_id,
  "Campaign Name": campaign.campaign_name_raw ?? "",
});

const sbAdGroupBase = (adGroup: CurrentSbAdGroup, campaign?: CurrentSbCampaign) => ({
  Product: "Sponsored Brands",
  Entity: "Ad Group",
  Operation: "Update",
  "Campaign ID": adGroup.campaign_id,
  "Campaign Name": campaign?.campaign_name_raw ?? "",
  "Ad Group ID": adGroup.ad_group_id,
  "Ad Group Name": adGroup.ad_group_name_raw ?? "",
});

const sbTargetBase = (target: CurrentSbTarget, campaign?: CurrentSbCampaign, adGroup?: CurrentSbAdGroup) => {
  const entity = targetEntity(target);
  const isKeyword = entity.includes("Keyword");
  return {
    Product: "Sponsored Brands",
    Entity: entity,
    Operation: "Update",
    "Campaign ID": target.campaign_id ?? "",
    "Campaign Name": campaign?.campaign_name_raw ?? "",
    "Ad Group ID": target.ad_group_id ?? "",
    "Ad Group Name": adGroup?.ad_group_name_raw ?? "",
    "Keyword ID": isKeyword ? target.target_id : "",
    "Product Targeting ID": isKeyword ? "" : target.target_id,
    "Keyword Text": isKeyword ? target.expression_raw : "",
    "Product Targeting Expression": isKeyword ? "" : target.expression_raw,
    "Match Type": isKeyword ? target.match_type : "TARGETING_EXPRESSION",
  };
};

const buildSpPreviewRows = (actions: SpUpdateAction[], current: FetchCurrentResult, notes?: string) => {
  const reviewRows: PlanReviewRow[] = [];
  const rows: PlanBulksheetRow[] = [];

  for (const action of actions) {
    if (action.type === "update_campaign_budget") {
      const campaign = current.campaignsById.get(action.campaign_id);
      if (!campaign) throw new Error(`Campaign not found: ${action.campaign_id}`);
      rows.push({
        sheet_name: "Sponsored Products Campaigns",
        cells: { ...spCampaignBase(campaign), "Daily Budget": action.new_budget },
      });
      reviewRows.push({
        action_type: action.type,
        entity: "Campaign",
        campaign_id: campaign.campaign_id,
        ad_group_id: null,
        target_id: null,
        placement: null,
        field: "daily_budget",
        before: campaign.daily_budget ?? null,
        after: action.new_budget,
        delta: campaign.daily_budget === null ? null : action.new_budget - campaign.daily_budget,
        notes: notes ?? null,
      });
      continue;
    }

    if (action.type === "update_campaign_state" || action.type === "update_campaign_bidding_strategy") {
      const campaign = current.campaignsById.get(action.campaign_id);
      if (!campaign) throw new Error(`Campaign not found: ${action.campaign_id}`);
      const field = action.type === "update_campaign_state" ? "State" : "Bidding Strategy";
      const beforeValue =
        action.type === "update_campaign_state" ? campaign.state ?? null : campaign.bidding_strategy ?? null;
      const afterValue = action.type === "update_campaign_state" ? action.new_state : action.new_strategy;
      rows.push({
        sheet_name: "Sponsored Products Campaigns",
        cells: { ...spCampaignBase(campaign), [field]: afterValue },
      });
      reviewRows.push({
        action_type: action.type,
        entity: "Campaign",
        campaign_id: campaign.campaign_id,
        ad_group_id: null,
        target_id: null,
        placement: null,
        field: field === "State" ? "state" : "bidding_strategy",
        before: beforeValue,
        after: afterValue,
        delta: null,
        notes: notes ?? null,
      });
      continue;
    }

    if (action.type === "update_ad_group_state" || action.type === "update_ad_group_default_bid") {
      const adGroup = current.adGroupsById.get(action.ad_group_id);
      if (!adGroup) throw new Error(`Ad group not found: ${action.ad_group_id}`);
      const campaign = current.campaignsById.get(adGroup.campaign_id);
      if (action.type === "update_ad_group_state") {
        rows.push({
          sheet_name: "Sponsored Products Campaigns",
          cells: { ...spAdGroupBase(adGroup, campaign), State: action.new_state },
        });
        reviewRows.push({
          action_type: action.type,
          entity: "Ad Group",
          campaign_id: adGroup.campaign_id,
          ad_group_id: adGroup.ad_group_id,
          target_id: null,
          placement: null,
          field: "state",
          before: adGroup.state ?? null,
          after: action.new_state,
          delta: null,
          notes: notes ?? null,
        });
      } else {
        rows.push({
          sheet_name: "Sponsored Products Campaigns",
          cells: { ...spAdGroupBase(adGroup, campaign), "Ad Group Default Bid": action.new_bid },
        });
        reviewRows.push({
          action_type: action.type,
          entity: "Ad Group",
          campaign_id: adGroup.campaign_id,
          ad_group_id: adGroup.ad_group_id,
          target_id: null,
          placement: null,
          field: "default_bid",
          before: adGroup.default_bid ?? null,
          after: action.new_bid,
          delta: adGroup.default_bid === null ? null : action.new_bid - adGroup.default_bid,
          notes: notes ?? null,
        });
      }
      continue;
    }

    if (action.type === "update_target_bid" || action.type === "update_target_state") {
      const target = current.targetsById.get(action.target_id);
      if (!target) throw new Error(`Target not found: ${action.target_id}`);
      const campaign = target.campaign_id ? current.campaignsById.get(target.campaign_id) : undefined;
      const adGroup = target.ad_group_id ? current.adGroupsById.get(target.ad_group_id) : undefined;
      if (action.type === "update_target_bid") {
        rows.push({
          sheet_name: "Sponsored Products Campaigns",
          cells: { ...spTargetBase(target, campaign, adGroup), Bid: action.new_bid },
        });
        reviewRows.push({
          action_type: action.type,
          entity: "Target",
          campaign_id: target.campaign_id ?? null,
          ad_group_id: target.ad_group_id ?? null,
          target_id: target.target_id,
          placement: null,
          field: "bid",
          before: target.bid ?? null,
          after: action.new_bid,
          delta: target.bid === null ? null : action.new_bid - target.bid,
          notes: notes ?? null,
        });
      } else {
        rows.push({
          sheet_name: "Sponsored Products Campaigns",
          cells: { ...spTargetBase(target, campaign, adGroup), State: action.new_state },
        });
        reviewRows.push({
          action_type: action.type,
          entity: "Target",
          campaign_id: target.campaign_id ?? null,
          ad_group_id: target.ad_group_id ?? null,
          target_id: target.target_id,
          placement: null,
          field: "state",
          before: target.state ?? null,
          after: action.new_state,
          delta: null,
          notes: notes ?? null,
        });
      }
      continue;
    }

    if (action.type === "update_placement_modifier") {
      const placement = current.placementsByKey.get(spPlacementKey(action.campaign_id, action.placement_code));
      if (!placement) {
        throw new Error(
          `Placement not found: campaign_id=${action.campaign_id} placement_code=${action.placement_code}`
        );
      }
      const campaign = current.campaignsById.get(action.campaign_id);
      rows.push({
        sheet_name: "Sponsored Products Campaigns",
        cells: {
          Product: "Sponsored Products",
          Entity: "Bidding Adjustment",
          Operation: "Update",
          "Campaign ID": placement.campaign_id,
          "Campaign Name": campaign?.campaign_name_raw ?? "",
          Placement: placement.placement_raw || placement.placement_code,
          Percentage: action.new_pct,
        },
      });
      reviewRows.push({
        action_type: action.type,
        entity: "Placement",
        campaign_id: placement.campaign_id,
        ad_group_id: null,
        target_id: null,
        placement: placement.placement_raw || placement.placement_code,
        field: "percentage",
        before: placement.percentage ?? null,
        after: action.new_pct,
        delta: placement.percentage === null ? null : action.new_pct - placement.percentage,
        notes: notes ?? null,
      });
    }
  }

  return {
    review_rows: reviewRows,
    bulksheet_rows: mergeBulksheetRows(rows),
  };
};

const findSbPlacement = (
  current: FetchCurrentSbResult,
  action: Extract<SbUpdateAction, { type: "update_placement_modifier" }>
): CurrentSbPlacement | null => {
  const rawNorm = action.placement_raw ? normalizeText(action.placement_raw) : null;
  const code = action.placement_code ? action.placement_code.trim().toUpperCase() : null;

  const matches = [...current.placementsByKey.values()].filter((placement) => {
    if (placement.campaign_id !== action.campaign_id) return false;
    if (rawNorm && placement.placement_raw_norm !== rawNorm) return false;
    if (code && placement.placement_code !== code) return false;
    return true;
  });

  if (matches.length === 1) return matches[0];
  return null;
};

const buildSbPreviewRows = (actions: SbUpdateAction[], current: FetchCurrentSbResult, notes?: string) => {
  const reviewRows: PlanReviewRow[] = [];
  const rows: PlanBulksheetRow[] = [];

  for (const action of actions) {
    if (action.type === "update_campaign_budget") {
      const campaign = current.campaignsById.get(action.campaign_id);
      if (!campaign) throw new Error(`Campaign not found: ${action.campaign_id}`);
      rows.push({
        sheet_name: "SB Multi Ad Group Campaigns",
        cells: { ...sbCampaignBase(campaign), "Daily Budget": action.new_budget },
      });
      reviewRows.push({
        action_type: action.type,
        entity: "Campaign",
        campaign_id: campaign.campaign_id,
        ad_group_id: null,
        target_id: null,
        placement: null,
        field: "daily_budget",
        before: campaign.daily_budget ?? null,
        after: action.new_budget,
        delta: campaign.daily_budget === null ? null : action.new_budget - campaign.daily_budget,
        notes: notes ?? null,
      });
      continue;
    }

    if (action.type === "update_campaign_state" || action.type === "update_campaign_bidding_strategy") {
      const campaign = current.campaignsById.get(action.campaign_id);
      if (!campaign) throw new Error(`Campaign not found: ${action.campaign_id}`);
      const field = action.type === "update_campaign_state" ? "State" : "Bidding Strategy";
      const beforeValue =
        action.type === "update_campaign_state" ? campaign.state ?? null : campaign.bidding_strategy ?? null;
      const afterValue = action.type === "update_campaign_state" ? action.new_state : action.new_strategy;
      rows.push({
        sheet_name: "SB Multi Ad Group Campaigns",
        cells: { ...sbCampaignBase(campaign), [field]: afterValue },
      });
      reviewRows.push({
        action_type: action.type,
        entity: "Campaign",
        campaign_id: campaign.campaign_id,
        ad_group_id: null,
        target_id: null,
        placement: null,
        field: field === "State" ? "state" : "bidding_strategy",
        before: beforeValue,
        after: afterValue,
        delta: null,
        notes: notes ?? null,
      });
      continue;
    }

    if (action.type === "update_ad_group_state" || action.type === "update_ad_group_default_bid") {
      const adGroup = current.adGroupsById.get(action.ad_group_id);
      if (!adGroup) throw new Error(`Ad group not found: ${action.ad_group_id}`);
      const campaign = current.campaignsById.get(adGroup.campaign_id);
      if (action.type === "update_ad_group_state") {
        rows.push({
          sheet_name: "SB Multi Ad Group Campaigns",
          cells: { ...sbAdGroupBase(adGroup, campaign), State: action.new_state },
        });
        reviewRows.push({
          action_type: action.type,
          entity: "Ad Group",
          campaign_id: adGroup.campaign_id,
          ad_group_id: adGroup.ad_group_id,
          target_id: null,
          placement: null,
          field: "state",
          before: adGroup.state ?? null,
          after: action.new_state,
          delta: null,
          notes: notes ?? null,
        });
      } else {
        rows.push({
          sheet_name: "SB Multi Ad Group Campaigns",
          cells: { ...sbAdGroupBase(adGroup, campaign), "Ad Group Default Bid": action.new_default_bid },
        });
        reviewRows.push({
          action_type: action.type,
          entity: "Ad Group",
          campaign_id: adGroup.campaign_id,
          ad_group_id: adGroup.ad_group_id,
          target_id: null,
          placement: null,
          field: "default_bid",
          before: adGroup.default_bid ?? null,
          after: action.new_default_bid,
          delta:
            adGroup.default_bid === null ? null : action.new_default_bid - adGroup.default_bid,
          notes: notes ?? null,
        });
      }
      continue;
    }

    if (action.type === "update_target_bid" || action.type === "update_target_state") {
      const target = current.targetsById.get(action.target_id);
      if (!target) throw new Error(`Target not found: ${action.target_id}`);
      const campaign = current.campaignsById.get(target.campaign_id);
      const adGroup = current.adGroupsById.get(target.ad_group_id);
      if (action.type === "update_target_bid") {
        rows.push({
          sheet_name: "SB Multi Ad Group Campaigns",
          cells: { ...sbTargetBase(target, campaign, adGroup), Bid: action.new_bid },
        });
        reviewRows.push({
          action_type: action.type,
          entity: "Target",
          campaign_id: target.campaign_id ?? null,
          ad_group_id: target.ad_group_id ?? null,
          target_id: target.target_id,
          placement: null,
          field: "bid",
          before: target.bid ?? null,
          after: action.new_bid,
          delta: target.bid === null ? null : action.new_bid - target.bid,
          notes: notes ?? null,
        });
      } else {
        rows.push({
          sheet_name: "SB Multi Ad Group Campaigns",
          cells: { ...sbTargetBase(target, campaign, adGroup), State: action.new_state },
        });
        reviewRows.push({
          action_type: action.type,
          entity: "Target",
          campaign_id: target.campaign_id ?? null,
          ad_group_id: target.ad_group_id ?? null,
          target_id: target.target_id,
          placement: null,
          field: "state",
          before: target.state ?? null,
          after: action.new_state,
          delta: null,
          notes: notes ?? null,
        });
      }
      continue;
    }

    if (action.type === "update_placement_modifier") {
      const placement = findSbPlacement(current, action);
      if (!placement) {
        throw new Error(
          `Placement not found: campaign_id=${action.campaign_id} placement_raw=${action.placement_raw ?? ""} placement_code=${action.placement_code ?? ""}`
        );
      }
      const campaign = current.campaignsById.get(action.campaign_id);
      rows.push({
        sheet_name: "SB Multi Ad Group Campaigns",
        cells: {
          Product: "Sponsored Brands",
          Entity: "Bidding Adjustment by Placement",
          Operation: "Update",
          "Campaign ID": placement.campaign_id,
          "Campaign Name": campaign?.campaign_name_raw ?? "",
          Placement: placement.placement_raw || placement.placement_code,
          Percentage: action.new_pct,
        },
      });
      reviewRows.push({
        action_type: action.type,
        entity: "Placement",
        campaign_id: placement.campaign_id,
        ad_group_id: null,
        target_id: null,
        placement: placement.placement_raw || placement.placement_code,
        field: "percentage",
        before: placement.percentage ?? null,
        after: action.new_pct,
        delta: placement.percentage === null ? null : action.new_pct - placement.percentage,
        notes: notes ?? null,
      });
    }
  }

  return {
    review_rows: reviewRows,
    bulksheet_rows: mergeBulksheetRows(rows),
  };
};

export const buildPlanPreviewsForScope = async (scope: unknown): Promise<PlanPreview[]> => {
  const selection = selectBulkgenPlansForExecution(scope);
  const plans = selection.plans;
  const previews: PlanPreview[] = [];

  for (const plan of plans) {
    if (plan.channel === "SP") {
      try {
        const current = await fetchCurrentSpData(plan.actions as SpUpdateAction[]);
        const built = buildSpPreviewRows(plan.actions as SpUpdateAction[], current, plan.notes);
        previews.push({
          channel: "SP",
          run_id: plan.run_id,
          notes: plan.notes,
          plan_source: selection.source,
          plan_warning: selection.warning,
          final_plan_pack_id: selection.final_plan_pack_id ?? null,
          review_rows: built.review_rows,
          bulksheet_rows: built.bulksheet_rows,
          snapshot_date: current.snapshotDate,
        });
      } catch (error) {
        previews.push({
          channel: "SP",
          run_id: plan.run_id,
          notes: plan.notes,
          plan_source: selection.source,
          plan_warning: selection.warning,
          final_plan_pack_id: selection.final_plan_pack_id ?? null,
          review_rows: [],
          bulksheet_rows: [],
          snapshot_date: "",
          error: error instanceof Error ? error.message : "Failed to build SP preview",
        });
      }
      continue;
    }

    try {
      const current = await fetchCurrentSbData(plan.actions as SbUpdateAction[]);
      const built = buildSbPreviewRows(plan.actions as SbUpdateAction[], current, plan.notes);
      previews.push({
        channel: "SB",
        run_id: plan.run_id,
        notes: plan.notes,
        plan_source: selection.source,
        plan_warning: selection.warning,
        final_plan_pack_id: selection.final_plan_pack_id ?? null,
        review_rows: built.review_rows,
        bulksheet_rows: built.bulksheet_rows,
        snapshot_date: current.snapshotDate,
      });
    } catch (error) {
      previews.push({
        channel: "SB",
        run_id: plan.run_id,
        notes: plan.notes,
        plan_source: selection.source,
        plan_warning: selection.warning,
        final_plan_pack_id: selection.final_plan_pack_id ?? null,
        review_rows: [],
        bulksheet_rows: [],
        snapshot_date: "",
        error: error instanceof Error ? error.message : "Failed to build SB preview",
      });
    }
  }

  return previews;
};

export const extractBulkgenPlans = (scope: unknown): BulkgenPlan[] =>
  selectBulkgenPlansForExecution(scope).plans;

export const collectBulkgenPlanTags = (scope: unknown): string[] => {
  const scopeObj = asObject(scope);
  return asStringArray(scopeObj?.tags);
};
