import type {
  AdsOptimizerArchetype,
  AdsOptimizerLossMakerPolicy,
  AdsOptimizerPhasedRecoveryPolicy,
  AdsOptimizerRoleBiasPolicy,
  AdsOptimizerRulePackPayload,
  AdsOptimizerStrategyProfile,
} from './types';

const asJsonObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const readNumber = (value: Record<string, unknown> | null, key: string) => {
  const raw = value?.[key];
  if (raw === null || raw === undefined || raw === '') return null;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
};

const readBoolean = (value: Record<string, unknown> | null, key: string) => {
  const raw = value?.[key];
  return typeof raw === 'boolean' ? raw : null;
};

const readStrategyProfile = (
  value: Record<string, unknown> | null,
  key: string
): AdsOptimizerStrategyProfile | null => {
  const raw = value?.[key];
  if (raw === 'hybrid' || raw === 'visibility_led' || raw === 'design_led') {
    return raw;
  }
  return null;
};

export const DEFAULT_ADS_OPTIMIZER_STRATEGY_PROFILE: AdsOptimizerStrategyProfile = 'hybrid';

export const DEFAULT_ADS_OPTIMIZER_LOSS_MAKER_POLICY: AdsOptimizerLossMakerPolicy = {
  protected_ad_sales_share_min: 0.2,
  protected_order_share_min: 0.2,
  protected_total_sales_share_min: 0.08,
  shallow_loss_ratio_max: 0.15,
  moderate_loss_ratio_max: 0.35,
  severe_loss_ratio_min: 0.35,
  pause_protected_contributors: false,
};

export const DEFAULT_ADS_OPTIMIZER_PHASED_RECOVERY_POLICY: AdsOptimizerPhasedRecoveryPolicy = {
  default_steps: 3,
  important_target_steps: 4,
  visibility_led_steps: 5,
  design_led_steps: 2,
  max_step_bid_decrease_pct: 12,
  continue_until_break_even: true,
};

export const DEFAULT_ADS_OPTIMIZER_ROLE_BIAS_POLICY: AdsOptimizerRoleBiasPolicy = {
  visibility_led_rank_defend_bias: true,
  design_led_long_tail_suppress_bias: true,
};

export const resolveAdsOptimizerStrategyProfile = (args: {
  rulePackPayload?: AdsOptimizerRulePackPayload | null;
  fallbackArchetype?: AdsOptimizerArchetype | null;
}): AdsOptimizerStrategyProfile =>
  args.rulePackPayload?.strategy_profile ??
  args.fallbackArchetype ??
  DEFAULT_ADS_OPTIMIZER_STRATEGY_PROFILE;

export const resolveAdsOptimizerLossMakerPolicy = (
  rulePackPayload?: AdsOptimizerRulePackPayload | null
): AdsOptimizerLossMakerPolicy => {
  const policy = asJsonObject(rulePackPayload?.loss_maker_policy ?? null);

  return {
    protected_ad_sales_share_min:
      readNumber(policy, 'protected_ad_sales_share_min') ??
      DEFAULT_ADS_OPTIMIZER_LOSS_MAKER_POLICY.protected_ad_sales_share_min,
    protected_order_share_min:
      readNumber(policy, 'protected_order_share_min') ??
      DEFAULT_ADS_OPTIMIZER_LOSS_MAKER_POLICY.protected_order_share_min,
    protected_total_sales_share_min:
      readNumber(policy, 'protected_total_sales_share_min') ??
      DEFAULT_ADS_OPTIMIZER_LOSS_MAKER_POLICY.protected_total_sales_share_min,
    shallow_loss_ratio_max:
      readNumber(policy, 'shallow_loss_ratio_max') ??
      DEFAULT_ADS_OPTIMIZER_LOSS_MAKER_POLICY.shallow_loss_ratio_max,
    moderate_loss_ratio_max:
      readNumber(policy, 'moderate_loss_ratio_max') ??
      DEFAULT_ADS_OPTIMIZER_LOSS_MAKER_POLICY.moderate_loss_ratio_max,
    severe_loss_ratio_min:
      readNumber(policy, 'severe_loss_ratio_min') ??
      DEFAULT_ADS_OPTIMIZER_LOSS_MAKER_POLICY.severe_loss_ratio_min,
    pause_protected_contributors:
      readBoolean(policy, 'pause_protected_contributors') ??
      DEFAULT_ADS_OPTIMIZER_LOSS_MAKER_POLICY.pause_protected_contributors,
  };
};

export const resolveAdsOptimizerPhasedRecoveryPolicy = (
  rulePackPayload?: AdsOptimizerRulePackPayload | null
): AdsOptimizerPhasedRecoveryPolicy => {
  const policy = asJsonObject(rulePackPayload?.phased_recovery_policy ?? null);

  return {
    default_steps:
      readNumber(policy, 'default_steps') ??
      DEFAULT_ADS_OPTIMIZER_PHASED_RECOVERY_POLICY.default_steps,
    important_target_steps:
      readNumber(policy, 'important_target_steps') ??
      DEFAULT_ADS_OPTIMIZER_PHASED_RECOVERY_POLICY.important_target_steps,
    visibility_led_steps:
      readNumber(policy, 'visibility_led_steps') ??
      DEFAULT_ADS_OPTIMIZER_PHASED_RECOVERY_POLICY.visibility_led_steps,
    design_led_steps:
      readNumber(policy, 'design_led_steps') ??
      DEFAULT_ADS_OPTIMIZER_PHASED_RECOVERY_POLICY.design_led_steps,
    max_step_bid_decrease_pct:
      readNumber(policy, 'max_step_bid_decrease_pct') ??
      DEFAULT_ADS_OPTIMIZER_PHASED_RECOVERY_POLICY.max_step_bid_decrease_pct,
    continue_until_break_even:
      readBoolean(policy, 'continue_until_break_even') ??
      DEFAULT_ADS_OPTIMIZER_PHASED_RECOVERY_POLICY.continue_until_break_even,
  };
};

export const resolveAdsOptimizerRoleBiasPolicy = (
  rulePackPayload?: AdsOptimizerRulePackPayload | null
): AdsOptimizerRoleBiasPolicy => {
  const policy = asJsonObject(rulePackPayload?.role_bias_policy ?? null);

  return {
    visibility_led_rank_defend_bias:
      readBoolean(policy, 'visibility_led_rank_defend_bias') ??
      DEFAULT_ADS_OPTIMIZER_ROLE_BIAS_POLICY.visibility_led_rank_defend_bias,
    design_led_long_tail_suppress_bias:
      readBoolean(policy, 'design_led_long_tail_suppress_bias') ??
      DEFAULT_ADS_OPTIMIZER_ROLE_BIAS_POLICY.design_led_long_tail_suppress_bias,
  };
};

export const readAdsOptimizerStrategyProfileFromPayload = (
  payload: Record<string, unknown> | null | undefined
): AdsOptimizerStrategyProfile | null =>
  readStrategyProfile(asJsonObject(payload), 'strategy_profile');
