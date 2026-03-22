import {
  ADS_OPTIMIZER_ARCHETYPES,
  ADS_OPTIMIZER_CHANNELS,
  ADS_OPTIMIZER_RECOMMENDATION_OVERRIDE_ACTION_TYPES,
  ADS_OPTIMIZER_RECOMMENDATION_OVERRIDE_SCOPES,
  ADS_OPTIMIZER_SCOPE_TYPES,
  ADS_OPTIMIZER_STRATEGY_PROFILES,
  ADS_OPTIMIZER_VERSION_STATUSES,
  type AdsOptimizerArchetype,
  type AdsOptimizerChannel,
  type AdsOptimizerLossMakerPolicy,
  type AdsOptimizerPhasedRecoveryPolicy,
  type AdsOptimizerRecommendationOverrideActionType,
  type AdsOptimizerRecommendationOverrideScope,
  type AdsOptimizerRoleBiasPolicy,
  type AdsOptimizerRulePackPayload,
  type AdsOptimizerScopeType,
  type AdsOptimizerStrategyProfile,
  type AdsOptimizerVersionStatus,
  type CreateAdsOptimizerRulePackPayload,
  type CreateAdsOptimizerRulePackVersionPayload,
  type JsonObject,
  type SaveAdsOptimizerManualOverridePayload,
  type SaveAdsOptimizerRecommendationOverridePayload,
  type SaveAdsOptimizerProductSettingsPayload,
} from './types';

const CANONICAL_PLACEMENT_CODES = [
  'PLACEMENT_TOP',
  'PLACEMENT_REST_OF_SEARCH',
  'PLACEMENT_PRODUCT_PAGE',
] as const;

type CanonicalPlacementCode = (typeof CANONICAL_PLACEMENT_CODES)[number];

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

const asStrategyProfile = (
  value: unknown,
  fieldName: string
): AdsOptimizerStrategyProfile => {
  const trimmed = trimToNull(value);
  if (
    !trimmed ||
    !ADS_OPTIMIZER_STRATEGY_PROFILES.includes(trimmed as AdsOptimizerStrategyProfile)
  ) {
    throw new Error(
      `${fieldName} must be one of: ${ADS_OPTIMIZER_STRATEGY_PROFILES.join(', ')}.`
    );
  }
  return trimmed as AdsOptimizerStrategyProfile;
};

const asOptionalNumber = (value: unknown, fieldName: string) => {
  if (value === null || value === undefined || value === '') return undefined;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`${fieldName} must be a finite number when provided.`);
  }
  return numeric;
};

const asOptionalBoolean = (value: unknown, fieldName: string) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'boolean') {
    throw new Error(`${fieldName} must be a boolean when provided.`);
  }
  return value;
};

const asRecommendationOverrideScope = (
  value: unknown,
  fieldName: string
): AdsOptimizerRecommendationOverrideScope => {
  const trimmed = trimToNull(value);
  if (
    !trimmed ||
    !ADS_OPTIMIZER_RECOMMENDATION_OVERRIDE_SCOPES.includes(
      trimmed as AdsOptimizerRecommendationOverrideScope
    )
  ) {
    throw new Error(
      `${fieldName} must be one of: ${ADS_OPTIMIZER_RECOMMENDATION_OVERRIDE_SCOPES.join(', ')}.`
    );
  }
  return trimmed as AdsOptimizerRecommendationOverrideScope;
};

const asRecommendationOverrideActionType = (
  value: unknown,
  fieldName: string
): AdsOptimizerRecommendationOverrideActionType => {
  const trimmed = trimToNull(value);
  if (
    !trimmed ||
    !ADS_OPTIMIZER_RECOMMENDATION_OVERRIDE_ACTION_TYPES.includes(
      trimmed as AdsOptimizerRecommendationOverrideActionType
    )
  ) {
    throw new Error(
      `${fieldName} must be one of: ${ADS_OPTIMIZER_RECOMMENDATION_OVERRIDE_ACTION_TYPES.join(', ')}.`
    );
  }
  return trimmed as AdsOptimizerRecommendationOverrideActionType;
};

const asCanonicalPlacementCode = (
  value: unknown,
  fieldName: string
): CanonicalPlacementCode => {
  const trimmed = trimToNull(value);
  if (!trimmed) {
    throw new Error(`${fieldName} is required.`);
  }
  if (!CANONICAL_PLACEMENT_CODES.includes(trimmed as CanonicalPlacementCode)) {
    throw new Error(
      `${fieldName} must be one of: ${CANONICAL_PLACEMENT_CODES.join(', ')}.`
    );
  }
  return trimmed as CanonicalPlacementCode;
};

const validateLossMakerPolicy = (value: unknown): Partial<AdsOptimizerLossMakerPolicy> | null => {
  if (value === null || value === undefined) return null;
  const policy = asJsonObject(value, 'change_payload_json.loss_maker_policy');

  return {
    protected_ad_sales_share_min: asOptionalNumber(
      policy.protected_ad_sales_share_min,
      'change_payload_json.loss_maker_policy.protected_ad_sales_share_min'
    ),
    protected_order_share_min: asOptionalNumber(
      policy.protected_order_share_min,
      'change_payload_json.loss_maker_policy.protected_order_share_min'
    ),
    protected_total_sales_share_min: asOptionalNumber(
      policy.protected_total_sales_share_min,
      'change_payload_json.loss_maker_policy.protected_total_sales_share_min'
    ),
    shallow_loss_ratio_max: asOptionalNumber(
      policy.shallow_loss_ratio_max,
      'change_payload_json.loss_maker_policy.shallow_loss_ratio_max'
    ),
    moderate_loss_ratio_max: asOptionalNumber(
      policy.moderate_loss_ratio_max,
      'change_payload_json.loss_maker_policy.moderate_loss_ratio_max'
    ),
    severe_loss_ratio_min: asOptionalNumber(
      policy.severe_loss_ratio_min,
      'change_payload_json.loss_maker_policy.severe_loss_ratio_min'
    ),
    pause_protected_contributors: asOptionalBoolean(
      policy.pause_protected_contributors,
      'change_payload_json.loss_maker_policy.pause_protected_contributors'
    ),
  };
};

const validatePhasedRecoveryPolicy = (
  value: unknown
): Partial<AdsOptimizerPhasedRecoveryPolicy> | null => {
  if (value === null || value === undefined) return null;
  const policy = asJsonObject(value, 'change_payload_json.phased_recovery_policy');

  return {
    default_steps: asOptionalNumber(
      policy.default_steps,
      'change_payload_json.phased_recovery_policy.default_steps'
    ),
    important_target_steps: asOptionalNumber(
      policy.important_target_steps,
      'change_payload_json.phased_recovery_policy.important_target_steps'
    ),
    visibility_led_steps: asOptionalNumber(
      policy.visibility_led_steps,
      'change_payload_json.phased_recovery_policy.visibility_led_steps'
    ),
    design_led_steps: asOptionalNumber(
      policy.design_led_steps,
      'change_payload_json.phased_recovery_policy.design_led_steps'
    ),
    max_step_bid_decrease_pct: asOptionalNumber(
      policy.max_step_bid_decrease_pct,
      'change_payload_json.phased_recovery_policy.max_step_bid_decrease_pct'
    ),
    continue_until_break_even: asOptionalBoolean(
      policy.continue_until_break_even,
      'change_payload_json.phased_recovery_policy.continue_until_break_even'
    ),
  };
};

const validateRoleBiasPolicy = (value: unknown): Partial<AdsOptimizerRoleBiasPolicy> | null => {
  if (value === null || value === undefined) return null;
  const policy = asJsonObject(value, 'change_payload_json.role_bias_policy');

  return {
    visibility_led_rank_defend_bias: asOptionalBoolean(
      policy.visibility_led_rank_defend_bias,
      'change_payload_json.role_bias_policy.visibility_led_rank_defend_bias'
    ),
    design_led_long_tail_suppress_bias: asOptionalBoolean(
      policy.design_led_long_tail_suppress_bias,
      'change_payload_json.role_bias_policy.design_led_long_tail_suppress_bias'
    ),
  };
};

export const validateAdsOptimizerRulePackPayload = (
  value: unknown
): AdsOptimizerRulePackPayload => {
  const payload = asJsonObject(value, 'change_payload_json');
  return {
    schema_version:
      typeof payload.schema_version === 'number' && Number.isFinite(payload.schema_version)
        ? payload.schema_version
        : 2,
    channel: asChannel(payload.channel ?? 'sp', 'change_payload_json.channel'),
    strategy_profile:
      payload.strategy_profile === null || payload.strategy_profile === undefined
        ? undefined
        : asStrategyProfile(payload.strategy_profile, 'change_payload_json.strategy_profile'),
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
    state_engine: asJsonObject(payload.state_engine ?? {}, 'change_payload_json.state_engine'),
    action_policy: asJsonObject(payload.action_policy ?? {}, 'change_payload_json.action_policy'),
    loss_maker_policy: validateLossMakerPolicy(payload.loss_maker_policy),
    phased_recovery_policy: validatePhasedRecoveryPolicy(payload.phased_recovery_policy),
    role_bias_policy: validateRoleBiasPolicy(payload.role_bias_policy),
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

export const validateSaveAdsOptimizerRecommendationOverridePayload = (
  payload: SaveAdsOptimizerRecommendationOverridePayload
) => {
  const productId = trimToNull(payload.product_id);
  const asin = trimToNull(payload.asin);
  const targetId = trimToNull(payload.target_id);
  const runId = trimToNull(payload.run_id);
  const targetSnapshotId = trimToNull(payload.target_snapshot_id);
  const recommendationSnapshotId = trimToNull(payload.recommendation_snapshot_id);
  const operatorNote = trimToNull(payload.operator_note);

  if (!productId) throw new Error('product_id is required.');
  if (!asin) throw new Error('asin is required.');
  if (!targetId) throw new Error('target_id is required.');
  if (!runId) throw new Error('run_id is required.');
  if (!targetSnapshotId) throw new Error('target_snapshot_id is required.');
  if (!recommendationSnapshotId) throw new Error('recommendation_snapshot_id is required.');
  if (!operatorNote) throw new Error('operator_note is required.');

  const bundle = asJsonObject(
    payload.replacement_action_bundle_json ?? {},
    'replacement_action_bundle_json'
  );
  const rawActions = Array.isArray(bundle.actions) ? bundle.actions : [];
  if (rawActions.length === 0) {
    throw new Error('replacement_action_bundle_json.actions must include at least one action.');
  }

  const seenSingleActionTypes = new Set<
    Exclude<AdsOptimizerRecommendationOverrideActionType, 'update_placement_modifier'>
  >();
  const seenPlacementCodes = new Set<CanonicalPlacementCode>();
  const actions = rawActions.map((entry, index) => {
    const action = asJsonObject(
      entry,
      `replacement_action_bundle_json.actions[${index}]`
    );
    const actionType = asRecommendationOverrideActionType(
      action.action_type,
      `replacement_action_bundle_json.actions[${index}].action_type`
    );

    const entityContext =
      action.entity_context_json === null || action.entity_context_json === undefined
        ? null
        : asJsonObject(
            action.entity_context_json,
            `replacement_action_bundle_json.actions[${index}].entity_context_json`
          );
    const proposedChange = asJsonObject(
      action.proposed_change_json,
      `replacement_action_bundle_json.actions[${index}].proposed_change_json`
    );

    if (actionType === 'update_target_bid') {
      if (seenSingleActionTypes.has(actionType)) {
        throw new Error(`replacement action ${actionType} can only appear once per override.`);
      }
      seenSingleActionTypes.add(actionType);
      const nextBid = Number(proposedChange.next_bid);
      if (!Number.isFinite(nextBid) || nextBid <= 0) {
        throw new Error('update_target_bid override requires a positive next_bid.');
      }
    } else if (actionType === 'update_target_state') {
      if (seenSingleActionTypes.has(actionType)) {
        throw new Error(`replacement action ${actionType} can only appear once per override.`);
      }
      seenSingleActionTypes.add(actionType);
      const nextState = trimToNull(proposedChange.next_state);
      if (!nextState || !['enabled', 'paused', 'archived'].includes(nextState)) {
        throw new Error(
          'update_target_state override requires next_state of enabled, paused, or archived.'
        );
      }
    } else if (actionType === 'update_placement_modifier') {
      const nextPercentage = Number(proposedChange.next_percentage);
      const placementCodeRaw =
        trimToNull(proposedChange.placement_code) ?? trimToNull(entityContext?.placement_code);
      if (!placementCodeRaw) {
        throw new Error('update_placement_modifier override requires placement_code.');
      }
      const placementCode = asCanonicalPlacementCode(
        placementCodeRaw,
        'update_placement_modifier override placement_code'
      );
      if (seenPlacementCodes.has(placementCode)) {
        throw new Error(
          `update_placement_modifier override can only appear once per placement_code (${placementCode}).`
        );
      }
      seenPlacementCodes.add(placementCode);
      if (!Number.isFinite(nextPercentage) || nextPercentage < 0) {
        throw new Error(
          'update_placement_modifier override requires next_percentage of 0 or greater.'
        );
      }
    }

    return {
      action_type: actionType,
      entity_context_json: entityContext,
      proposed_change_json: proposedChange,
    };
  });

  return {
    product_id: productId,
    asin,
    target_id: targetId,
    run_id: runId,
    target_snapshot_id: targetSnapshotId,
    recommendation_snapshot_id: recommendationSnapshotId,
    override_scope: asRecommendationOverrideScope(payload.override_scope ?? 'one_time', 'override_scope'),
    replacement_action_bundle_json: {
      actions,
    },
    operator_note: operatorNote,
  };
};
