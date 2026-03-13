import type {
  AdsOptimizerArchetype,
  AdsOptimizerProductSettings,
  AdsOptimizerRulePackVersion,
  AdsOptimizerStrategyProfile,
} from './types';
import { resolveAdsOptimizerStrategyProfile } from './ruleConfig';

export type AdsOptimizerEffectiveVersionResolutionSource =
  | 'product_assignment'
  | 'account_active_fallback';

export type AdsOptimizerEffectiveVersionFallbackReason =
  | 'no_product_row'
  | 'no_product_settings'
  | 'optimizer_disabled'
  | 'assigned_version_missing';

export type AdsOptimizerEffectiveVersionContext = {
  rulePackVersionId: string;
  versionLabel: string;
  strategyProfile: AdsOptimizerStrategyProfile;
  resolutionSource: AdsOptimizerEffectiveVersionResolutionSource;
  productArchetype: AdsOptimizerArchetype | null;
  productPolicyDisabled: boolean;
  productOptimizerEnabled: boolean | null;
  selectedProductId: string | null;
  assignedRulePackVersionId: string | null;
  assignedVersionLabel: string | null;
  accountActiveRulePackVersionId: string;
  accountActiveVersionLabel: string;
  fallbackReason: AdsOptimizerEffectiveVersionFallbackReason | null;
};

type ResolveAdsOptimizerEffectiveVersionArgs = {
  activeVersion: AdsOptimizerRulePackVersion;
  assignedVersion: AdsOptimizerRulePackVersion | null;
  productId: string | null;
  productSettings: AdsOptimizerProductSettings | null;
};

const asJsonObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const readString = (value: Record<string, unknown> | null, key: string) => {
  const next = value?.[key];
  return typeof next === 'string' && next.trim().length > 0 ? next.trim() : null;
};

const readBoolean = (value: Record<string, unknown> | null, key: string) => {
  const next = value?.[key];
  return typeof next === 'boolean' ? next : null;
};

const readArchetype = (value: Record<string, unknown> | null, key: string) => {
  const next = readString(value, key);
  if (next === 'design_led' || next === 'visibility_led' || next === 'hybrid') {
    return next;
  }
  return null;
};

const readStrategyProfile = (value: Record<string, unknown> | null, key: string) => {
  const next = readString(value, key);
  if (next === 'design_led' || next === 'visibility_led' || next === 'hybrid') {
    return next;
  }
  return null;
};

const readResolutionSource = (
  value: Record<string, unknown> | null,
  key: string
): AdsOptimizerEffectiveVersionResolutionSource | null => {
  const next = readString(value, key);
  if (next === 'product_assignment' || next === 'account_active_fallback') {
    return next;
  }
  return null;
};

const readFallbackReason = (
  value: Record<string, unknown> | null,
  key: string
): AdsOptimizerEffectiveVersionFallbackReason | null => {
  const next = readString(value, key);
  if (
    next === 'no_product_row' ||
    next === 'no_product_settings' ||
    next === 'optimizer_disabled' ||
    next === 'assigned_version_missing'
  ) {
    return next;
  }
  return null;
};

export const resolveAdsOptimizerEffectiveVersion = (
  args: ResolveAdsOptimizerEffectiveVersionArgs
): {
  effectiveVersion: AdsOptimizerRulePackVersion;
  context: AdsOptimizerEffectiveVersionContext;
} => {
  let effectiveVersion = args.activeVersion;
  let resolutionSource: AdsOptimizerEffectiveVersionResolutionSource = 'account_active_fallback';
  let fallbackReason: AdsOptimizerEffectiveVersionFallbackReason | null = null;

  if (args.productSettings?.optimizer_enabled) {
    if (args.assignedVersion) {
      effectiveVersion = args.assignedVersion;
      resolutionSource = 'product_assignment';
    } else {
      fallbackReason = 'assigned_version_missing';
    }
  } else if (args.productSettings?.optimizer_enabled === false) {
    fallbackReason = 'optimizer_disabled';
  } else if (args.productId) {
    fallbackReason = 'no_product_settings';
  } else {
    fallbackReason = 'no_product_row';
  }

  return {
    effectiveVersion,
    context: {
      rulePackVersionId: effectiveVersion.rule_pack_version_id,
      versionLabel: effectiveVersion.version_label,
      strategyProfile: resolveAdsOptimizerStrategyProfile({
        rulePackPayload: effectiveVersion.change_payload_json,
      }),
      resolutionSource,
      productArchetype: args.productSettings?.archetype ?? null,
      productPolicyDisabled: args.productSettings?.optimizer_enabled === false,
      productOptimizerEnabled: args.productSettings?.optimizer_enabled ?? null,
      selectedProductId: args.productId,
      assignedRulePackVersionId: args.productSettings?.rule_pack_version_id ?? null,
      assignedVersionLabel: args.assignedVersion?.version_label ?? null,
      accountActiveRulePackVersionId: args.activeVersion.rule_pack_version_id,
      accountActiveVersionLabel: args.activeVersion.version_label,
      fallbackReason,
    },
  };
};

export const toAdsOptimizerEffectiveVersionContextJson = (
  value: AdsOptimizerEffectiveVersionContext
): Record<string, unknown> => ({
  rule_pack_version_id: value.rulePackVersionId,
  version_label: value.versionLabel,
  strategy_profile: value.strategyProfile,
  resolution_source: value.resolutionSource,
  product_archetype: value.productArchetype,
  product_policy_disabled: value.productPolicyDisabled,
  product_optimizer_enabled: value.productOptimizerEnabled,
  selected_product_id: value.selectedProductId,
  assigned_rule_pack_version_id: value.assignedRulePackVersionId,
  assigned_version_label: value.assignedVersionLabel,
  account_active_rule_pack_version_id: value.accountActiveRulePackVersionId,
  account_active_version_label: value.accountActiveVersionLabel,
  fallback_reason: value.fallbackReason,
});

export const readAdsOptimizerEffectiveVersionContext = (
  value: unknown
): AdsOptimizerEffectiveVersionContext | null => {
  const objectValue = asJsonObject(value);
  const rulePackVersionId = readString(objectValue, 'rule_pack_version_id');
  const versionLabel = readString(objectValue, 'version_label');
  const resolutionSource = readResolutionSource(objectValue, 'resolution_source');

  if (!rulePackVersionId || !versionLabel || !resolutionSource) {
    return null;
  }

  const accountActiveRulePackVersionId =
    readString(objectValue, 'account_active_rule_pack_version_id') ?? rulePackVersionId;
  const accountActiveVersionLabel =
    readString(objectValue, 'account_active_version_label') ?? versionLabel;

  return {
    rulePackVersionId,
    versionLabel,
    strategyProfile: readStrategyProfile(objectValue, 'strategy_profile') ?? 'hybrid',
    resolutionSource,
    productArchetype: readArchetype(objectValue, 'product_archetype'),
    productPolicyDisabled: readBoolean(objectValue, 'product_policy_disabled') ?? false,
    productOptimizerEnabled: readBoolean(objectValue, 'product_optimizer_enabled'),
    selectedProductId: readString(objectValue, 'selected_product_id'),
    assignedRulePackVersionId: readString(objectValue, 'assigned_rule_pack_version_id'),
    assignedVersionLabel: readString(objectValue, 'assigned_version_label'),
    accountActiveRulePackVersionId,
    accountActiveVersionLabel,
    fallbackReason: readFallbackReason(objectValue, 'fallback_reason'),
  };
};

export const readAdsOptimizerRunEffectiveVersionContext = (
  inputSummary: Record<string, unknown> | null | undefined
): AdsOptimizerEffectiveVersionContext | null =>
  readAdsOptimizerEffectiveVersionContext(asJsonObject(inputSummary)?.rule_pack_version);

export const readAdsOptimizerProductSnapshotEffectiveVersionContext = (
  snapshotPayload: Record<string, unknown> | null | undefined
): AdsOptimizerEffectiveVersionContext | null => {
  const runtimeContext = asJsonObject(asJsonObject(snapshotPayload)?.runtime_context);
  return readAdsOptimizerEffectiveVersionContext(runtimeContext?.effective_rule_pack_version);
};
