export const ADS_OPTIMIZER_CHANNELS = ['sp'] as const;
export const ADS_OPTIMIZER_SCOPE_TYPES = ['account', 'product'] as const;
export const ADS_OPTIMIZER_VERSION_STATUSES = ['draft', 'active', 'archived'] as const;
export const ADS_OPTIMIZER_ARCHETYPES = ['design_led', 'visibility_led', 'hybrid'] as const;
export const ADS_OPTIMIZER_STRATEGY_PROFILES = ADS_OPTIMIZER_ARCHETYPES;
export const ADS_OPTIMIZER_RECOMMENDATION_OVERRIDE_SCOPES = [
  'one_time',
  'persistent',
] as const;
export const ADS_OPTIMIZER_RECOMMENDATION_OVERRIDE_ACTION_TYPES = [
  'update_target_bid',
  'update_target_state',
  'update_campaign_bidding_strategy',
  'update_placement_modifier',
] as const;

export type JsonObject = Record<string, unknown>;

export type AdsOptimizerChannel = (typeof ADS_OPTIMIZER_CHANNELS)[number];
export type AdsOptimizerScopeType = (typeof ADS_OPTIMIZER_SCOPE_TYPES)[number];
export type AdsOptimizerVersionStatus = (typeof ADS_OPTIMIZER_VERSION_STATUSES)[number];
export type AdsOptimizerArchetype = (typeof ADS_OPTIMIZER_ARCHETYPES)[number];
export type AdsOptimizerStrategyProfile = (typeof ADS_OPTIMIZER_STRATEGY_PROFILES)[number];
export type AdsOptimizerRecommendationOverrideScope =
  (typeof ADS_OPTIMIZER_RECOMMENDATION_OVERRIDE_SCOPES)[number];
export type AdsOptimizerRecommendationOverrideActionType =
  (typeof ADS_OPTIMIZER_RECOMMENDATION_OVERRIDE_ACTION_TYPES)[number];

export type AdsOptimizerRoleTemplate = {
  enabled: boolean;
  notes: string;
};

export type AdsOptimizerLossMakerPolicy = {
  protected_ad_sales_share_min: number;
  protected_order_share_min: number;
  protected_total_sales_share_min: number;
  shallow_loss_ratio_max: number;
  moderate_loss_ratio_max: number;
  severe_loss_ratio_min: number;
  pause_protected_contributors: boolean;
};

export type AdsOptimizerPhasedRecoveryPolicy = {
  default_steps: number;
  important_target_steps: number;
  visibility_led_steps: number;
  design_led_steps: number;
  max_step_bid_decrease_pct: number;
  continue_until_break_even: boolean;
};

export type AdsOptimizerRoleBiasPolicy = {
  visibility_led_rank_defend_bias: boolean;
  design_led_long_tail_suppress_bias: boolean;
};

export type AdsOptimizerRulePackPayload = {
  schema_version: number;
  channel: AdsOptimizerChannel;
  strategy_profile?: AdsOptimizerStrategyProfile | null;
  role_templates: Record<string, AdsOptimizerRoleTemplate>;
  guardrail_templates: JsonObject;
  scoring_weights: Record<string, number>;
  action_policy: JsonObject;
  state_engine: JsonObject;
  loss_maker_policy?: Partial<AdsOptimizerLossMakerPolicy> | null;
  phased_recovery_policy?: Partial<AdsOptimizerPhasedRecoveryPolicy> | null;
  role_bias_policy?: Partial<AdsOptimizerRoleBiasPolicy> | null;
};

export type AdsOptimizerRulePack = {
  rule_pack_id: string;
  account_id: string;
  marketplace: string;
  channel: AdsOptimizerChannel;
  scope_type: AdsOptimizerScopeType;
  scope_value: string | null;
  name: string;
  description: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type AdsOptimizerRulePackVersion = {
  rule_pack_version_id: string;
  rule_pack_id: string;
  version_label: string;
  status: AdsOptimizerVersionStatus;
  change_summary: string;
  change_payload_json: AdsOptimizerRulePackPayload;
  created_from_version_id: string | null;
  created_at: string;
  activated_at: string | null;
  archived_at: string | null;
};

export type AdsOptimizerProductSettings = {
  product_id: string;
  account_id: string;
  marketplace: string;
  archetype: AdsOptimizerArchetype;
  optimizer_enabled: boolean;
  default_objective_mode: string | null;
  rule_pack_version_id: string;
  strategic_notes: string | null;
  guardrail_overrides_json: JsonObject | null;
  created_at: string;
  updated_at: string;
};

export type AdsOptimizerManualOverride = {
  manual_override_id: string;
  account_id: string;
  marketplace: string;
  product_id: string;
  override_key: string;
  override_value_json: JsonObject;
  notes: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type AdsOptimizerRecommendationOverrideAction = {
  action_type: AdsOptimizerRecommendationOverrideActionType;
  entity_context_json: JsonObject | null;
  proposed_change_json: JsonObject;
};

export type AdsOptimizerRecommendationOverride = {
  recommendation_override_id: string;
  account_id: string;
  marketplace: string;
  product_id: string;
  asin: string;
  target_id: string;
  run_id: string;
  target_snapshot_id: string;
  recommendation_snapshot_id: string;
  override_scope: AdsOptimizerRecommendationOverrideScope;
  replacement_action_bundle_json: {
    actions: AdsOptimizerRecommendationOverrideAction[];
  };
  operator_note: string;
  is_archived: boolean;
  last_applied_at: string | null;
  last_applied_change_set_id: string | null;
  apply_count: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type AdsOptimizerRulePackPayloadInput = {
  schema_version?: number;
  channel?: string | null;
  strategy_profile?: string | null;
  role_templates?: unknown;
  guardrail_templates?: unknown;
  scoring_weights?: unknown;
  action_policy?: unknown;
  state_engine?: unknown;
  loss_maker_policy?: unknown;
  phased_recovery_policy?: unknown;
  role_bias_policy?: unknown;
};

export type CreateAdsOptimizerRulePackPayload = {
  channel?: string | null;
  scope_type?: string | null;
  scope_value?: string | null;
  name?: string | null;
  description?: string | null;
};

export type CreateAdsOptimizerRulePackVersionPayload = {
  rule_pack_id?: string | null;
  version_label?: string | null;
  change_summary?: string | null;
  change_payload_json?: unknown;
  created_from_version_id?: string | null;
  status?: string | null;
};

export type SaveAdsOptimizerProductSettingsPayload = {
  product_id?: string | null;
  archetype?: string | null;
  optimizer_enabled?: boolean | null;
  default_objective_mode?: string | null;
  rule_pack_version_id?: string | null;
  strategic_notes?: string | null;
  guardrail_overrides_json?: unknown;
};

export type SaveAdsOptimizerManualOverridePayload = {
  product_id?: string | null;
  override_key?: string | null;
  override_value_json?: unknown;
  notes?: string | null;
};

export type SaveAdsOptimizerRecommendationOverridePayload = {
  product_id?: string | null;
  asin?: string | null;
  target_id?: string | null;
  run_id?: string | null;
  target_snapshot_id?: string | null;
  recommendation_snapshot_id?: string | null;
  override_scope?: string | null;
  replacement_action_bundle_json?: unknown;
  operator_note?: string | null;
};

export type AdsOptimizerRulePackRow = AdsOptimizerRulePack;

export type AdsOptimizerRulePackVersionRow = Omit<
  AdsOptimizerRulePackVersion,
  'change_payload_json'
> & {
  change_payload_json: unknown;
};

export type AdsOptimizerProductSettingsRow = Omit<
  AdsOptimizerProductSettings,
  'guardrail_overrides_json'
> & {
  guardrail_overrides_json: unknown | null;
};

export type AdsOptimizerManualOverrideRow = Omit<
  AdsOptimizerManualOverride,
  'override_value_json'
> & {
  override_value_json: unknown;
};

export type AdsOptimizerRecommendationOverrideRow = Omit<
  AdsOptimizerRecommendationOverride,
  'replacement_action_bundle_json'
> & {
  replacement_action_bundle_json: unknown;
};

const asJsonObject = (value: unknown, fieldName: string): JsonObject => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object.`);
  }
  return value as JsonObject;
};

const asNullableJsonObject = (value: unknown, fieldName: string): JsonObject | null => {
  if (value === null || value === undefined) {
    return null;
  }
  return asJsonObject(value, fieldName);
};

export const mapAdsOptimizerRulePackRow = (
  row: AdsOptimizerRulePackRow
): AdsOptimizerRulePack => ({
  ...row,
  channel: row.channel as AdsOptimizerChannel,
  scope_type: row.scope_type as AdsOptimizerScopeType,
});

export const mapAdsOptimizerRulePackVersionRow = (
  row: AdsOptimizerRulePackVersionRow
): AdsOptimizerRulePackVersion => ({
  ...row,
  status: row.status as AdsOptimizerVersionStatus,
  change_payload_json: asJsonObject(
    row.change_payload_json,
    'ads_optimizer_rule_pack_versions.change_payload_json'
  ) as AdsOptimizerRulePackPayload,
});

export const mapAdsOptimizerProductSettingsRow = (
  row: AdsOptimizerProductSettingsRow
): AdsOptimizerProductSettings => ({
  ...row,
  archetype: row.archetype as AdsOptimizerArchetype,
  guardrail_overrides_json: asNullableJsonObject(
    row.guardrail_overrides_json,
    'ads_optimizer_product_settings.guardrail_overrides_json'
  ),
});

export const mapAdsOptimizerManualOverrideRow = (
  row: AdsOptimizerManualOverrideRow
): AdsOptimizerManualOverride => ({
  ...row,
  override_value_json: asJsonObject(
    row.override_value_json,
    'ads_optimizer_manual_overrides.override_value_json'
  ),
});

export const mapAdsOptimizerRecommendationOverrideRow = (
  row: AdsOptimizerRecommendationOverrideRow
): AdsOptimizerRecommendationOverride => ({
  ...row,
  override_scope: row.override_scope as AdsOptimizerRecommendationOverrideScope,
  replacement_action_bundle_json: asJsonObject(
    row.replacement_action_bundle_json,
    'ads_optimizer_recommendation_overrides.replacement_action_bundle_json'
  ) as AdsOptimizerRecommendationOverride['replacement_action_bundle_json'],
});
