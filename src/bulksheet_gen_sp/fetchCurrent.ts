import { getSupabaseClient } from "../db/supabaseClient";
import { chunkArray } from "../ingest/utils";
import { SpUpdateAction } from "./types";

const FETCH_LIMIT = 1000;

export type CurrentCampaign = {
  campaign_id: string;
  campaign_name_raw: string;
  state: string | null;
  daily_budget: number | null;
  bidding_strategy: string | null;
  portfolio_id: string | null;
};

export type CurrentAdGroup = {
  ad_group_id: string;
  campaign_id: string;
  ad_group_name_raw: string;
  state: string | null;
  default_bid: number | null;
};

export type CurrentTarget = {
  target_id: string;
  ad_group_id: string | null;
  campaign_id: string | null;
  expression_raw: string;
  match_type: string;
  is_negative: boolean;
  state: string | null;
  bid: number | null;
};

export type CurrentPlacement = {
  campaign_id: string;
  placement_raw: string;
  placement_code: string;
  percentage: number;
};

export type FetchCurrentResult = {
  snapshotDate: string;
  campaignsById: Map<string, CurrentCampaign>;
  adGroupsById: Map<string, CurrentAdGroup>;
  targetsById: Map<string, CurrentTarget>;
  placementsByKey: Map<string, CurrentPlacement>;
};

async function fetchLatestBulkSnapshotDate(accountId: string): Promise<string> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("uploads")
    .select("snapshot_date")
    .eq("account_id", accountId)
    .eq("source_type", "bulk")
    .not("snapshot_date", "is", null)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed fetching latest bulk snapshot date: ${error.message}`);
  }
  const snapshotDate = data?.snapshot_date as string | undefined;
  if (!snapshotDate) {
    throw new Error(`No bulk snapshots found for account_id=${accountId}`);
  }
  return snapshotDate;
}

async function fetchRowsByIds<T>(params: {
  table: string;
  select: string;
  accountId: string;
  snapshotDate: string;
  idColumn: string;
  ids: string[];
}): Promise<T[]> {
  const { table, select, accountId, snapshotDate, idColumn, ids } = params;
  if (!ids.length) return [];
  const client = getSupabaseClient();
  const rows: T[] = [];
  for (const chunk of chunkArray(ids, FETCH_LIMIT)) {
    const { data, error } = await client
      .from(table)
      .select(select)
      .eq("account_id", accountId)
      .eq("snapshot_date", snapshotDate)
      .in(idColumn, chunk);
    if (error) throw new Error(`Failed fetching ${table}: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
  }
  return rows;
}

async function fetchPlacements(params: {
  accountId: string;
  snapshotDate: string;
  campaignIds: string[];
}): Promise<CurrentPlacement[]> {
  const { accountId, snapshotDate, campaignIds } = params;
  if (!campaignIds.length) return [];
  const client = getSupabaseClient();
  const rows: CurrentPlacement[] = [];
  for (const chunk of chunkArray(campaignIds, FETCH_LIMIT)) {
    const { data, error } = await client
      .from("bulk_placements")
      .select("campaign_id,placement_raw,placement_code,percentage")
      .eq("account_id", accountId)
      .eq("snapshot_date", snapshotDate)
      .in("campaign_id", chunk);
    if (error) throw new Error(`Failed fetching bulk_placements: ${error.message}`);
    rows.push(...((data ?? []) as CurrentPlacement[]));
  }
  return rows;
}

function collectActionIds(actions: SpUpdateAction[]) {
  const campaignIds = new Set<string>();
  const targetIds = new Set<string>();
  const adGroupIds = new Set<string>();
  const placementCampaignIds = new Set<string>();
  const placementCodes = new Set<string>();

  for (const action of actions) {
    if (
      action.type === "update_campaign_budget" ||
      action.type === "update_campaign_state" ||
      action.type === "update_campaign_bidding_strategy"
    ) {
      campaignIds.add(action.campaign_id);
      continue;
    }
    if (action.type === "update_target_bid" || action.type === "update_target_state") {
      targetIds.add(action.target_id);
      continue;
    }
    if (action.type === "update_ad_group_state") {
      adGroupIds.add(action.ad_group_id);
      continue;
    }
    if (action.type === "update_ad_group_default_bid") {
      adGroupIds.add(action.ad_group_id);
      continue;
    }
    if (action.type === "update_placement_modifier") {
      placementCampaignIds.add(action.campaign_id);
      placementCodes.add(action.placement_code);
    }
  }

  return {
    campaignIds: [...campaignIds],
    targetIds: [...targetIds],
    adGroupIds: [...adGroupIds],
    placementCampaignIds: [...placementCampaignIds],
    placementCodes: [...placementCodes],
  };
}

function placementKey(campaignId: string, placementCode: string): string {
  return `${campaignId}::${placementCode.trim().toLowerCase()}`;
}

export async function fetchCurrentSpData(
  accountId: string,
  actions: SpUpdateAction[]
): Promise<FetchCurrentResult> {
  const snapshotDate = await fetchLatestBulkSnapshotDate(accountId);
  const { campaignIds, targetIds, placementCampaignIds, adGroupIds: actionAdGroupIds } =
    collectActionIds(actions);

  const targets = await fetchRowsByIds<CurrentTarget>({
    table: "bulk_targets",
    select:
      "target_id,ad_group_id,campaign_id,expression_raw,match_type,is_negative,state,bid",
    accountId,
    snapshotDate,
    idColumn: "target_id",
    ids: targetIds,
  });

  const campaignsFromTargets = new Set<string>();
  const adGroupIds = new Set<string>(actionAdGroupIds);
  for (const target of targets) {
    if (target.campaign_id) campaignsFromTargets.add(target.campaign_id);
    if (target.ad_group_id) adGroupIds.add(target.ad_group_id);
  }

  const adGroups = await fetchRowsByIds<CurrentAdGroup>({
    table: "bulk_ad_groups",
    select: "ad_group_id,campaign_id,ad_group_name_raw,state,default_bid",
    accountId,
    snapshotDate,
    idColumn: "ad_group_id",
    ids: [...adGroupIds],
  });

  const campaignsFromAdGroups = new Set<string>();
  for (const adGroup of adGroups) {
    if (adGroup.campaign_id) campaignsFromAdGroups.add(adGroup.campaign_id);
  }

  const allCampaignIds = new Set<string>([
    ...campaignIds,
    ...campaignsFromTargets,
    ...placementCampaignIds,
    ...campaignsFromAdGroups,
  ]);

  const campaigns = await fetchRowsByIds<CurrentCampaign>({
    table: "bulk_campaigns",
    select:
      "campaign_id,campaign_name_raw,state,daily_budget,bidding_strategy,portfolio_id",
    accountId,
    snapshotDate,
    idColumn: "campaign_id",
    ids: [...allCampaignIds],
  });

  const placements = await fetchPlacements({
    accountId,
    snapshotDate,
    campaignIds: placementCampaignIds,
  });

  const campaignsById = new Map<string, CurrentCampaign>();
  for (const campaign of campaigns) {
    campaignsById.set(campaign.campaign_id, campaign);
  }

  const adGroupsById = new Map<string, CurrentAdGroup>();
  for (const adGroup of adGroups) {
    adGroupsById.set(adGroup.ad_group_id, adGroup);
  }

  const targetsById = new Map<string, CurrentTarget>();
  for (const target of targets) {
    targetsById.set(target.target_id, target);
  }

  const placementsByKey = new Map<string, CurrentPlacement>();
  for (const placement of placements) {
    placementsByKey.set(placementKey(placement.campaign_id, placement.placement_code), placement);
  }

  return {
    snapshotDate,
    campaignsById,
    adGroupsById,
    targetsById,
    placementsByKey,
  };
}

export function getPlacementKey(campaignId: string, placementCode: string): string {
  return placementKey(campaignId, placementCode);
}
