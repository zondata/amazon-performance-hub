export const ADS_OPTIMIZER_CHANNELS = ['sp'] as const;
export const ADS_OPTIMIZER_SCOPE_TYPES = ['account', 'product'] as const;
export const ADS_OPTIMIZER_VERSION_STATUSES = ['draft', 'active', 'archived'] as const;
export const ADS_OPTIMIZER_ARCHETYPES = ['design_led', 'visibility_led', 'hybrid'] as const;

export type JsonObject = Record<string, unknown>;

export type AdsOptimizerChannel = (typeof ADS_OPTIMIZER_CHANNELS)[number];
export type AdsOptimizerScopeType = (typeof ADS_OPTIMIZER_SCOPE_TYPES)[number];
export type AdsOptimizerVersionStatus = (typeof ADS_OPTIMIZER_VERSION_STATUSES)[number];
export type AdsOptimizerArchetype = (typeof ADS_OPTIMIZER_ARCHETYPES)[number];

export type AdsOptimizerRoleTemplate = {
  enabled: boolean;
  notes: string;
};

export type AdsOptimizerRulePackPayload = {
  schema_version: number;
  channel: AdsOptimizerChannel;
  role_templates: Record<string, AdsOptimizerRoleTemplate>;
  guardrail_templates: JsonObject;
  scoring_weights: Record<string, number>;
  action_policy: JsonObject;
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

export type AdsOptimizerRulePackPayloadInput = {
  schema_version?: number;
  channel?: string | null;
  role_templates?: unknown;
  guardrail_templates?: unknown;
  scoring_weights?: unknown;
  action_policy?: unknown;
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
