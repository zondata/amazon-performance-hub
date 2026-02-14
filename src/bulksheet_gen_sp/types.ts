export type UpdateTargetBidAction = {
  type: "update_target_bid";
  target_id: string;
  new_bid: number;
};

export type UpdateCampaignBudgetAction = {
  type: "update_campaign_budget";
  campaign_id: string;
  new_budget: number;
};

export type UpdateCampaignStateAction = {
  type: "update_campaign_state";
  campaign_id: string;
  new_state: string;
};

export type UpdateCampaignBiddingStrategyAction = {
  type: "update_campaign_bidding_strategy";
  campaign_id: string;
  new_strategy: string;
};

export type UpdateTargetStateAction = {
  type: "update_target_state";
  target_id: string;
  new_state: string;
};

export type UpdateAdGroupStateAction = {
  type: "update_ad_group_state";
  ad_group_id: string;
  new_state: string;
};

export type UpdateAdGroupDefaultBidAction = {
  type: "update_ad_group_default_bid";
  ad_group_id: string;
  new_bid: number;
};

export type UpdatePlacementModifierAction = {
  type: "update_placement_modifier";
  campaign_id: string;
  placement_code: string;
  new_pct: number;
};

export type SpUpdateAction =
  | UpdateTargetBidAction
  | UpdateCampaignBudgetAction
  | UpdateCampaignStateAction
  | UpdateCampaignBiddingStrategyAction
  | UpdateTargetStateAction
  | UpdateAdGroupStateAction
  | UpdateAdGroupDefaultBidAction
  | UpdatePlacementModifierAction;

export type SpUpdateChangesFile = {
  exported_at: string;
  notes?: string;
  actions: SpUpdateAction[];
};
