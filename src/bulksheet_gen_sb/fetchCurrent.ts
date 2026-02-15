import { getSupabaseClient } from "../db/supabaseClient";
import { chunkArray } from "../ingest/utils";
import { SbUpdateAction } from "./types";
import { normText } from "../bulk/parseSponsoredProductsBulk";

const FETCH_LIMIT = 1000;

export type CurrentSbCampaign = {
  campaign_id: string;
  campaign_name_raw: string;
  state: string | null;
  daily_budget: number | null;
  bidding_strategy: string | null;
  portfolio_id: string | null;
};

export type CurrentSbAdGroup = {
  ad_group_id: string;
  campaign_id: string;
  ad_group_name_raw: string;
  state: string | null;
  default_bid: number | null;
};

export type CurrentSbTarget = {
  target_id: string;
  ad_group_id: string;
  campaign_id: string;
  expression_raw: string;
  match_type: string;
  is_negative: boolean;
  state: string | null;
  bid: number | null;
};

export type CurrentSbPlacement = {
  campaign_id: string;
  placement_raw: string;
  placement_raw_norm: string;
  placement_code: string;
  percentage: number;
};

export type FetchCurrentSbResult = {
  snapshotDate: string;
  campaignsById: Map<string, CurrentSbCampaign>;
  adGroupsById: Map<string, CurrentSbAdGroup>;
  targetsById: Map<string, CurrentSbTarget>;
  placementsByKey: Map<string, CurrentSbPlacement>;
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
}): Promise<CurrentSbPlacement[]> {
  const { accountId, snapshotDate, campaignIds } = params;
  if (!campaignIds.length) return [];
  const client = getSupabaseClient();
  const rows: CurrentSbPlacement[] = [];
  for (const chunk of chunkArray(campaignIds, FETCH_LIMIT)) {
    const { data, error } = await client
      .from("bulk_sb_placements")
      .select("campaign_id,placement_raw,placement_raw_norm,placement_code,percentage")
      .eq("account_id", accountId)
      .eq("snapshot_date", snapshotDate)
      .in("campaign_id", chunk);
    if (error) throw new Error(`Failed fetching bulk_sb_placements: ${error.message}`);
    rows.push(...((data ?? []) as CurrentSbPlacement[]));
  }
  return rows;
}

function collectActionIds(actions: SbUpdateAction[]) {
  const campaignIds = new Set<string>();
  const targetIds = new Set<string>();
  const adGroupIds = new Set<string>();
  const placementCampaignIds = new Set<string>();
  const placementKeys = new Set<string>();

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
      const raw = action.placement_raw ? normText(action.placement_raw) : "";
      const code = action.placement_code ? action.placement_code.trim().toUpperCase() : "";
      placementKeys.add(`${action.campaign_id}::${raw}::${code}`);
    }
  }

  return {
    campaignIds: [...campaignIds],
    targetIds: [...targetIds],
    adGroupIds: [...adGroupIds],
    placementCampaignIds: [...placementCampaignIds],
    placementKeys: [...placementKeys],
  };
}

function placementKey(
  campaignId: string,
  placementRawNorm: string,
  placementCode: string
): string {
  return `${campaignId}::${placementRawNorm}::${placementCode}`;
}

export async function fetchCurrentSbData(
  accountId: string,
  actions: SbUpdateAction[]
): Promise<FetchCurrentSbResult> {
  const snapshotDate = await fetchLatestBulkSnapshotDate(accountId);
  const { campaignIds, targetIds, placementCampaignIds, adGroupIds: actionAdGroupIds } =
    collectActionIds(actions);

  const targets = await fetchRowsByIds<CurrentSbTarget>({
    table: "bulk_sb_targets",
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

  const adGroups = await fetchRowsByIds<CurrentSbAdGroup>({
    table: "bulk_sb_ad_groups",
    select: "ad_group_id,campaign_id,ad_group_name_raw,state,default_bid",
    accountId,
    snapshotDate,
    idColumn: "ad_group_id",
    ids: [...adGroupIds],
  });

  const campaignsFromAdGroups = new Set<string>();
  for (const adGroup of adGroups) {
    if (adGroup.campaign_id) campaignsFromAdGroups.add(adGroup.campaign_id);
    if (!adGroup.ad_group_name_raw) {
      adGroup.ad_group_name_raw = "Ad group";
    }
  }

  const allCampaignIds = new Set<string>([
    ...campaignIds,
    ...campaignsFromTargets,
    ...placementCampaignIds,
    ...campaignsFromAdGroups,
  ]);

  const campaigns = await fetchRowsByIds<CurrentSbCampaign>({
    table: "bulk_sb_campaigns",
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

  const campaignsById = new Map<string, CurrentSbCampaign>();
  for (const campaign of campaigns) {
    campaignsById.set(campaign.campaign_id, campaign);
  }

  const adGroupsById = new Map<string, CurrentSbAdGroup>();
  for (const adGroup of adGroups) {
    adGroupsById.set(adGroup.ad_group_id, adGroup);
  }

  const targetsById = new Map<string, CurrentSbTarget>();
  for (const target of targets) {
    targetsById.set(target.target_id, target);
  }

  const placementsByKey = new Map<string, CurrentSbPlacement>();
  for (const placement of placements) {
    placementsByKey.set(
      placementKey(
        placement.campaign_id,
        placement.placement_raw_norm,
        placement.placement_code
      ),
      placement
    );
  }

  return {
    snapshotDate,
    campaignsById,
    adGroupsById,
    targetsById,
    placementsByKey,
  };
}

export function getPlacementKey(
  campaignId: string,
  placementRawNorm: string,
  placementCode: string
): string {
  return placementKey(campaignId, placementRawNorm, placementCode);
}
