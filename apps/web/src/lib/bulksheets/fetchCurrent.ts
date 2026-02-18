import 'server-only';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { env } from '@/lib/env';

const FETCH_LIMIT = 1000;

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

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

const getLatestBulkSnapshotDate = async (): Promise<string> => {
  const { data, error } = await supabaseAdmin
    .from('uploads')
    .select('snapshot_date')
    .eq('account_id', env.accountId)
    .eq('source_type', 'bulk')
    .not('snapshot_date', 'is', null)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed fetching latest bulk snapshot date: ${error.message}`);
  }
  const snapshotDate = data?.snapshot_date as string | undefined;
  if (!snapshotDate) {
    throw new Error(`No bulk snapshots found for account_id=${env.accountId}`);
  }
  return snapshotDate;
};

const fetchRowsByIds = async <T,>(params: {
  table: string;
  select: string;
  snapshotDate: string;
  idColumn: string;
  ids: string[];
}): Promise<T[]> => {
  const { table, select, snapshotDate, idColumn, ids } = params;
  if (!ids.length) return [];
  const rows: T[] = [];
  for (const chunk of chunkArray(ids, FETCH_LIMIT)) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(select)
      .eq('account_id', env.accountId)
      .eq('snapshot_date', snapshotDate)
      .in(idColumn, chunk);
    if (error) throw new Error(`Failed fetching ${table}: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
  }
  return rows;
};

const placementKey = (campaignId: string, placementCode: string) =>
  `${campaignId}::${placementCode.trim().toLowerCase()}`;

const sbPlacementKey = (campaignId: string, placementRawNorm: string, placementCode: string) =>
  `${campaignId}::${placementRawNorm}::${placementCode}`;

export const fetchCurrentSpData = async (actions: {
  type: string;
  campaign_id?: string;
  target_id?: string;
  ad_group_id?: string;
  placement_code?: string;
}[]): Promise<FetchCurrentResult> => {
  const snapshotDate = await getLatestBulkSnapshotDate();
  const campaignIds = new Set<string>();
  const targetIds = new Set<string>();
  const adGroupIds = new Set<string>();
  const placementCampaignIds = new Set<string>();

  actions.forEach((action) => {
    if (action.type.startsWith('update_campaign')) {
      if (action.campaign_id) campaignIds.add(action.campaign_id);
    }
    if (action.type.startsWith('update_target')) {
      if (action.target_id) targetIds.add(action.target_id);
    }
    if (action.type.startsWith('update_ad_group')) {
      if (action.ad_group_id) adGroupIds.add(action.ad_group_id);
    }
    if (action.type === 'update_placement_modifier') {
      if (action.campaign_id) placementCampaignIds.add(action.campaign_id);
    }
  });

  const targets = await fetchRowsByIds<CurrentTarget>({
    table: 'bulk_targets',
    select:
      'target_id,ad_group_id,campaign_id,expression_raw,match_type,is_negative,state,bid',
    snapshotDate,
    idColumn: 'target_id',
    ids: [...targetIds],
  });

  targets.forEach((target) => {
    if (target.campaign_id) campaignIds.add(target.campaign_id);
    if (target.ad_group_id) adGroupIds.add(target.ad_group_id);
  });

  const adGroups = await fetchRowsByIds<CurrentAdGroup>({
    table: 'bulk_ad_groups',
    select: 'ad_group_id,campaign_id,ad_group_name_raw,state,default_bid',
    snapshotDate,
    idColumn: 'ad_group_id',
    ids: [...adGroupIds],
  });

  adGroups.forEach((adGroup) => {
    if (adGroup.campaign_id) campaignIds.add(adGroup.campaign_id);
  });

  const campaigns = await fetchRowsByIds<CurrentCampaign>({
    table: 'bulk_campaigns',
    select: 'campaign_id,campaign_name_raw,state,daily_budget,bidding_strategy,portfolio_id',
    snapshotDate,
    idColumn: 'campaign_id',
    ids: [...campaignIds],
  });

  const placements = await fetchRowsByIds<CurrentPlacement>({
    table: 'bulk_placements',
    select: 'campaign_id,placement_raw,placement_code,percentage',
    snapshotDate,
    idColumn: 'campaign_id',
    ids: [...placementCampaignIds],
  });

  const campaignsById = new Map<string, CurrentCampaign>();
  campaigns.forEach((campaign) => campaignsById.set(campaign.campaign_id, campaign));

  const adGroupsById = new Map<string, CurrentAdGroup>();
  adGroups.forEach((adGroup) => adGroupsById.set(adGroup.ad_group_id, adGroup));

  const targetsById = new Map<string, CurrentTarget>();
  targets.forEach((target) => targetsById.set(target.target_id, target));

  const placementsByKey = new Map<string, CurrentPlacement>();
  placements.forEach((placement) => {
    placementsByKey.set(placementKey(placement.campaign_id, placement.placement_code), placement);
  });

  return {
    snapshotDate,
    campaignsById,
    adGroupsById,
    targetsById,
    placementsByKey,
  };
};

export const fetchCurrentSbData = async (actions: {
  type: string;
  campaign_id?: string;
  target_id?: string;
  ad_group_id?: string;
  placement_raw?: string;
  placement_code?: string;
}[]): Promise<FetchCurrentSbResult> => {
  const snapshotDate = await getLatestBulkSnapshotDate();
  const campaignIds = new Set<string>();
  const targetIds = new Set<string>();
  const adGroupIds = new Set<string>();
  const placementCampaignIds = new Set<string>();

  actions.forEach((action) => {
    if (action.type.startsWith('update_campaign')) {
      if (action.campaign_id) campaignIds.add(action.campaign_id);
    }
    if (action.type.startsWith('update_target')) {
      if (action.target_id) targetIds.add(action.target_id);
    }
    if (action.type.startsWith('update_ad_group')) {
      if (action.ad_group_id) adGroupIds.add(action.ad_group_id);
    }
    if (action.type === 'update_placement_modifier') {
      if (action.campaign_id) placementCampaignIds.add(action.campaign_id);
    }
  });

  const targets = await fetchRowsByIds<CurrentSbTarget>({
    table: 'bulk_sb_targets',
    select:
      'target_id,ad_group_id,campaign_id,expression_raw,match_type,is_negative,state,bid',
    snapshotDate,
    idColumn: 'target_id',
    ids: [...targetIds],
  });

  targets.forEach((target) => {
    if (target.campaign_id) campaignIds.add(target.campaign_id);
    if (target.ad_group_id) adGroupIds.add(target.ad_group_id);
  });

  const adGroups = await fetchRowsByIds<CurrentSbAdGroup>({
    table: 'bulk_sb_ad_groups',
    select: 'ad_group_id,campaign_id,ad_group_name_raw,state,default_bid',
    snapshotDate,
    idColumn: 'ad_group_id',
    ids: [...adGroupIds],
  });

  adGroups.forEach((adGroup) => {
    if (adGroup.campaign_id) campaignIds.add(adGroup.campaign_id);
  });

  const campaigns = await fetchRowsByIds<CurrentSbCampaign>({
    table: 'bulk_sb_campaigns',
    select: 'campaign_id,campaign_name_raw,state,daily_budget,bidding_strategy,portfolio_id',
    snapshotDate,
    idColumn: 'campaign_id',
    ids: [...campaignIds],
  });

  const placements = await fetchRowsByIds<CurrentSbPlacement>({
    table: 'bulk_sb_placements',
    select: 'campaign_id,placement_raw,placement_raw_norm,placement_code,percentage',
    snapshotDate,
    idColumn: 'campaign_id',
    ids: [...placementCampaignIds],
  });

  const campaignsById = new Map<string, CurrentSbCampaign>();
  campaigns.forEach((campaign) => campaignsById.set(campaign.campaign_id, campaign));

  const adGroupsById = new Map<string, CurrentSbAdGroup>();
  adGroups.forEach((adGroup) => adGroupsById.set(adGroup.ad_group_id, adGroup));

  const targetsById = new Map<string, CurrentSbTarget>();
  targets.forEach((target) => targetsById.set(target.target_id, target));

  const placementsByKey = new Map<string, CurrentSbPlacement>();
  placements.forEach((placement) => {
    placementsByKey.set(
      sbPlacementKey(placement.campaign_id, placement.placement_raw_norm, placement.placement_code),
      placement
    );
  });

  return {
    snapshotDate,
    campaignsById,
    adGroupsById,
    targetsById,
    placementsByKey,
  };
};
