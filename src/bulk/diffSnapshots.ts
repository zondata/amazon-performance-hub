import type {
  SponsoredProductsSnapshot,
  CampaignRow,
  AdGroupRow,
  TargetRow,
  PlacementRow,
} from "./parseSponsoredProductsBulk";

export type DiffResult = {
  campaignRenames: {
    campaignId: string;
    fromNameRaw: string;
    toNameRaw: string;
    fromNameNorm: string;
    toNameNorm: string;
  }[];
  adGroupRenames: {
    adGroupId: string;
    campaignId: string | null;
    fromNameRaw: string;
    toNameRaw: string;
    fromNameNorm: string;
    toNameNorm: string;
  }[];
  campaignBudgetChanges: {
    campaignId: string;
    fromDailyBudget: number | null;
    toDailyBudget: number | null;
  }[];
  campaignBiddingStrategyChanges: {
    campaignId: string;
    fromStrategy: string;
    toStrategy: string;
  }[];
  placementChanges: {
    campaignId: string | null;
    placement: string;
    fromPercentage: number | null;
    toPercentage: number | null;
  }[];
  targetBidChanges: {
    targetId: string;
    campaignId: string | null;
    adGroupId: string | null;
    fromBid: number | null;
    toBid: number | null;
  }[];
  targetStateChanges: {
    targetId: string;
    campaignId: string | null;
    adGroupId: string | null;
    fromState: string;
    toState: string;
  }[];
  added: { campaigns: string[]; adGroups: string[]; targets: string[] };
  removed: { campaigns: string[]; adGroups: string[]; targets: string[] };
};

function mapById<T extends { [key: string]: unknown }>(
  items: T[],
  idKey: keyof T
): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    const id = item[idKey];
    if (typeof id === "string" && id) {
      if (!map.has(id)) map.set(id, item);
    }
  }
  return map;
}

function getIdSet<T extends { [key: string]: unknown }>(
  items: T[],
  idKey: keyof T
): Set<string> {
  const set = new Set<string>();
  for (const item of items) {
    const id = item[idKey];
    if (typeof id === "string" && id) set.add(id);
  }
  return set;
}

function compareNumber(a: number | null, b: number | null): boolean {
  if (a === null && b === null) return false;
  return a !== b;
}

function compareString(a: string, b: string): boolean {
  return a !== b;
}

function placementKey(item: PlacementRow): string {
  return `${item.campaignId ?? ""}::${item.placement}`;
}

export function diffSnapshots(
  oldSnap: SponsoredProductsSnapshot,
  newSnap: SponsoredProductsSnapshot
): DiffResult {
  const result: DiffResult = {
    campaignRenames: [],
    adGroupRenames: [],
    campaignBudgetChanges: [],
    campaignBiddingStrategyChanges: [],
    placementChanges: [],
    targetBidChanges: [],
    targetStateChanges: [],
    added: { campaigns: [], adGroups: [], targets: [] },
    removed: { campaigns: [], adGroups: [], targets: [] },
  };

  const oldCampaigns = mapById<CampaignRow>(oldSnap.campaigns, "campaignId");
  const newCampaigns = mapById<CampaignRow>(newSnap.campaigns, "campaignId");
  const oldAdGroups = mapById<AdGroupRow>(oldSnap.adGroups, "adGroupId");
  const newAdGroups = mapById<AdGroupRow>(newSnap.adGroups, "adGroupId");
  const oldTargets = mapById<TargetRow>(oldSnap.targets, "targetId");
  const newTargets = mapById<TargetRow>(newSnap.targets, "targetId");

  const oldPlacements = new Map<string, PlacementRow>();
  for (const placement of oldSnap.placements) {
    oldPlacements.set(placementKey(placement), placement);
  }
  const newPlacements = new Map<string, PlacementRow>();
  for (const placement of newSnap.placements) {
    newPlacements.set(placementKey(placement), placement);
  }

  const oldCampaignIds = getIdSet(oldSnap.campaigns, "campaignId");
  const newCampaignIds = getIdSet(newSnap.campaigns, "campaignId");
  const oldAdGroupIds = getIdSet(oldSnap.adGroups, "adGroupId");
  const newAdGroupIds = getIdSet(newSnap.adGroups, "adGroupId");
  const oldTargetIds = getIdSet(oldSnap.targets, "targetId");
  const newTargetIds = getIdSet(newSnap.targets, "targetId");

  for (const id of newCampaignIds) {
    if (!oldCampaignIds.has(id)) result.added.campaigns.push(id);
  }
  for (const id of oldCampaignIds) {
    if (!newCampaignIds.has(id)) result.removed.campaigns.push(id);
  }
  for (const id of newAdGroupIds) {
    if (!oldAdGroupIds.has(id)) result.added.adGroups.push(id);
  }
  for (const id of oldAdGroupIds) {
    if (!newAdGroupIds.has(id)) result.removed.adGroups.push(id);
  }
  for (const id of newTargetIds) {
    if (!oldTargetIds.has(id)) result.added.targets.push(id);
  }
  for (const id of oldTargetIds) {
    if (!newTargetIds.has(id)) result.removed.targets.push(id);
  }

  for (const [id, newCampaign] of newCampaigns.entries()) {
    const oldCampaign = oldCampaigns.get(id);
    if (!oldCampaign) continue;
    if (compareString(oldCampaign.campaignNameNorm, newCampaign.campaignNameNorm)) {
      result.campaignRenames.push({
        campaignId: id,
        fromNameRaw: oldCampaign.campaignNameRaw,
        toNameRaw: newCampaign.campaignNameRaw,
        fromNameNorm: oldCampaign.campaignNameNorm,
        toNameNorm: newCampaign.campaignNameNorm,
      });
    }
    if (compareNumber(oldCampaign.dailyBudget, newCampaign.dailyBudget)) {
      result.campaignBudgetChanges.push({
        campaignId: id,
        fromDailyBudget: oldCampaign.dailyBudget,
        toDailyBudget: newCampaign.dailyBudget,
      });
    }
    if (compareString(oldCampaign.biddingStrategy, newCampaign.biddingStrategy)) {
      result.campaignBiddingStrategyChanges.push({
        campaignId: id,
        fromStrategy: oldCampaign.biddingStrategy,
        toStrategy: newCampaign.biddingStrategy,
      });
    }
  }

  for (const [id, newAdGroup] of newAdGroups.entries()) {
    const oldAdGroup = oldAdGroups.get(id);
    if (!oldAdGroup) continue;
    if (compareString(oldAdGroup.adGroupNameNorm, newAdGroup.adGroupNameNorm)) {
      result.adGroupRenames.push({
        adGroupId: id,
        campaignId: newAdGroup.campaignId ?? oldAdGroup.campaignId ?? null,
        fromNameRaw: oldAdGroup.adGroupNameRaw,
        toNameRaw: newAdGroup.adGroupNameRaw,
        fromNameNorm: oldAdGroup.adGroupNameNorm,
        toNameNorm: newAdGroup.adGroupNameNorm,
      });
    }
  }

  for (const [key, newPlacement] of newPlacements.entries()) {
    const oldPlacement = oldPlacements.get(key);
    if (!oldPlacement) continue;
    if (compareNumber(oldPlacement.percentage, newPlacement.percentage)) {
      result.placementChanges.push({
        campaignId: newPlacement.campaignId ?? oldPlacement.campaignId ?? null,
        placement: newPlacement.placement,
        fromPercentage: oldPlacement.percentage,
        toPercentage: newPlacement.percentage,
      });
    }
  }

  for (const [id, newTarget] of newTargets.entries()) {
    const oldTarget = oldTargets.get(id);
    if (!oldTarget) continue;
    const campaignId = newTarget.campaignId ?? oldTarget.campaignId ?? null;
    const adGroupId = newTarget.adGroupId ?? oldTarget.adGroupId ?? null;
    if (compareNumber(oldTarget.bid, newTarget.bid)) {
      result.targetBidChanges.push({
        targetId: id,
        campaignId,
        adGroupId,
        fromBid: oldTarget.bid,
        toBid: newTarget.bid,
      });
    }
    if (compareString(oldTarget.state, newTarget.state)) {
      result.targetStateChanges.push({
        targetId: id,
        campaignId,
        adGroupId,
        fromState: oldTarget.state,
        toState: newTarget.state,
      });
    }
  }

  return result;
}
