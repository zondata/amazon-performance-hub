import type { SpUpdateAction } from '../../../../../src/bulksheet_gen_sp/types';
import type { SbUpdateAction } from '../../../../../src/bulksheet_gen_sb/types';
import type { SpCreateAction } from '../../../../../src/bulksheet_gen_sp_create/types';

export type SpUpdateRowInput = {
  type?: string | null;
  campaign_id?: string | null;
  ad_group_id?: string | null;
  target_id?: string | null;
  placement_code?: string | null;
  new_bid?: string | number | null;
  new_budget?: string | number | null;
  new_state?: string | null;
  new_pct?: string | number | null;
  new_strategy?: string | null;
};

export type SbUpdateRowInput = {
  type?: string | null;
  campaign_id?: string | null;
  ad_group_id?: string | null;
  target_id?: string | null;
  placement_code?: string | null;
  placement_raw?: string | null;
  new_bid?: string | number | null;
  new_budget?: string | number | null;
  new_state?: string | null;
  new_pct?: string | number | null;
  new_strategy?: string | null;
  new_default_bid?: string | number | null;
};

const toNumber = (value: string | number | null | undefined, label: string) => {
  if (value === null || value === undefined || value === '') return undefined;
  const num = typeof value === 'number' ? value : Number(String(value));
  if (!Number.isFinite(num)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return num;
};

const toString = (value: string | null | undefined, label: string) => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) throw new Error(`Missing ${label}`);
  return trimmed;
};

export const buildSpUpdateActions = (rows: SpUpdateRowInput[]): SpUpdateAction[] => {
  return rows
    .filter((row) => row.type)
    .map((row) => {
      const type = String(row.type);
      if (type === 'update_campaign_budget') {
        return {
          type,
          campaign_id: toString(row.campaign_id, 'campaign_id'),
          new_budget: toNumber(row.new_budget, 'new_budget')!,
        };
      }
      if (type === 'update_campaign_state') {
        return {
          type,
          campaign_id: toString(row.campaign_id, 'campaign_id'),
          new_state: toString(row.new_state, 'new_state'),
        };
      }
      if (type === 'update_campaign_bidding_strategy') {
        return {
          type,
          campaign_id: toString(row.campaign_id, 'campaign_id'),
          new_strategy: toString(row.new_strategy, 'new_strategy'),
        };
      }
      if (type === 'update_ad_group_state') {
        return {
          type,
          ad_group_id: toString(row.ad_group_id, 'ad_group_id'),
          new_state: toString(row.new_state, 'new_state'),
        };
      }
      if (type === 'update_ad_group_default_bid') {
        return {
          type,
          ad_group_id: toString(row.ad_group_id, 'ad_group_id'),
          new_bid: toNumber(row.new_bid, 'new_bid')!,
        };
      }
      if (type === 'update_target_bid') {
        return {
          type,
          target_id: toString(row.target_id, 'target_id'),
          new_bid: toNumber(row.new_bid, 'new_bid')!,
        };
      }
      if (type === 'update_target_state') {
        return {
          type,
          target_id: toString(row.target_id, 'target_id'),
          new_state: toString(row.new_state, 'new_state'),
        };
      }
      if (type === 'update_placement_modifier') {
        return {
          type,
          campaign_id: toString(row.campaign_id, 'campaign_id'),
          placement_code: toString(row.placement_code, 'placement_code'),
          new_pct: toNumber(row.new_pct, 'new_pct')!,
        };
      }
      throw new Error(`Unsupported action type: ${type}`);
    });
};

export const buildSbUpdateActions = (rows: SbUpdateRowInput[]): SbUpdateAction[] => {
  return rows
    .filter((row) => row.type)
    .map((row) => {
      const type = String(row.type);
      if (type === 'update_campaign_budget') {
        return {
          type,
          campaign_id: toString(row.campaign_id, 'campaign_id'),
          new_budget: toNumber(row.new_budget, 'new_budget')!,
        };
      }
      if (type === 'update_campaign_state') {
        return {
          type,
          campaign_id: toString(row.campaign_id, 'campaign_id'),
          new_state: toString(row.new_state, 'new_state'),
        };
      }
      if (type === 'update_campaign_bidding_strategy') {
        return {
          type,
          campaign_id: toString(row.campaign_id, 'campaign_id'),
          new_strategy: toString(row.new_strategy, 'new_strategy'),
        };
      }
      if (type === 'update_ad_group_state') {
        return {
          type,
          ad_group_id: toString(row.ad_group_id, 'ad_group_id'),
          new_state: toString(row.new_state, 'new_state'),
        };
      }
      if (type === 'update_ad_group_default_bid') {
        return {
          type,
          ad_group_id: toString(row.ad_group_id, 'ad_group_id'),
          new_default_bid: toNumber(row.new_default_bid, 'new_default_bid')!,
        };
      }
      if (type === 'update_target_bid') {
        return {
          type,
          target_id: toString(row.target_id, 'target_id'),
          new_bid: toNumber(row.new_bid, 'new_bid')!,
        };
      }
      if (type === 'update_target_state') {
        return {
          type,
          target_id: toString(row.target_id, 'target_id'),
          new_state: toString(row.new_state, 'new_state'),
        };
      }
      if (type === 'update_placement_modifier') {
        return {
          type,
          campaign_id: toString(row.campaign_id, 'campaign_id'),
          placement_raw: row.placement_raw ? String(row.placement_raw) : undefined,
          placement_code: row.placement_code ? String(row.placement_code) : undefined,
          new_pct: toNumber(row.new_pct, 'new_pct')!,
        };
      }
      throw new Error(`Unsupported action type: ${type}`);
    });
};

export type SpCreateBuilderInput = {
  campaignName: string;
  targetingType: string;
  dailyBudget: number;
  portfolioId?: string | null;
  defaultBid?: number | null;
  sku?: string | null;
  asin?: string | null;
  keywords?: { text: string; match_type: string; bid: number }[];
};

export const buildSpCreateActions = (input: SpCreateBuilderInput): SpCreateAction[] => {
  const actions: SpCreateAction[] = [];
  actions.push({
    type: 'create_campaign',
    name: input.campaignName,
    daily_budget: input.dailyBudget,
    targeting_type: input.targetingType,
  });

  actions.push({
    type: 'create_ad_group',
    campaign_name: input.campaignName,
    ad_group_name: `${input.campaignName} - Ad Group`,
    default_bid: input.defaultBid ?? undefined,
  });

  actions.push({
    type: 'create_product_ad',
    campaign_name: input.campaignName,
    ad_group_name: `${input.campaignName} - Ad Group`,
    sku: input.sku ?? undefined,
    asin: input.asin ?? undefined,
    state: 'Paused',
  });

  (input.keywords ?? []).forEach((keyword) => {
    actions.push({
      type: 'create_keyword',
      campaign_name: input.campaignName,
      ad_group_name: `${input.campaignName} - Ad Group`,
      keyword_text: keyword.text,
      match_type: keyword.match_type,
      bid: keyword.bid,
    });
  });

  return actions;
};
