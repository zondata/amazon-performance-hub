export type CreateCampaignAction = {
  type: "create_campaign";
  name: string;
  daily_budget: number;
  bidding_strategy?: string;
  state?: string;
  temp_id?: string;
};

export type CreateAdGroupAction = {
  type: "create_ad_group";
  campaign_name?: string;
  campaign_temp_id?: string;
  ad_group_name: string;
  default_bid?: number;
  state?: string;
  temp_id?: string;
};

export type CreateProductAdAction = {
  type: "create_product_ad";
  campaign_name?: string;
  campaign_temp_id?: string;
  ad_group_name?: string;
  ad_group_temp_id?: string;
  sku?: string;
  asin?: string;
};

export type CreateKeywordAction = {
  type: "create_keyword";
  campaign_name?: string;
  campaign_temp_id?: string;
  ad_group_name?: string;
  ad_group_temp_id?: string;
  keyword_text: string;
  match_type: string;
  bid: number;
  state?: string;
};

export type SpCreateAction =
  | CreateCampaignAction
  | CreateAdGroupAction
  | CreateProductAdAction
  | CreateKeywordAction;

export type SpCreateChangesFile = {
  exported_at?: string;
  notes?: string;
  actions: SpCreateAction[];
};

export type SpCreateResolvedRefs = {
  campaignsByTempId: Map<string, string>;
  adGroupsByTempId: Map<string, { campaignName: string; adGroupName: string }>;
};
