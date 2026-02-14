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

export type UpdateTargetStateAction = {
  type: "update_target_state";
  target_id: string;
  new_state: string;
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
  | UpdateTargetStateAction
  | UpdatePlacementModifierAction;

export type SpUpdateChangesFile = {
  exported_at: string;
  notes?: string;
  actions: SpUpdateAction[];
};
