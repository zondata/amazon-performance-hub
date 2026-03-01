export type UpdateSbTargetBidAction = {
  type: "update_target_bid";
  target_id: string;
  new_bid: number;
};

export type UpdateSbCampaignBudgetAction = {
  type: "update_campaign_budget";
  campaign_id: string;
  new_budget: number;
};

export type UpdateSbCampaignStateAction = {
  type: "update_campaign_state";
  campaign_id: string;
  new_state: string;
};

export type UpdateSbCampaignBiddingStrategyAction = {
  type: "update_campaign_bidding_strategy";
  campaign_id: string;
  new_strategy: string;
};

export type UpdateSbTargetStateAction = {
  type: "update_target_state";
  target_id: string;
  new_state: string;
};

export type UpdateSbAdGroupStateAction = {
  type: "update_ad_group_state";
  ad_group_id: string;
  new_state: string;
};

export type UpdateSbAdGroupDefaultBidAction = {
  type: "update_ad_group_default_bid";
  ad_group_id: string;
  new_default_bid: number;
};

export type UpdateSbPlacementModifierAction = {
  type: "update_placement_modifier";
  campaign_id: string;
  placement_raw?: string;
  placement_code?: string;
  new_pct: number;
};

export type SbUpdateAction =
  | UpdateSbTargetBidAction
  | UpdateSbCampaignBudgetAction
  | UpdateSbCampaignStateAction
  | UpdateSbCampaignBiddingStrategyAction
  | UpdateSbTargetStateAction
  | UpdateSbAdGroupStateAction
  | UpdateSbAdGroupDefaultBidAction
  | UpdateSbPlacementModifierAction;

export type SbUpdateChangesFile = {
  exported_at: string;
  product_id?: string;
  notes?: string;
  final_plan_pack_id?: string;
  actions: SbUpdateAction[];
};
