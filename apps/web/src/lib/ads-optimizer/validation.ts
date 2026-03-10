import {
  ADS_OPTIMIZER_ARCHETYPES,
  ADS_OPTIMIZER_CHANNELS,
  ADS_OPTIMIZER_SCOPE_TYPES,
  ADS_OPTIMIZER_VERSION_STATUSES,
  type AdsOptimizerArchetype,
  type AdsOptimizerChannel,
  type AdsOptimizerRulePackPayload,
  type AdsOptimizerScopeType,
  type AdsOptimizerVersionStatus,
  type CreateAdsOptimizerRulePackPayload,
  type CreateAdsOptimizerRulePackVersionPayload,
  type JsonObject,
  type SaveAdsOptimizerManualOverridePayload,
  type SaveAdsOptimizerProductSettingsPayload,
} from './types';

const trimToNull = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asJsonObject = (value: unknown, fieldName: string): JsonObject => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object.`);
  }
  return value as JsonObject;
};

const asNullableJsonObject = (value: unknown, fieldName: string): JsonObject | null => {
  if (value === null || value === undefined) return null;
  return asJsonObject(value, fieldName);
};

const asChannel = (value: unknown, fieldName: string): AdsOptimizerChannel => {
  const trimmed = trimToNull(value);
  if (!trimmed || !ADS_OPTIMIZER_CHANNELS.includes(trimmed as AdsOptimizerChannel)) {
    throw new Error(`${fieldName} must be one of: ${ADS_OPTIMIZER_CHANNELS.join(', ')}.`);
  }
  return trimmed as AdsOptimizerChannel;
};

const asScopeType = (value: unknown, fieldName: string): AdsOptimizerScopeType => {
  const trimmed = trimToNull(value);
  if (!trimmed || !ADS_OPTIMIZER_SCOPE_TYPES.includes(trimmed as AdsOptimizerScopeType)) {
    throw new Error(`${fieldName} must be one of: ${ADS_OPTIMIZER_SCOPE_TYPES.join(', ')}.`);
  }
  return trimmed as AdsOptimizerScopeType;
};

const asStatus = (value: unknown, fieldName: string): AdsOptimizerVersionStatus => {
  const trimmed = trimToNull(value);
  if (!trimmed || !ADS_OPTIMIZER_VERSION_STATUSES.includes(trimmed as AdsOptimizerVersionStatus)) {
    throw new Error(
      `${fieldName} must be one of: ${ADS_OPTIMIZER_VERSION_STATUSES.join(', ')}.`
    );
  }
  return trimmed as AdsOptimizerVersionStatus;
};

const asArchetype = (value: unknown, fieldName: string): AdsOptimizerArchetype => {
  const trimmed = trimToNull(value);
  if (!trimmed || !ADS_OPTIMIZER_ARCHETYPES.includes(trimmed as AdsOptimizerArchetype)) {
    throw new Error(`${fieldName} must be one of: ${ADS_OPTIMIZER_ARCHETYPES.join(', ')}.`);
  }
  return trimmed as AdsOptimizerArchetype;
};

export const validateAdsOptimizerRulePackPayload = (
  value: unknown
): AdsOptimizerRulePackPayload => {
  const payload = asJsonObject(value, 'change_payload_json');
  return {
    schema_version:
      typeof payload.schema_version === 'number' && Number.isFinite(payload.schema_version)
        ? payload.schema_version
        : 1,
    channel: asChannel(payload.channel ?? 'sp', 'change_payload_json.channel'),
    role_templates: asJsonObject(
      payload.role_templates ?? {},
      'change_payload_json.role_templates'
    ) as AdsOptimizerRulePackPayload['role_templates'],
    guardrail_templates: asJsonObject(
      payload.guardrail_templates ?? {},
      'change_payload_json.guardrail_templates'
    ),
    scoring_weights: asJsonObject(
      payload.scoring_weights ?? {},
      'change_payload_json.scoring_weights'
    ) as AdsOptimizerRulePackPayload['scoring_weights'],
    action_policy: asJsonObject(payload.action_policy ?? {}, 'change_payload_json.action_policy'),
  };
};

export const validateCreateAdsOptimizerRulePackPayload = (
  payload: CreateAdsOptimizerRulePackPayload
) => {
  const channel = asChannel(payload.channel ?? 'sp', 'channel');
  const scopeType = asScopeType(payload.scope_type ?? 'account', 'scope_type');
  const scopeValue = trimToNull(payload.scope_value);
  if (scopeType === 'account' && scopeValue !== null) {
    throw new Error('scope_value must be empty for account-scoped rule packs.');
  }
  if (scopeType === 'product' && scopeValue === null) {
    throw new Error('scope_value is required for product-scoped rule packs.');
  }

  const name = trimToNull(payload.name);
  if (!name) {
    throw new Error('name is required.');
  }

  return {
    channel,
    scope_type: scopeType,
    scope_value: scopeType === 'account' ? null : scopeValue,
    name,
    description: trimToNull(payload.description),
  };
};

export const validateCreateAdsOptimizerRulePackVersionPayload = (
  payload: CreateAdsOptimizerRulePackVersionPayload
) => {
  const rulePackId = trimToNull(payload.rule_pack_id);
  if (!rulePackId) {
    throw new Error('rule_pack_id is required.');
  }

  const versionLabel = trimToNull(payload.version_label);
  if (!versionLabel) {
    throw new Error('version_label is required.');
  }

  const changeSummary = trimToNull(payload.change_summary);
  if (!changeSummary) {
    throw new Error('change_summary is required.');
  }

  return {
    rule_pack_id: rulePackId,
    version_label: versionLabel,
    change_summary: changeSummary,
    change_payload_json: validateAdsOptimizerRulePackPayload(payload.change_payload_json ?? {}),
    created_from_version_id: trimToNull(payload.created_from_version_id),
    status: asStatus(payload.status ?? 'draft', 'status'),
  };
};

export const validateSaveAdsOptimizerProductSettingsPayload = (
  payload: SaveAdsOptimizerProductSettingsPayload
) => {
  const productId = trimToNull(payload.product_id);
  if (!productId) {
    throw new Error('product_id is required.');
  }

  const versionId = trimToNull(payload.rule_pack_version_id);
  if (!versionId) {
    throw new Error('rule_pack_version_id is required.');
  }

  return {
    product_id: productId,
    archetype: asArchetype(payload.archetype ?? 'hybrid', 'archetype'),
    optimizer_enabled: payload.optimizer_enabled ?? false,
    default_objective_mode: trimToNull(payload.default_objective_mode),
    rule_pack_version_id: versionId,
    strategic_notes: trimToNull(payload.strategic_notes),
    guardrail_overrides_json: asNullableJsonObject(
      payload.guardrail_overrides_json,
      'guardrail_overrides_json'
    ),
  };
};

export const validateSaveAdsOptimizerManualOverridePayload = (
  payload: SaveAdsOptimizerManualOverridePayload
) => {
  const productId = trimToNull(payload.product_id);
  if (!productId) {
    throw new Error('product_id is required.');
  }

  const overrideKey = trimToNull(payload.override_key);
  if (!overrideKey) {
    throw new Error('override_key is required.');
  }

  return {
    product_id: productId,
    override_key: overrideKey,
    override_value_json: asJsonObject(payload.override_value_json ?? {}, 'override_value_json'),
    notes: trimToNull(payload.notes),
  };
};
