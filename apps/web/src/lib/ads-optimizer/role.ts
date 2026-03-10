import type { AdsOptimizerArchetype, AdsOptimizerRulePackPayload } from './types';
import type { JsonObject as RuntimeJsonObject } from './runtimeTypes';
import {
  readAdsOptimizerProductRunState,
  readAdsOptimizerTargetRunState,
  type AdsOptimizerProductRunState,
  type AdsOptimizerStateCoverageStatus,
  type AdsOptimizerTargetRunState,
} from './state';

export const ADS_OPTIMIZER_TARGET_ROLES = [
  'Discover',
  'Harvest',
  'Scale',
  'Rank Push',
  'Rank Defend',
  'Suppress',
] as const;

export type AdsOptimizerTargetRole = (typeof ADS_OPTIMIZER_TARGET_ROLES)[number];
export type AdsOptimizerGuardrailManualApprovalThreshold = 'low' | 'medium' | 'high' | 'all';

export type AdsOptimizerTargetRoleDecision = {
  value: AdsOptimizerTargetRole | null;
  label: string;
  detail: string;
  coverageStatus: AdsOptimizerStateCoverageStatus;
  reasonCodes: string[];
};

export type AdsOptimizerResolvedGuardrails = {
  coverageStatus: AdsOptimizerStateCoverageStatus;
  categories: {
    noSaleSpendCap: number | null;
    noSaleClickCap: number | null;
    maxLossPerCycle: number | null;
    maxBidIncreasePerCyclePct: number | null;
    maxBidDecreasePerCyclePct: number | null;
    maxPlacementBiasIncreasePerCyclePct: number | null;
    rankPushTimeLimitDays: number | null;
    manualApprovalThreshold: AdsOptimizerGuardrailManualApprovalThreshold;
    autoPauseThreshold: number | null;
    minBidFloor: number | null;
    maxBidCeiling: number | null;
  };
  flags: {
    requiresManualApproval: boolean;
    autoPauseEligible: boolean;
    bidChangesAllowed: boolean;
    placementChangesAllowed: boolean;
    transitionLocked: boolean;
  };
  reasonCodes: string[];
  notes: string[];
};

export type AdsOptimizerTargetRoleRunState = {
  engineVersion: string;
  coverageStatus: AdsOptimizerStateCoverageStatus;
  desiredRole: AdsOptimizerTargetRoleDecision;
  currentRole: AdsOptimizerTargetRoleDecision;
  previousRole: AdsOptimizerTargetRole | null;
  transitionRule: string;
  transitionReasonCodes: string[];
  roleReasonCodes: string[];
  guardrails: AdsOptimizerResolvedGuardrails;
  summaryReasonCodes: string[];
};

type RoleInput = {
  targetState: AdsOptimizerTargetRunState;
  productState: AdsOptimizerProductRunState | null;
  raw: {
    clicks: number;
    spend: number;
    orders: number;
    cpc: number | null;
  };
  derived: {
    lossDollars: number | null;
    profitDollars: number | null;
  };
  coverageStatus: AdsOptimizerStateCoverageStatus;
  coverageNotes: string[];
  archetype: AdsOptimizerArchetype | null;
  productObjective: string | null;
  previousRole: AdsOptimizerTargetRole | null;
  productOverrides: RuntimeJsonObject | null;
};

type GuardrailConfig = {
  noSaleSpendCap: number;
  noSaleClickCap: number;
  maxLossPerCycle: number;
  maxBidIncreasePerCyclePct: number;
  maxBidDecreasePerCyclePct: number;
  maxPlacementBiasIncreasePerCyclePct: number;
  rankPushTimeLimitDays: number;
  manualApprovalThreshold: AdsOptimizerGuardrailManualApprovalThreshold;
  autoPauseThreshold: number;
  minBidFloor: number;
  maxBidCeiling: number;
};

const ROLE_ENGINE_VERSION = 'phase7_v1';

const DEFAULT_GUARDRAIL_CONFIG: GuardrailConfig = {
  noSaleSpendCap: 20,
  noSaleClickCap: 12,
  maxLossPerCycle: 25,
  maxBidIncreasePerCyclePct: 12,
  maxBidDecreasePerCyclePct: 18,
  maxPlacementBiasIncreasePerCyclePct: 8,
  rankPushTimeLimitDays: 14,
  manualApprovalThreshold: 'medium',
  autoPauseThreshold: 40,
  minBidFloor: 0.2,
  maxBidCeiling: 3,
};

const asJsonObject = (value: unknown): RuntimeJsonObject | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as RuntimeJsonObject;
};

const readString = (value: RuntimeJsonObject | null, key: string) =>
  typeof value?.[key] === 'string' ? (value[key] as string) : null;

const readNumber = (value: RuntimeJsonObject | null, key: string) => {
  const numeric = Number(value?.[key]);
  return Number.isFinite(numeric) ? numeric : null;
};

const readStringArray = (value: RuntimeJsonObject | null, key: string) => {
  const raw = value?.[key];
  return Array.isArray(raw) ? raw.filter((entry): entry is string => typeof entry === 'string') : [];
};

const withUnique = (values: string[]) => [...new Set(values)];

const coverageFromNotes = (notes: string[], fallback: AdsOptimizerStateCoverageStatus) => {
  if (fallback === 'missing') return 'missing';
  if (notes.length > 0 || fallback === 'partial') return 'partial';
  return 'ready';
};

const isEnabledRole = (rulePackPayload: AdsOptimizerRulePackPayload | null | undefined, role: AdsOptimizerTargetRole) => {
  const template = rulePackPayload?.role_templates?.[role];
  return template?.enabled ?? true;
};

const readTemplateThresholds = (rulePackPayload: AdsOptimizerRulePackPayload | null | undefined) => {
  const templates = asJsonObject(rulePackPayload?.guardrail_templates ?? null);
  const defaults = asJsonObject(templates?.default);
  const thresholds = asJsonObject(defaults?.thresholds);

  return {
    noSaleSpendCap: readNumber(thresholds, 'no_sale_spend_cap') ?? DEFAULT_GUARDRAIL_CONFIG.noSaleSpendCap,
    noSaleClickCap: readNumber(thresholds, 'no_sale_click_cap') ?? DEFAULT_GUARDRAIL_CONFIG.noSaleClickCap,
    maxLossPerCycle: readNumber(thresholds, 'max_loss_per_cycle') ?? DEFAULT_GUARDRAIL_CONFIG.maxLossPerCycle,
    maxBidIncreasePerCyclePct:
      readNumber(thresholds, 'max_bid_increase_per_cycle_pct') ??
      DEFAULT_GUARDRAIL_CONFIG.maxBidIncreasePerCyclePct,
    maxBidDecreasePerCyclePct:
      readNumber(thresholds, 'max_bid_decrease_per_cycle_pct') ??
      DEFAULT_GUARDRAIL_CONFIG.maxBidDecreasePerCyclePct,
    maxPlacementBiasIncreasePerCyclePct:
      readNumber(thresholds, 'max_placement_bias_increase_per_cycle_pct') ??
      DEFAULT_GUARDRAIL_CONFIG.maxPlacementBiasIncreasePerCyclePct,
    rankPushTimeLimitDays:
      readNumber(thresholds, 'rank_push_time_limit_days') ??
      DEFAULT_GUARDRAIL_CONFIG.rankPushTimeLimitDays,
    manualApprovalThreshold:
      (readString(thresholds, 'manual_approval_threshold') as AdsOptimizerGuardrailManualApprovalThreshold | null) ??
      DEFAULT_GUARDRAIL_CONFIG.manualApprovalThreshold,
    autoPauseThreshold:
      readNumber(thresholds, 'auto_pause_threshold') ?? DEFAULT_GUARDRAIL_CONFIG.autoPauseThreshold,
    minBidFloor: readNumber(thresholds, 'min_bid_floor') ?? DEFAULT_GUARDRAIL_CONFIG.minBidFloor,
    maxBidCeiling: readNumber(thresholds, 'max_bid_ceiling') ?? DEFAULT_GUARDRAIL_CONFIG.maxBidCeiling,
  };
};

const chooseDesiredRole = (
  input: RoleInput,
  rulePackPayload?: AdsOptimizerRulePackPayload | null
): AdsOptimizerTargetRoleDecision => {
  const reasonCodes: string[] = [];
  let value: AdsOptimizerTargetRole | null = null;

  if (input.targetState.efficiency.value === 'converting_but_loss_making') {
    value = 'Suppress';
    reasonCodes.push('ROLE_DESIRED_SUPPRESS_LOSS_MAKING');
  } else if (
    input.targetState.efficiency.value === 'no_data' &&
    input.targetState.confidence.value === 'insufficient' &&
    input.targetState.importance.value === 'tier_3_test_long_tail'
  ) {
    value = 'Suppress';
    reasonCodes.push('ROLE_DESIRED_SUPPRESS_NO_DATA_LONG_TAIL');
  } else {
    const objective = input.productObjective ?? input.productState?.objective ?? null;

    if (objective === 'Rank Growth') {
      value = input.targetState.importance.value === 'tier_3_test_long_tail' ? 'Discover' : 'Rank Push';
      reasonCodes.push(
        value === 'Rank Push' ? 'ROLE_DESIRED_RANK_GROWTH' : 'ROLE_DESIRED_RANK_GROWTH_NEEDS_DISCOVERY'
      );
    } else if (objective === 'Rank Defense') {
      value = input.targetState.importance.value === 'tier_3_test_long_tail' ? 'Discover' : 'Rank Defend';
      reasonCodes.push(
        value === 'Rank Defend'
          ? 'ROLE_DESIRED_RANK_DEFENSE'
          : 'ROLE_DESIRED_RANK_DEFENSE_NEEDS_DISCOVERY'
      );
    } else if (input.targetState.efficiency.value === 'profitable') {
      if (objective === 'Harvest Profit' || objective === 'Break Even') {
        value = 'Harvest';
        reasonCodes.push('ROLE_DESIRED_PROFIT_HARVEST');
      } else {
        value = 'Scale';
        reasonCodes.push('ROLE_DESIRED_PROFIT_SCALE');
      }
    } else if (input.targetState.efficiency.value === 'break_even') {
      value =
        input.targetState.confidence.value === 'confirmed' &&
        input.targetState.opportunityScore >= input.targetState.riskScore
          ? 'Scale'
          : 'Harvest';
      reasonCodes.push(
        value === 'Scale' ? 'ROLE_DESIRED_BREAK_EVEN_SCALE' : 'ROLE_DESIRED_BREAK_EVEN_HARVEST'
      );
    } else if (input.targetState.efficiency.value === 'learning_no_sale') {
      value = 'Discover';
      reasonCodes.push('ROLE_DESIRED_DISCOVER_LEARNING_WINDOW');
    } else {
      value = 'Discover';
      reasonCodes.push('ROLE_DESIRED_DISCOVER_DEFAULT');
    }
  }

  if (value && !isEnabledRole(rulePackPayload, value)) {
    value = 'Discover';
    reasonCodes.push('ROLE_DESIRED_FALLBACK_DISABLED_TEMPLATE');
  }

  return {
    value,
    label: value ?? 'Not captured',
    detail:
      value === 'Suppress'
        ? 'The deterministic Phase 7 role engine marked this target for suppression posture based on loss or low-signal long-tail risk.'
        : value === 'Discover'
          ? 'The deterministic Phase 7 role engine kept this target in discovery posture because more safe signal or importance is needed.'
          : value === 'Harvest'
            ? 'The deterministic Phase 7 role engine marked this target for harvest posture to preserve efficiency inside the current product objective.'
            : value === 'Scale'
              ? 'The deterministic Phase 7 role engine marked this target for scale posture because profitable headroom remains inside the current objective.'
              : value === 'Rank Push'
                ? 'The deterministic Phase 7 role engine marked this target for rank-push posture under the current rank-growth objective.'
                : value === 'Rank Defend'
                  ? 'The deterministic Phase 7 role engine marked this target for rank-defense posture under the current rank-defense objective.'
                  : 'No role was captured.',
    coverageStatus: input.coverageStatus,
    reasonCodes: withUnique(reasonCodes),
  };
};

const resolveCurrentRole = (input: {
  desiredRole: AdsOptimizerTargetRoleDecision;
  targetState: AdsOptimizerTargetRunState;
  previousRole: AdsOptimizerTargetRole | null;
}): {
  role: AdsOptimizerTargetRole | null;
  detail: string;
  transitionRule: string;
  reasonCodes: string[];
} => {
  const desired = input.desiredRole.value;
  const previous = input.previousRole;

  if (!desired) {
    return {
      role: null,
      detail: 'No current role was captured because the desired role was unresolved.',
      transitionRule: 'missing_desired_role',
      reasonCodes: ['CURRENT_ROLE_NO_DESIRED_ROLE'],
    };
  }

  if (desired === 'Suppress') {
    return {
      role: 'Suppress',
      detail: 'Suppress takes effect immediately because the current target state is already outside the safe operating envelope.',
      transitionRule: 'suppress_immediate',
      reasonCodes: ['CURRENT_ROLE_SUPPRESS_IMMEDIATE'],
    };
  }

  if (!previous) {
    return {
      role: desired,
      detail: 'No previous role snapshot existed, so the desired role becomes the current operating role for this run.',
      transitionRule: 'bootstrap_from_desired',
      reasonCodes: ['CURRENT_ROLE_BOOTSTRAP_FROM_DESIRED'],
    };
  }

  if (previous === desired) {
    return {
      role: previous,
      detail: 'The previous operating role already matches the desired role, so the run keeps that role unchanged.',
      transitionRule: 'stable_role',
      reasonCodes: ['CURRENT_ROLE_STABLE'],
    };
  }

  if (input.targetState.confidence.value === 'insufficient') {
    return {
      role: previous,
      detail: 'The desired role differs, but the signal is still insufficient, so the current operating role stays sticky until safer evidence arrives.',
      transitionRule: 'defer_low_confidence',
      reasonCodes: ['CURRENT_ROLE_TRANSITION_DEFERRED_LOW_CONFIDENCE'],
    };
  }

  if (
    (previous === 'Rank Push' || previous === 'Rank Defend') &&
    input.targetState.confidence.value !== 'confirmed'
  ) {
    return {
      role: previous,
      detail: 'The target is still in a rank-oriented posture and the signal is not confirmed enough to change operating mode yet.',
      transitionRule: 'defer_rank_transition',
      reasonCodes: ['CURRENT_ROLE_TRANSITION_DEFERRED_RANK_STICKY'],
    };
  }

  return {
    role: desired,
    detail: 'The desired role is supported by the current captured signal, so the operating role transitions in this run.',
    transitionRule: 'apply_desired_transition',
    reasonCodes: ['CURRENT_ROLE_TRANSITION_APPLIED'],
  };
};

const bumpManualThreshold = (
  current: AdsOptimizerGuardrailManualApprovalThreshold,
  next: AdsOptimizerGuardrailManualApprovalThreshold
) => {
  const rank = { low: 0, medium: 1, high: 2, all: 3 } as const;
  return rank[next] > rank[current] ? next : current;
};

const applyNumberOverride = (value: number | null, override: number | null) =>
  override !== null ? override : value;

const resolveGuardrails = (
  input: RoleInput,
  desiredRole: AdsOptimizerTargetRoleDecision,
  currentRole: AdsOptimizerTargetRoleDecision,
  rulePackPayload?: AdsOptimizerRulePackPayload | null
): AdsOptimizerResolvedGuardrails => {
  const reasonCodes: string[] = [];
  const notes = [...input.coverageNotes];
  const base = readTemplateThresholds(rulePackPayload);
  let config: AdsOptimizerResolvedGuardrails['categories'] = {
    noSaleSpendCap: base.noSaleSpendCap,
    noSaleClickCap: base.noSaleClickCap,
    maxLossPerCycle: base.maxLossPerCycle,
    maxBidIncreasePerCyclePct: base.maxBidIncreasePerCyclePct,
    maxBidDecreasePerCyclePct: base.maxBidDecreasePerCyclePct,
    maxPlacementBiasIncreasePerCyclePct: base.maxPlacementBiasIncreasePerCyclePct,
    rankPushTimeLimitDays: base.rankPushTimeLimitDays,
    manualApprovalThreshold: base.manualApprovalThreshold,
    autoPauseThreshold: base.autoPauseThreshold,
    minBidFloor: base.minBidFloor,
    maxBidCeiling: base.maxBidCeiling,
  };

  reasonCodes.push('GUARDRAIL_BASE_RULE_PACK_DEFAULT');

  switch (currentRole.value) {
    case 'Discover':
      config = {
        ...config,
        noSaleSpendCap: Math.min(config.noSaleSpendCap ?? 20, 18),
        noSaleClickCap: Math.min(config.noSaleClickCap ?? 12, 10),
        maxBidIncreasePerCyclePct: Math.min(config.maxBidIncreasePerCyclePct ?? 12, 8),
        manualApprovalThreshold: bumpManualThreshold(config.manualApprovalThreshold, 'high'),
      };
      reasonCodes.push('GUARDRAIL_ROLE_DISCOVER');
      break;
    case 'Harvest':
      config = {
        ...config,
        maxLossPerCycle: Math.min(config.maxLossPerCycle ?? 25, 15),
        maxBidIncreasePerCyclePct: Math.min(config.maxBidIncreasePerCyclePct ?? 12, 6),
        maxBidDecreasePerCyclePct: Math.max(config.maxBidDecreasePerCyclePct ?? 18, 20),
      };
      reasonCodes.push('GUARDRAIL_ROLE_HARVEST');
      break;
    case 'Scale':
      config = {
        ...config,
        maxBidIncreasePerCyclePct: Math.max(config.maxBidIncreasePerCyclePct ?? 12, 15),
        maxLossPerCycle: Math.max(config.maxLossPerCycle ?? 25, 30),
        maxBidCeiling: Math.max(config.maxBidCeiling ?? 3, 3.5),
      };
      reasonCodes.push('GUARDRAIL_ROLE_SCALE');
      break;
    case 'Rank Push':
      config = {
        ...config,
        maxBidIncreasePerCyclePct: Math.max(config.maxBidIncreasePerCyclePct ?? 12, 18),
        maxPlacementBiasIncreasePerCyclePct: Math.max(
          config.maxPlacementBiasIncreasePerCyclePct ?? 8,
          15
        ),
        rankPushTimeLimitDays: Math.max(config.rankPushTimeLimitDays ?? 14, 21),
        manualApprovalThreshold: bumpManualThreshold(config.manualApprovalThreshold, 'high'),
      };
      reasonCodes.push('GUARDRAIL_ROLE_RANK_PUSH');
      break;
    case 'Rank Defend':
      config = {
        ...config,
        maxBidIncreasePerCyclePct: Math.max(config.maxBidIncreasePerCyclePct ?? 12, 10),
        maxPlacementBiasIncreasePerCyclePct: Math.max(
          config.maxPlacementBiasIncreasePerCyclePct ?? 8,
          8
        ),
        rankPushTimeLimitDays: Math.max(config.rankPushTimeLimitDays ?? 14, 10),
      };
      reasonCodes.push('GUARDRAIL_ROLE_RANK_DEFEND');
      break;
    case 'Suppress':
      config = {
        ...config,
        maxBidIncreasePerCyclePct: 0,
        maxPlacementBiasIncreasePerCyclePct: 0,
        maxBidDecreasePerCyclePct: Math.max(config.maxBidDecreasePerCyclePct ?? 18, 25),
        autoPauseThreshold: 0,
        manualApprovalThreshold: bumpManualThreshold(config.manualApprovalThreshold, 'low'),
      };
      reasonCodes.push('GUARDRAIL_ROLE_SUPPRESS');
      break;
    default:
      break;
  }

  if (input.productObjective === 'Recover' || input.productObjective === 'Break Even') {
    config = {
      ...config,
      maxLossPerCycle: Math.min(config.maxLossPerCycle ?? 25, 12),
      manualApprovalThreshold: bumpManualThreshold(config.manualApprovalThreshold, 'high'),
    };
    reasonCodes.push('GUARDRAIL_OBJECTIVE_RECOVER_OR_BREAK_EVEN');
  }

  if (input.archetype === 'visibility_led') {
    config = {
      ...config,
      maxPlacementBiasIncreasePerCyclePct: Math.max(
        config.maxPlacementBiasIncreasePerCyclePct ?? 8,
        12
      ),
      rankPushTimeLimitDays: Math.max(config.rankPushTimeLimitDays ?? 14, 18),
    };
    reasonCodes.push('GUARDRAIL_ARCHETYPE_VISIBILITY_LED');
  } else if (input.archetype === 'design_led') {
    config = {
      ...config,
      maxLossPerCycle: Math.min(config.maxLossPerCycle ?? 25, 18),
      maxBidCeiling: Math.min(config.maxBidCeiling ?? 3, 2.5),
    };
    reasonCodes.push('GUARDRAIL_ARCHETYPE_DESIGN_LED');
  } else {
    reasonCodes.push('GUARDRAIL_ARCHETYPE_HYBRID');
  }

  if (input.targetState.confidence.value === 'insufficient') {
    config = {
      ...config,
      manualApprovalThreshold: 'all',
      maxBidIncreasePerCyclePct: Math.min(config.maxBidIncreasePerCyclePct ?? 12, 5),
    };
    reasonCodes.push('GUARDRAIL_CONFIDENCE_INSUFFICIENT');
  } else if (input.targetState.confidence.value === 'directional') {
    config = {
      ...config,
      manualApprovalThreshold: bumpManualThreshold(config.manualApprovalThreshold, 'high'),
    };
    reasonCodes.push('GUARDRAIL_CONFIDENCE_DIRECTIONAL');
  } else {
    reasonCodes.push('GUARDRAIL_CONFIDENCE_CONFIRMED');
  }

  if (input.targetState.importance.value === 'tier_1_dominant') {
    config = {
      ...config,
      maxLossPerCycle: Math.max(config.maxLossPerCycle ?? 25, 28),
      maxBidCeiling: Math.max(config.maxBidCeiling ?? 3, 3.25),
    };
    reasonCodes.push('GUARDRAIL_IMPORTANCE_TIER_1');
  } else if (input.targetState.importance.value === 'tier_3_test_long_tail') {
    config = {
      ...config,
      noSaleSpendCap: Math.min(config.noSaleSpendCap ?? 20, 14),
      noSaleClickCap: Math.min(config.noSaleClickCap ?? 12, 8),
    };
    reasonCodes.push('GUARDRAIL_IMPORTANCE_TIER_3');
  } else {
    reasonCodes.push('GUARDRAIL_IMPORTANCE_TIER_2');
  }

  const overrides = input.productOverrides;
  config = {
    noSaleSpendCap: applyNumberOverride(config.noSaleSpendCap, readNumber(overrides, 'no_sale_spend_cap')),
    noSaleClickCap: applyNumberOverride(config.noSaleClickCap, readNumber(overrides, 'no_sale_click_cap')),
    maxLossPerCycle: applyNumberOverride(config.maxLossPerCycle, readNumber(overrides, 'max_loss_per_cycle')),
    maxBidIncreasePerCyclePct: applyNumberOverride(
      config.maxBidIncreasePerCyclePct,
      readNumber(overrides, 'max_bid_increase_per_cycle_pct')
    ),
    maxBidDecreasePerCyclePct: applyNumberOverride(
      config.maxBidDecreasePerCyclePct,
      readNumber(overrides, 'max_bid_decrease_per_cycle_pct')
    ),
    maxPlacementBiasIncreasePerCyclePct: applyNumberOverride(
      config.maxPlacementBiasIncreasePerCyclePct,
      readNumber(overrides, 'max_placement_bias_increase_per_cycle_pct')
    ),
    rankPushTimeLimitDays: applyNumberOverride(
      config.rankPushTimeLimitDays,
      readNumber(overrides, 'rank_push_time_limit_days')
    ),
    manualApprovalThreshold:
      (readString(overrides, 'manual_approval_threshold') as AdsOptimizerGuardrailManualApprovalThreshold | null) ??
      config.manualApprovalThreshold,
    autoPauseThreshold: applyNumberOverride(
      config.autoPauseThreshold,
      readNumber(overrides, 'auto_pause_threshold')
    ),
    minBidFloor: applyNumberOverride(config.minBidFloor, readNumber(overrides, 'min_bid_floor')),
    maxBidCeiling: applyNumberOverride(config.maxBidCeiling, readNumber(overrides, 'max_bid_ceiling')),
  };
  if (overrides) {
    reasonCodes.push('GUARDRAIL_PRODUCT_OVERRIDE_APPLIED');
  }

  const flags = {
    requiresManualApproval: config.manualApprovalThreshold !== 'low',
    autoPauseEligible:
      currentRole.value === 'Suppress' ||
      input.targetState.riskScore >= (config.autoPauseThreshold ?? Number.POSITIVE_INFINITY),
    bidChangesAllowed: currentRole.value !== 'Suppress',
    placementChangesAllowed:
      currentRole.value === 'Rank Push' || currentRole.value === 'Rank Defend' || currentRole.value === 'Scale',
    transitionLocked:
      currentRole.value !== desiredRole.value && input.targetState.confidence.value === 'insufficient',
  };

  return {
    coverageStatus: coverageFromNotes(notes, input.coverageStatus),
    categories: config,
    flags,
    reasonCodes: withUnique(reasonCodes),
    notes,
  };
};

export const classifyAdsOptimizerTargetRole = (args: {
  payload: RuntimeJsonObject;
  rulePackPayload?: AdsOptimizerRulePackPayload | null;
  previousRole?: AdsOptimizerTargetRole | null;
  archetype?: AdsOptimizerArchetype | null;
  productOverrides?: RuntimeJsonObject | null;
}): AdsOptimizerTargetRoleRunState => {
  const targetState = readAdsOptimizerTargetRunState(args.payload);
  if (!targetState) {
    return {
      engineVersion: ROLE_ENGINE_VERSION,
      coverageStatus: 'missing',
      desiredRole: {
        value: null,
        label: 'Not captured',
        detail: 'This run predates Phase 7 role capture.',
        coverageStatus: 'missing',
        reasonCodes: ['ROLE_ENGINE_STATE_MISSING'],
      },
      currentRole: {
        value: null,
        label: 'Not captured',
        detail: 'This run predates Phase 7 role capture.',
        coverageStatus: 'missing',
        reasonCodes: ['ROLE_ENGINE_STATE_MISSING'],
      },
      previousRole: args.previousRole ?? null,
      transitionRule: 'missing_state_engine',
      transitionReasonCodes: ['ROLE_ENGINE_STATE_MISSING'],
      roleReasonCodes: ['ROLE_ENGINE_STATE_MISSING'],
      guardrails: {
        coverageStatus: 'missing',
        categories: {
          noSaleSpendCap: DEFAULT_GUARDRAIL_CONFIG.noSaleSpendCap,
          noSaleClickCap: DEFAULT_GUARDRAIL_CONFIG.noSaleClickCap,
          maxLossPerCycle: DEFAULT_GUARDRAIL_CONFIG.maxLossPerCycle,
          maxBidIncreasePerCyclePct: DEFAULT_GUARDRAIL_CONFIG.maxBidIncreasePerCyclePct,
          maxBidDecreasePerCyclePct: DEFAULT_GUARDRAIL_CONFIG.maxBidDecreasePerCyclePct,
          maxPlacementBiasIncreasePerCyclePct:
            DEFAULT_GUARDRAIL_CONFIG.maxPlacementBiasIncreasePerCyclePct,
          rankPushTimeLimitDays: DEFAULT_GUARDRAIL_CONFIG.rankPushTimeLimitDays,
          manualApprovalThreshold: DEFAULT_GUARDRAIL_CONFIG.manualApprovalThreshold,
          autoPauseThreshold: DEFAULT_GUARDRAIL_CONFIG.autoPauseThreshold,
          minBidFloor: DEFAULT_GUARDRAIL_CONFIG.minBidFloor,
          maxBidCeiling: DEFAULT_GUARDRAIL_CONFIG.maxBidCeiling,
        },
        flags: {
          requiresManualApproval: true,
          autoPauseEligible: false,
          bidChangesAllowed: false,
          placementChangesAllowed: false,
          transitionLocked: true,
        },
        reasonCodes: ['ROLE_ENGINE_STATE_MISSING'],
        notes: [],
      },
      summaryReasonCodes: ['ROLE_ENGINE_STATE_MISSING'],
    };
  }

  const totals = asJsonObject(args.payload.totals);
  const derived = asJsonObject(args.payload.derived_metrics);
  const coverage = asJsonObject(args.payload.coverage);
  const productContext = asJsonObject(args.payload.product_context);
  const productState = readAdsOptimizerProductRunState(args.payload);
  const coverageNotes = readStringArray(coverage, 'notes');

  const input: RoleInput = {
    targetState,
    productState,
    raw: {
      clicks: readNumber(totals, 'clicks') ?? 0,
      spend: readNumber(totals, 'spend') ?? 0,
      orders: readNumber(totals, 'orders') ?? 0,
      cpc: readNumber(totals, 'cpc'),
    },
    derived: {
      lossDollars: readNumber(derived, 'loss_dollars'),
      profitDollars: readNumber(derived, 'profit_dollars'),
    },
    coverageStatus: targetState.coverageStatus,
    coverageNotes,
    archetype: args.archetype ?? null,
    productObjective: readString(productContext, 'product_objective') ?? productState?.objective ?? null,
    previousRole: args.previousRole ?? null,
    productOverrides: args.productOverrides ?? null,
  };

  const desiredRole = chooseDesiredRole(input, args.rulePackPayload);
  const currentResolution = resolveCurrentRole({
    desiredRole,
    previousRole: input.previousRole,
    targetState,
  });
  const currentRole: AdsOptimizerTargetRoleDecision = {
    value: currentResolution.role,
    label: currentResolution.role ?? 'Not captured',
    detail: currentResolution.detail,
    coverageStatus: input.coverageStatus,
    reasonCodes: currentResolution.reasonCodes,
  };
  const guardrails = resolveGuardrails(input, desiredRole, currentRole, args.rulePackPayload);

  return {
    engineVersion: ROLE_ENGINE_VERSION,
    coverageStatus: coverageFromNotes(guardrails.notes, input.coverageStatus),
    desiredRole,
    currentRole,
    previousRole: input.previousRole,
    transitionRule: currentResolution.transitionRule,
    transitionReasonCodes: currentResolution.reasonCodes,
    roleReasonCodes: withUnique([...desiredRole.reasonCodes, ...currentRole.reasonCodes]),
    guardrails,
    summaryReasonCodes: withUnique([
      ...desiredRole.reasonCodes,
      ...currentRole.reasonCodes,
      ...guardrails.reasonCodes,
    ]),
  };
};

export const enrichAdsOptimizerTargetSnapshotRolePayload = (args: {
  payload: RuntimeJsonObject;
  rulePackPayload?: AdsOptimizerRulePackPayload | null;
  previousRole?: AdsOptimizerTargetRole | null;
  archetype?: AdsOptimizerArchetype | null;
  productOverrides?: RuntimeJsonObject | null;
}): RuntimeJsonObject => {
  const role = classifyAdsOptimizerTargetRole(args);

  return {
    ...args.payload,
    phase: Math.max(Number(args.payload.phase ?? 0), 7),
    role_engine: {
      engine_version: role.engineVersion,
      coverage_status: role.coverageStatus,
      previous_role: role.previousRole,
      desired_role: {
        value: role.desiredRole.value,
        label: role.desiredRole.label,
        detail: role.desiredRole.detail,
        coverage_status: role.desiredRole.coverageStatus,
        reason_codes: role.desiredRole.reasonCodes,
      },
      current_role: {
        value: role.currentRole.value,
        label: role.currentRole.label,
        detail: role.currentRole.detail,
        coverage_status: role.currentRole.coverageStatus,
        reason_codes: role.currentRole.reasonCodes,
      },
      transition: {
        rule: role.transitionRule,
        reason_codes: role.transitionReasonCodes,
      },
      guardrails: {
        coverage_status: role.guardrails.coverageStatus,
        categories: {
          no_sale_spend_cap: role.guardrails.categories.noSaleSpendCap,
          no_sale_click_cap: role.guardrails.categories.noSaleClickCap,
          max_loss_per_cycle: role.guardrails.categories.maxLossPerCycle,
          max_bid_increase_per_cycle_pct: role.guardrails.categories.maxBidIncreasePerCyclePct,
          max_bid_decrease_per_cycle_pct: role.guardrails.categories.maxBidDecreasePerCyclePct,
          max_placement_bias_increase_per_cycle_pct:
            role.guardrails.categories.maxPlacementBiasIncreasePerCyclePct,
          rank_push_time_limit_days: role.guardrails.categories.rankPushTimeLimitDays,
          manual_approval_threshold: role.guardrails.categories.manualApprovalThreshold,
          auto_pause_threshold: role.guardrails.categories.autoPauseThreshold,
          min_bid_floor: role.guardrails.categories.minBidFloor,
          max_bid_ceiling: role.guardrails.categories.maxBidCeiling,
        },
        flags: {
          requires_manual_approval: role.guardrails.flags.requiresManualApproval,
          auto_pause_eligible: role.guardrails.flags.autoPauseEligible,
          bid_changes_allowed: role.guardrails.flags.bidChangesAllowed,
          placement_changes_allowed: role.guardrails.flags.placementChangesAllowed,
          transition_locked: role.guardrails.flags.transitionLocked,
        },
        reason_codes: role.guardrails.reasonCodes,
        notes: role.guardrails.notes,
      },
      reason_codes: role.summaryReasonCodes,
    },
  };
};

export const readAdsOptimizerTargetRunRole = (
  payload: RuntimeJsonObject
): AdsOptimizerTargetRoleRunState | null => {
  const roleEngine = asJsonObject(payload.role_engine);
  if (!roleEngine) return null;

  const desiredRole = asJsonObject(roleEngine.desired_role);
  const currentRole = asJsonObject(roleEngine.current_role);
  const transition = asJsonObject(roleEngine.transition);
  const guardrails = asJsonObject(roleEngine.guardrails);
  const categories = asJsonObject(guardrails?.categories);
  const flags = asJsonObject(guardrails?.flags);

  return {
    engineVersion: readString(roleEngine, 'engine_version') ?? ROLE_ENGINE_VERSION,
    coverageStatus:
      (readString(roleEngine, 'coverage_status') as AdsOptimizerStateCoverageStatus | null) ?? 'missing',
    previousRole:
      (readString(roleEngine, 'previous_role') as AdsOptimizerTargetRole | null) ?? null,
    desiredRole: {
      value: (readString(desiredRole, 'value') as AdsOptimizerTargetRole | null) ?? null,
      label: readString(desiredRole, 'label') ?? 'Not captured',
      detail: readString(desiredRole, 'detail') ?? 'This run predates Phase 7 role capture.',
      coverageStatus:
        (readString(desiredRole, 'coverage_status') as AdsOptimizerStateCoverageStatus | null) ??
        'missing',
      reasonCodes: readStringArray(desiredRole, 'reason_codes'),
    },
    currentRole: {
      value: (readString(currentRole, 'value') as AdsOptimizerTargetRole | null) ?? null,
      label: readString(currentRole, 'label') ?? 'Not captured',
      detail: readString(currentRole, 'detail') ?? 'This run predates Phase 7 role capture.',
      coverageStatus:
        (readString(currentRole, 'coverage_status') as AdsOptimizerStateCoverageStatus | null) ??
        'missing',
      reasonCodes: readStringArray(currentRole, 'reason_codes'),
    },
    transitionRule: readString(transition, 'rule') ?? 'missing_transition',
    transitionReasonCodes: readStringArray(transition, 'reason_codes'),
    roleReasonCodes: withUnique([
      ...readStringArray(desiredRole, 'reason_codes'),
      ...readStringArray(currentRole, 'reason_codes'),
    ]),
    guardrails: {
      coverageStatus:
        (readString(guardrails, 'coverage_status') as AdsOptimizerStateCoverageStatus | null) ??
        'missing',
      categories: {
        noSaleSpendCap: readNumber(categories, 'no_sale_spend_cap'),
        noSaleClickCap: readNumber(categories, 'no_sale_click_cap'),
        maxLossPerCycle: readNumber(categories, 'max_loss_per_cycle'),
        maxBidIncreasePerCyclePct: readNumber(categories, 'max_bid_increase_per_cycle_pct'),
        maxBidDecreasePerCyclePct: readNumber(categories, 'max_bid_decrease_per_cycle_pct'),
        maxPlacementBiasIncreasePerCyclePct: readNumber(
          categories,
          'max_placement_bias_increase_per_cycle_pct'
        ),
        rankPushTimeLimitDays: readNumber(categories, 'rank_push_time_limit_days'),
        manualApprovalThreshold:
          (readString(categories, 'manual_approval_threshold') as AdsOptimizerGuardrailManualApprovalThreshold | null) ??
          'medium',
        autoPauseThreshold: readNumber(categories, 'auto_pause_threshold'),
        minBidFloor: readNumber(categories, 'min_bid_floor'),
        maxBidCeiling: readNumber(categories, 'max_bid_ceiling'),
      },
      flags: {
        requiresManualApproval: Boolean(flags?.requires_manual_approval),
        autoPauseEligible: Boolean(flags?.auto_pause_eligible),
        bidChangesAllowed: flags?.bid_changes_allowed !== false,
        placementChangesAllowed: Boolean(flags?.placement_changes_allowed),
        transitionLocked: Boolean(flags?.transition_locked),
      },
      reasonCodes: readStringArray(guardrails, 'reason_codes'),
      notes: readStringArray(guardrails, 'notes'),
    },
    summaryReasonCodes: readStringArray(roleEngine, 'reason_codes'),
  };
};

export const buildAdsOptimizerRoleTransitionReason = (args: {
  role: AdsOptimizerTargetRoleRunState;
  targetSnapshotId: string;
  targetId: string;
}): RuntimeJsonObject | null => {
  if (!args.role.currentRole.value) return null;
  if (args.role.previousRole === args.role.currentRole.value) return null;

  return {
    engine_version: args.role.engineVersion,
    target_snapshot_id: args.targetSnapshotId,
    target_id: args.targetId,
    previous_role: args.role.previousRole,
    desired_role: args.role.desiredRole.value,
    current_role: args.role.currentRole.value,
    transition_rule: args.role.transitionRule,
    transition_reason_codes: args.role.transitionReasonCodes,
    role_reason_codes: args.role.roleReasonCodes,
    guardrail_reason_codes: args.role.guardrails.reasonCodes,
    guardrail_flags: {
      requires_manual_approval: args.role.guardrails.flags.requiresManualApproval,
      auto_pause_eligible: args.role.guardrails.flags.autoPauseEligible,
      transition_locked: args.role.guardrails.flags.transitionLocked,
    },
  };
};
