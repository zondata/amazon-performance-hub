import type { AdsOptimizerObjective, AdsOptimizerOverviewData, AdsOptimizerProductState } from './overview';
import type { JsonObject as RuntimeJsonObject } from './runtimeTypes';
import type { AdsOptimizerRulePackPayload, JsonObject } from './types';

export type AdsOptimizerStateCoverageStatus = 'ready' | 'partial' | 'missing';
export type AdsOptimizerTargetEfficiencyState =
  | 'no_data'
  | 'learning_no_sale'
  | 'converting_but_loss_making'
  | 'break_even'
  | 'profitable';
export type AdsOptimizerTargetConfidenceState = 'insufficient' | 'directional' | 'confirmed';
export type AdsOptimizerTargetImportanceTier =
  | 'tier_1_dominant'
  | 'tier_2_core'
  | 'tier_3_test_long_tail';

export type AdsOptimizerProductRunState = {
  engineVersion: string;
  value: AdsOptimizerProductState;
  label: string;
  objective: AdsOptimizerObjective;
  objectiveReason: string;
  reason: string;
  coverageStatus: AdsOptimizerStateCoverageStatus;
  reasonCodes: string[];
  notes: string[];
};

export type AdsOptimizerTargetStateDecision<TValue extends string> = {
  value: TValue | null;
  label: string;
  detail: string;
  coverageStatus: AdsOptimizerStateCoverageStatus;
  reasonCodes: string[];
};

export type AdsOptimizerTargetRunState = {
  engineVersion: string;
  coverageStatus: AdsOptimizerStateCoverageStatus;
  efficiency: AdsOptimizerTargetStateDecision<AdsOptimizerTargetEfficiencyState>;
  confidence: AdsOptimizerTargetStateDecision<AdsOptimizerTargetConfidenceState>;
  importance: AdsOptimizerTargetStateDecision<AdsOptimizerTargetImportanceTier>;
  opportunityScore: number;
  riskScore: number;
  opportunityReasonCodes: string[];
  riskReasonCodes: string[];
  summaryReasonCodes: string[];
};

type TargetSnapshotPayloadCoverageStatus = 'ready' | 'partial' | 'missing';

type TargetStateInput = {
  raw: {
    impressions: number;
    clicks: number;
    spend: number;
    orders: number;
    sales: number;
    cpc: number | null;
    ctr: number | null;
    cvr: number | null;
    acos: number | null;
    roas: number | null;
    tosIs: number | null;
    stis: number | null;
    stir: number | null;
  };
  derived: {
    contributionAfterAds: number | null;
    breakEvenGap: number | null;
    maxCpcSupportGap: number | null;
    lossDollars: number | null;
    profitDollars: number | null;
    clickVelocity: number | null;
    impressionVelocity: number | null;
    organicLeverageProxy: number | null;
  };
  coverage: {
    daysObserved: number;
    statuses: {
      tosIs: TargetSnapshotPayloadCoverageStatus;
      stis: TargetSnapshotPayloadCoverageStatus;
      stir: TargetSnapshotPayloadCoverageStatus;
      placementContext: TargetSnapshotPayloadCoverageStatus;
      searchTerms: TargetSnapshotPayloadCoverageStatus;
      breakEvenInputs: TargetSnapshotPayloadCoverageStatus;
    };
    notes: string[];
  };
  demandProxies: {
    searchTermCount: number;
    sameTextSearchTermCount: number;
    totalSearchTermImpressions: number;
    totalSearchTermClicks: number;
    representativeClickShare: number | null;
  };
  asinScopeMembership: {
    productAdSpend: number | null;
    productAdSales: number | null;
    productOrders: number | null;
    productUnits: number | null;
  } | null;
  productContext: {
    breakEvenAcos: number | null;
    averagePrice: number | null;
    productState: string | null;
    productObjective: string | null;
  };
};

type StateEngineConfig = {
  minClicksDirectional: number;
  minOrdersConfirmed: number;
  minDaysDirectional: number;
  minDaysConfirmed: number;
  breakEvenGapTolerance: number;
  dominantSpendShare: number;
  coreSpendShare: number;
  dominantClickVelocity: number;
  coreClickVelocity: number;
  dominantImportanceScore: number;
  coreImportanceScore: number;
  noSaleSpendRisk: number;
  noSaleClicksRisk: number;
  importanceWeight: number;
};

const STATE_ENGINE_VERSION = 'phase6_v1';

const DEFAULT_STATE_ENGINE_CONFIG: StateEngineConfig = {
  minClicksDirectional: 20,
  minOrdersConfirmed: 2,
  minDaysDirectional: 3,
  minDaysConfirmed: 7,
  breakEvenGapTolerance: 0.03,
  dominantSpendShare: 0.35,
  coreSpendShare: 0.12,
  dominantClickVelocity: 4,
  coreClickVelocity: 1.5,
  dominantImportanceScore: 70,
  coreImportanceScore: 40,
  noSaleSpendRisk: 20,
  noSaleClicksRisk: 10,
  importanceWeight: 1,
};

const numberValue = (value: unknown): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const readNumber = (value: JsonObject | RuntimeJsonObject | null, key: string) => {
  const next = value?.[key];
  return typeof next === 'number' && Number.isFinite(next) ? next : null;
};

const readString = (value: JsonObject | RuntimeJsonObject | null, key: string) =>
  typeof value?.[key] === 'string' ? (value[key] as string) : null;

const asJsonObject = (value: unknown): JsonObject | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonObject;
};

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const labelize = (value: string | null) =>
  value
    ? value
        .split('_')
        .map((part) => (part.length > 0 ? part[0]!.toUpperCase() + part.slice(1) : part))
        .join(' ')
    : 'Not captured';

const withUnique = (values: string[]) => [...new Set(values)];

const toCoverageStatus = (statuses: TargetStateInput['coverage']['statuses']): AdsOptimizerStateCoverageStatus => {
  const entries = Object.values(statuses);
  if (entries.some((value) => value === 'missing')) return 'missing';
  if (entries.some((value) => value === 'partial')) return 'partial';
  return 'ready';
};

const readConfigNumber = (payload: JsonObject | null, key: string, fallback: number) => {
  const value = payload?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

export const resolveAdsOptimizerStateEngineConfig = (
  rulePackPayload: AdsOptimizerRulePackPayload | null | undefined
): StateEngineConfig => {
  const stateEngine = asJsonObject(rulePackPayload?.state_engine ?? null);
  const thresholds = asJsonObject(stateEngine?.thresholds);
  const scoringWeights = asJsonObject(rulePackPayload?.scoring_weights ?? null);

  return {
    minClicksDirectional: readConfigNumber(
      thresholds,
      'min_clicks_directional',
      DEFAULT_STATE_ENGINE_CONFIG.minClicksDirectional
    ),
    minOrdersConfirmed: readConfigNumber(
      thresholds,
      'min_orders_confirmed',
      DEFAULT_STATE_ENGINE_CONFIG.minOrdersConfirmed
    ),
    minDaysDirectional: readConfigNumber(
      thresholds,
      'min_days_directional',
      DEFAULT_STATE_ENGINE_CONFIG.minDaysDirectional
    ),
    minDaysConfirmed: readConfigNumber(
      thresholds,
      'min_days_confirmed',
      DEFAULT_STATE_ENGINE_CONFIG.minDaysConfirmed
    ),
    breakEvenGapTolerance: readConfigNumber(
      thresholds,
      'break_even_gap_tolerance',
      DEFAULT_STATE_ENGINE_CONFIG.breakEvenGapTolerance
    ),
    dominantSpendShare: readConfigNumber(
      thresholds,
      'dominant_spend_share',
      DEFAULT_STATE_ENGINE_CONFIG.dominantSpendShare
    ),
    coreSpendShare: readConfigNumber(
      thresholds,
      'core_spend_share',
      DEFAULT_STATE_ENGINE_CONFIG.coreSpendShare
    ),
    dominantClickVelocity: readConfigNumber(
      thresholds,
      'dominant_click_velocity',
      DEFAULT_STATE_ENGINE_CONFIG.dominantClickVelocity
    ),
    coreClickVelocity: readConfigNumber(
      thresholds,
      'core_click_velocity',
      DEFAULT_STATE_ENGINE_CONFIG.coreClickVelocity
    ),
    dominantImportanceScore: readConfigNumber(
      thresholds,
      'dominant_importance_score',
      DEFAULT_STATE_ENGINE_CONFIG.dominantImportanceScore
    ),
    coreImportanceScore: readConfigNumber(
      thresholds,
      'core_importance_score',
      DEFAULT_STATE_ENGINE_CONFIG.coreImportanceScore
    ),
    noSaleSpendRisk: readConfigNumber(
      thresholds,
      'no_sale_spend_risk',
      DEFAULT_STATE_ENGINE_CONFIG.noSaleSpendRisk
    ),
    noSaleClicksRisk: readConfigNumber(
      thresholds,
      'no_sale_clicks_risk',
      DEFAULT_STATE_ENGINE_CONFIG.noSaleClicksRisk
    ),
    importanceWeight: readConfigNumber(
      scoringWeights,
      'importance',
      DEFAULT_STATE_ENGINE_CONFIG.importanceWeight
    ),
  };
};

export const deriveAdsOptimizerProductRunState = (
  overview: AdsOptimizerOverviewData
): AdsOptimizerProductRunState => {
  const coverageStatus: AdsOptimizerStateCoverageStatus =
    overview.warnings.length === 0 ? 'ready' : 'partial';
  const stateCode = `PRODUCT_STATE_${overview.state.value.toUpperCase()}`;
  const objectiveCode = `PRODUCT_OBJECTIVE_${overview.objective.value.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;

  return {
    engineVersion: STATE_ENGINE_VERSION,
    value: overview.state.value,
    label: overview.state.label,
    objective: overview.objective.value,
    objectiveReason: overview.objective.reason,
    reason: overview.state.reason,
    coverageStatus,
    reasonCodes:
      coverageStatus === 'ready'
        ? [stateCode, objectiveCode, 'PRODUCT_COVERAGE_READY']
        : [stateCode, objectiveCode, 'PRODUCT_COVERAGE_PARTIAL'],
    notes: overview.warnings,
  };
};

const classifyEfficiency = (
  input: TargetStateInput,
  config: StateEngineConfig
): AdsOptimizerTargetRunState['efficiency'] => {
  const hasActivity =
    input.raw.impressions > 0 ||
    input.raw.clicks > 0 ||
    input.raw.spend > 0 ||
    input.raw.orders > 0 ||
    input.raw.sales > 0;

  if (!hasActivity) {
    return {
      value: 'no_data',
      label: 'No data',
      detail: 'No target-level activity was captured in the selected run window.',
      coverageStatus: 'missing',
      reasonCodes: ['EFFICIENCY_NO_ACTIVITY'],
    };
  }

  if (input.raw.orders <= 0) {
    return {
      value: 'learning_no_sale',
      label: 'Learning / no sale',
      detail:
        'The target has traffic in the captured window, but no attributed orders yet, so it remains in a learning posture.',
      coverageStatus:
        input.coverage.statuses.searchTerms === 'missing' ? 'partial' : 'ready',
      reasonCodes: withUnique([
        'EFFICIENCY_NO_ATTRIBUTED_ORDERS',
        input.raw.clicks >= config.minClicksDirectional
          ? 'EFFICIENCY_DIRECTIONAL_CLICK_VOLUME'
          : 'EFFICIENCY_LOW_CLICK_VOLUME',
      ]),
    };
  }

  if (input.derived.contributionAfterAds === null || input.derived.breakEvenGap === null) {
    return {
      value: 'no_data',
      label: 'No data',
      detail:
        'Orders were present, but break-even product inputs were incomplete, so profitability state stayed explicit instead of being guessed.',
      coverageStatus:
        input.coverage.statuses.breakEvenInputs === 'missing' ? 'missing' : 'partial',
      reasonCodes: ['EFFICIENCY_BREAK_EVEN_INPUTS_MISSING', 'EFFICIENCY_NO_SAFE_PROFIT_CLASSIFICATION'],
    };
  }

  if (
    input.derived.contributionAfterAds < 0 ||
    input.derived.breakEvenGap < -config.breakEvenGapTolerance
  ) {
    return {
      value: 'converting_but_loss_making',
      label: 'Converting but loss-making',
      detail:
        'The target is converting, but the captured product economics show it is still running below break-even.',
      coverageStatus: 'ready',
      reasonCodes: withUnique([
        'EFFICIENCY_HAS_ORDERS',
        input.derived.contributionAfterAds < 0
          ? 'EFFICIENCY_NEGATIVE_CONTRIBUTION_AFTER_ADS'
          : 'EFFICIENCY_BREAK_EVEN_GAP_NEGATIVE',
      ]),
    };
  }

  if (Math.abs(input.derived.breakEvenGap) <= config.breakEvenGapTolerance) {
    return {
      value: 'break_even',
      label: 'Break-even',
      detail:
        'The target is converting close to the captured break-even boundary, so it is classified as break-even rather than strongly profitable.',
      coverageStatus: 'ready',
      reasonCodes: ['EFFICIENCY_HAS_ORDERS', 'EFFICIENCY_BREAK_EVEN_GAP_THIN'],
    };
  }

  return {
    value: 'profitable',
    label: 'Profitable',
    detail:
      'The target is converting with positive post-ad contribution and a positive break-even gap in the captured run window.',
    coverageStatus: 'ready',
    reasonCodes: ['EFFICIENCY_HAS_ORDERS', 'EFFICIENCY_POSITIVE_CONTRIBUTION_AFTER_ADS'],
  };
};

const classifyConfidence = (
  input: TargetStateInput,
  config: StateEngineConfig
): AdsOptimizerTargetRunState['confidence'] => {
  const sufficientDays = input.coverage.daysObserved >= config.minDaysDirectional;
  const confirmedDays = input.coverage.daysObserved >= config.minDaysConfirmed;

  if (input.raw.orders >= config.minOrdersConfirmed) {
    return {
      value: 'confirmed',
      label: 'Confirmed',
      detail:
        confirmedDays
          ? 'The target has repeated conversions and enough observed days to treat the captured performance as confirmed rather than purely directional.'
          : 'The target has repeated conversions in the captured run window, so the signal is treated as confirmed even though the observed-day span is still compact.',
      coverageStatus: 'ready',
      reasonCodes: withUnique([
        'CONFIDENCE_ORDER_THRESHOLD_MET',
        confirmedDays ? 'CONFIDENCE_WINDOW_SUFFICIENT' : 'CONFIDENCE_WINDOW_COMPACT',
      ]),
    };
  }

  if (
    input.raw.clicks >= config.minClicksDirectional ||
    input.raw.orders >= 1 ||
    sufficientDays
  ) {
    return {
      value: 'directional',
      label: 'Directional',
      detail:
        'The target has enough captured activity to show direction, but not enough repeated proof yet to treat the signal as fully confirmed.',
      coverageStatus:
        input.raw.clicks >= config.minClicksDirectional || input.raw.orders >= 1 ? 'ready' : 'partial',
      reasonCodes: withUnique([
        input.raw.clicks >= config.minClicksDirectional
          ? 'CONFIDENCE_CLICK_THRESHOLD_MET'
          : 'CONFIDENCE_SOME_ACTIVITY_ONLY',
        input.raw.orders >= 1 ? 'CONFIDENCE_AT_LEAST_ONE_ORDER' : 'CONFIDENCE_NEEDS_MORE_CONVERSIONS',
      ]),
    };
  }

  return {
    value: 'insufficient',
    label: 'Insufficient',
    detail:
      'Captured activity is still too thin to treat the target signal as directional with confidence.',
    coverageStatus: input.coverage.daysObserved > 0 ? 'partial' : 'missing',
    reasonCodes: ['CONFIDENCE_ACTIVITY_TOO_THIN'],
  };
};

const classifyImportance = (
  input: TargetStateInput,
  config: StateEngineConfig,
  confidence: AdsOptimizerTargetRunState['confidence']
): AdsOptimizerTargetRunState['importance'] & { rawScore: number } => {
  const spendShare =
    input.asinScopeMembership?.productAdSpend && input.asinScopeMembership.productAdSpend > 0
      ? input.raw.spend / input.asinScopeMembership.productAdSpend
      : null;
  const clickVelocity = input.derived.clickVelocity ?? 0;
  const demandClicks = input.demandProxies.totalSearchTermClicks;
  const sameTextBonus = input.demandProxies.sameTextSearchTermCount > 0 ? 8 : 0;
  const confidenceBonus =
    confidence.value === 'confirmed' ? 18 : confidence.value === 'directional' ? 9 : 0;

  const rawScore = clampScore(
    (
      (spendShare !== null ? Math.min(45, spendShare * 100) : 0) +
      Math.min(20, clickVelocity * 6) +
      Math.min(17, demandClicks) +
      sameTextBonus +
      confidenceBonus
    ) * config.importanceWeight
  );

  const dominant =
    rawScore >= config.dominantImportanceScore ||
    (spendShare !== null && spendShare >= config.dominantSpendShare) ||
    clickVelocity >= config.dominantClickVelocity;
  if (dominant) {
    return {
      value: 'tier_1_dominant',
      label: 'Tier 1 dominant',
      detail:
        'This target carries enough captured spend, click velocity, or demand concentration to be treated as dominant inside the selected ASIN scope.',
      coverageStatus: spendShare === null ? 'partial' : 'ready',
      reasonCodes: withUnique([
        rawScore >= config.dominantImportanceScore
          ? 'IMPORTANCE_SCORE_DOMINANT'
          : 'IMPORTANCE_SCORE_SUPPORTING',
        spendShare !== null && spendShare >= config.dominantSpendShare
          ? 'IMPORTANCE_DOMINANT_SPEND_SHARE'
          : 'IMPORTANCE_DOMINANT_VELOCITY',
      ]),
      rawScore,
    };
  }

  const core =
    rawScore >= config.coreImportanceScore ||
    (spendShare !== null && spendShare >= config.coreSpendShare) ||
    clickVelocity >= config.coreClickVelocity;
  if (core) {
    return {
      value: 'tier_2_core',
      label: 'Tier 2 core',
      detail:
        'This target is materially relevant in the captured ASIN scope, but it is not yet dominant enough to sit in the top tier.',
      coverageStatus: spendShare === null ? 'partial' : 'ready',
      reasonCodes: withUnique([
        rawScore >= config.coreImportanceScore
          ? 'IMPORTANCE_SCORE_CORE'
          : 'IMPORTANCE_ACTIVITY_CORE',
        spendShare !== null && spendShare >= config.coreSpendShare
          ? 'IMPORTANCE_CORE_SPEND_SHARE'
          : 'IMPORTANCE_CORE_VELOCITY',
      ]),
      rawScore,
    };
  }

  return {
    value: 'tier_3_test_long_tail',
    label: 'Tier 3 test / long-tail',
    detail:
      'The target remains a test or long-tail row in the captured scope because its concentration and velocity signals are still comparatively light.',
    coverageStatus: spendShare === null ? 'partial' : 'ready',
    reasonCodes: ['IMPORTANCE_LONG_TAIL_ACTIVITY'],
    rawScore,
  };
};

const buildOpportunityScore = (args: {
  input: TargetStateInput;
  efficiency: AdsOptimizerTargetRunState['efficiency'];
  confidence: AdsOptimizerTargetRunState['confidence'];
  importance: AdsOptimizerTargetRunState['importance'] & { rawScore: number };
}) => {
  let score = 0;
  const reasonCodes: string[] = [];

  if (args.efficiency.value === 'profitable') {
    score += 28;
    reasonCodes.push('OPPORTUNITY_PROFITABLE_BASELINE');
  } else if (args.efficiency.value === 'break_even') {
    score += 18;
    reasonCodes.push('OPPORTUNITY_BREAK_EVEN_HEADROOM');
  } else if (args.efficiency.value === 'learning_no_sale') {
    score += 10;
    reasonCodes.push('OPPORTUNITY_LEARNING_WINDOW');
  }

  if (args.confidence.value === 'confirmed') {
    score += 15;
    reasonCodes.push('OPPORTUNITY_CONFIRMED_SIGNAL');
  } else if (args.confidence.value === 'directional') {
    score += 8;
    reasonCodes.push('OPPORTUNITY_DIRECTIONAL_SIGNAL');
  }

  if (args.importance.value === 'tier_1_dominant') {
    score += 20;
    reasonCodes.push('OPPORTUNITY_TIER_1');
  } else if (args.importance.value === 'tier_2_core') {
    score += 11;
    reasonCodes.push('OPPORTUNITY_TIER_2');
  } else {
    score += 4;
    reasonCodes.push('OPPORTUNITY_TIER_3');
  }

  if ((args.input.derived.breakEvenGap ?? 0) > 0) {
    score += Math.min(18, (args.input.derived.breakEvenGap ?? 0) * 100);
    reasonCodes.push('OPPORTUNITY_BREAK_EVEN_HEADROOM_POSITIVE');
  }

  if ((args.input.derived.maxCpcSupportGap ?? 0) > 0) {
    score += Math.min(10, (args.input.derived.maxCpcSupportGap ?? 0) * 4);
    reasonCodes.push('OPPORTUNITY_CPC_SUPPORT_HEADROOM');
  }

  if ((args.input.derived.organicLeverageProxy ?? 0) > 0) {
    score += Math.min(9, (args.input.derived.organicLeverageProxy ?? 0) * 40);
    reasonCodes.push('OPPORTUNITY_ORGANIC_LEVERAGE_PRESENT');
  }

  return {
    score: clampScore(score),
    reasonCodes: withUnique(reasonCodes),
  };
};

const buildRiskScore = (args: {
  input: TargetStateInput;
  config: StateEngineConfig;
  efficiency: AdsOptimizerTargetRunState['efficiency'];
  confidence: AdsOptimizerTargetRunState['confidence'];
}) => {
  let score = 0;
  const reasonCodes: string[] = [];
  const statuses = Object.values(args.input.coverage.statuses);
  const missingCount = statuses.filter((status) => status === 'missing').length;
  const partialCount = statuses.filter((status) => status === 'partial').length;

  if (args.efficiency.value === 'converting_but_loss_making') {
    score += 35;
    reasonCodes.push('RISK_CONVERTING_LOSS_MAKING');
  }

  if (
    args.efficiency.value === 'learning_no_sale' &&
    (args.input.raw.spend >= args.config.noSaleSpendRisk ||
      args.input.raw.clicks >= args.config.noSaleClicksRisk)
  ) {
    score += 24;
    reasonCodes.push('RISK_NO_SALE_SPEND_OR_CLICK_CAP');
  }

  if (args.confidence.value === 'insufficient') {
    score += 15;
    reasonCodes.push('RISK_CONFIDENCE_INSUFFICIENT');
  } else if (args.confidence.value === 'directional') {
    score += 6;
    reasonCodes.push('RISK_CONFIDENCE_DIRECTIONAL_ONLY');
  }

  if ((args.input.derived.breakEvenGap ?? 0) < 0) {
    score += Math.min(18, Math.abs(args.input.derived.breakEvenGap ?? 0) * 100);
    reasonCodes.push('RISK_NEGATIVE_BREAK_EVEN_GAP');
  }

  if (missingCount > 0) {
    score += missingCount * 8;
    reasonCodes.push('RISK_MISSING_COVERAGE');
  }

  if (partialCount > 0) {
    score += partialCount * 3;
    reasonCodes.push('RISK_PARTIAL_COVERAGE');
  }

  return {
    score: clampScore(score),
    reasonCodes: withUnique(reasonCodes),
  };
};

export const classifyAdsOptimizerTargetState = (
  input: TargetStateInput,
  rulePackPayload?: AdsOptimizerRulePackPayload | null
): AdsOptimizerTargetRunState => {
  const config = resolveAdsOptimizerStateEngineConfig(rulePackPayload);
  const efficiency = classifyEfficiency(input, config);
  const confidence = classifyConfidence(input, config);
  const importance = classifyImportance(input, config, confidence);
  const opportunity = buildOpportunityScore({
    input,
    efficiency,
    confidence,
    importance,
  });
  const risk = buildRiskScore({
    input,
    config,
    efficiency,
    confidence,
  });

  return {
    engineVersion: STATE_ENGINE_VERSION,
    coverageStatus: toCoverageStatus(input.coverage.statuses),
    efficiency,
    confidence,
    importance: {
      value: importance.value,
      label: importance.label,
      detail: importance.detail,
      coverageStatus: importance.coverageStatus,
      reasonCodes: importance.reasonCodes,
    },
    opportunityScore: opportunity.score,
    riskScore: risk.score,
    opportunityReasonCodes: opportunity.reasonCodes,
    riskReasonCodes: risk.reasonCodes,
    summaryReasonCodes: withUnique([
      ...efficiency.reasonCodes,
      ...confidence.reasonCodes,
      ...importance.reasonCodes,
      ...opportunity.reasonCodes,
      ...risk.reasonCodes,
    ]),
  };
};

const readTargetStateInput = (payload: RuntimeJsonObject): TargetStateInput => {
  const totals = asJsonObject(payload.totals);
  const nonAdditive = asJsonObject(payload.non_additive_diagnostics);
  const derivedMetrics = asJsonObject(payload.derived_metrics);
  const demandProxies = asJsonObject(payload.demand_proxies);
  const coverage = asJsonObject(payload.coverage);
  const coverageStatuses = asJsonObject(coverage?.statuses);
  const asinScopeMembership = asJsonObject(payload.asin_scope_membership);
  const productContext = asJsonObject(payload.product_context);

  return {
    raw: {
      impressions: numberValue(totals?.impressions),
      clicks: numberValue(totals?.clicks),
      spend: numberValue(totals?.spend),
      orders: numberValue(totals?.orders),
      sales: numberValue(totals?.sales),
      cpc: readNumber(totals, 'cpc'),
      ctr: readNumber(totals, 'ctr'),
      cvr: readNumber(totals, 'cvr') ?? readNumber(totals, 'conversion_rate'),
      acos: readNumber(totals, 'acos'),
      roas: readNumber(totals, 'roas'),
      tosIs: readNumber(nonAdditive, 'top_of_search_impression_share_latest'),
      stis: readNumber(nonAdditive, 'representative_stis_latest'),
      stir: readNumber(nonAdditive, 'representative_stir_latest'),
    },
    derived: {
      contributionAfterAds: readNumber(derivedMetrics, 'contribution_after_ads'),
      breakEvenGap: readNumber(derivedMetrics, 'break_even_gap'),
      maxCpcSupportGap: readNumber(derivedMetrics, 'max_cpc_support_gap'),
      lossDollars: readNumber(derivedMetrics, 'loss_dollars'),
      profitDollars: readNumber(derivedMetrics, 'profit_dollars'),
      clickVelocity: readNumber(derivedMetrics, 'click_velocity'),
      impressionVelocity: readNumber(derivedMetrics, 'impression_velocity'),
      organicLeverageProxy: readNumber(derivedMetrics, 'organic_leverage_proxy'),
    },
    coverage: {
      daysObserved: numberValue(coverage?.days_observed),
      statuses: {
        tosIs:
          (readString(coverageStatuses, 'tos_is') as TargetSnapshotPayloadCoverageStatus | null) ??
          'missing',
        stis:
          (readString(coverageStatuses, 'stis') as TargetSnapshotPayloadCoverageStatus | null) ??
          'missing',
        stir:
          (readString(coverageStatuses, 'stir') as TargetSnapshotPayloadCoverageStatus | null) ??
          'missing',
        placementContext:
          (readString(
            coverageStatuses,
            'placement_context'
          ) as TargetSnapshotPayloadCoverageStatus | null) ?? 'missing',
        searchTerms:
          (readString(
            coverageStatuses,
            'search_terms'
          ) as TargetSnapshotPayloadCoverageStatus | null) ?? 'missing',
        breakEvenInputs:
          (readString(
            coverageStatuses,
            'break_even_inputs'
          ) as TargetSnapshotPayloadCoverageStatus | null) ?? 'missing',
      },
      notes: Array.isArray(coverage?.notes)
        ? coverage.notes.filter((value): value is string => typeof value === 'string')
        : [],
    },
    demandProxies: {
      searchTermCount: numberValue(demandProxies?.search_term_count),
      sameTextSearchTermCount: numberValue(demandProxies?.same_text_search_term_count),
      totalSearchTermImpressions: numberValue(demandProxies?.total_search_term_impressions),
      totalSearchTermClicks: numberValue(demandProxies?.total_search_term_clicks),
      representativeClickShare: readNumber(demandProxies, 'representative_click_share'),
    },
    asinScopeMembership: asinScopeMembership
      ? {
          productAdSpend: readNumber(asinScopeMembership, 'product_ad_spend'),
          productAdSales: readNumber(asinScopeMembership, 'product_ad_sales'),
          productOrders: readNumber(asinScopeMembership, 'product_orders'),
          productUnits: readNumber(asinScopeMembership, 'product_units'),
        }
      : null,
    productContext: {
      breakEvenAcos: readNumber(productContext, 'break_even_acos'),
      averagePrice: readNumber(productContext, 'average_price'),
      productState: readString(productContext, 'product_state'),
      productObjective: readString(productContext, 'product_objective'),
    },
  };
};

export const enrichAdsOptimizerTargetSnapshotPayload = (args: {
  payload: RuntimeJsonObject;
  rulePackPayload?: AdsOptimizerRulePackPayload | null;
}): RuntimeJsonObject => {
  const state = classifyAdsOptimizerTargetState(
    readTargetStateInput(args.payload),
    args.rulePackPayload
  );

  return {
    ...args.payload,
    phase: Math.max(numberValue(args.payload.phase), 6),
    state_engine: {
      engine_version: state.engineVersion,
      coverage_status: state.coverageStatus,
      efficiency: {
        value: state.efficiency.value,
        label: state.efficiency.label,
        detail: state.efficiency.detail,
        coverage_status: state.efficiency.coverageStatus,
        reason_codes: state.efficiency.reasonCodes,
      },
      confidence: {
        value: state.confidence.value,
        label: state.confidence.label,
        detail: state.confidence.detail,
        coverage_status: state.confidence.coverageStatus,
        reason_codes: state.confidence.reasonCodes,
      },
      importance: {
        value: state.importance.value,
        label: state.importance.label,
        detail: state.importance.detail,
        coverage_status: state.importance.coverageStatus,
        reason_codes: state.importance.reasonCodes,
      },
      scores: {
        opportunity: state.opportunityScore,
        risk: state.riskScore,
        opportunity_reason_codes: state.opportunityReasonCodes,
        risk_reason_codes: state.riskReasonCodes,
      },
      reason_codes: state.summaryReasonCodes,
    },
  };
};

export const enrichAdsOptimizerProductSnapshotPayload = (args: {
  payload: RuntimeJsonObject;
  overview: AdsOptimizerOverviewData;
}): RuntimeJsonObject => {
  const state = deriveAdsOptimizerProductRunState(args.overview);

  return {
    ...args.payload,
    phase: Math.max(numberValue(args.payload.phase), 6),
    state_engine: {
      engine_version: state.engineVersion,
      product_state: {
        value: state.value,
        label: state.label,
        reason: state.reason,
      },
      objective: {
        value: state.objective,
        reason: state.objectiveReason,
      },
      coverage_status: state.coverageStatus,
      reason_codes: state.reasonCodes,
      notes: state.notes,
    },
  };
};

const readReasonCodes = (value: JsonObject | null, key: string) => {
  const raw = value?.[key];
  return Array.isArray(raw) ? raw.filter((entry): entry is string => typeof entry === 'string') : [];
};

export const readAdsOptimizerTargetRunState = (
  payload: RuntimeJsonObject
): AdsOptimizerTargetRunState | null => {
  const stateEngine = asJsonObject(payload.state_engine);
  if (!stateEngine) return null;

  const efficiency = asJsonObject(stateEngine.efficiency);
  const confidence = asJsonObject(stateEngine.confidence);
  const importance = asJsonObject(stateEngine.importance);
  const scores = asJsonObject(stateEngine.scores);

  return {
    engineVersion: readString(stateEngine, 'engine_version') ?? STATE_ENGINE_VERSION,
    coverageStatus:
      (readString(stateEngine, 'coverage_status') as AdsOptimizerStateCoverageStatus | null) ??
      'missing',
    efficiency: {
      value:
        (readString(
          efficiency,
          'value'
        ) as AdsOptimizerTargetEfficiencyState | null) ?? null,
      label: readString(efficiency, 'label') ?? 'Not captured',
      detail: readString(efficiency, 'detail') ?? 'This run predates Phase 6 state capture.',
      coverageStatus:
        (readString(
          efficiency,
          'coverage_status'
        ) as AdsOptimizerStateCoverageStatus | null) ?? 'missing',
      reasonCodes: readReasonCodes(efficiency, 'reason_codes'),
    },
    confidence: {
      value:
        (readString(
          confidence,
          'value'
        ) as AdsOptimizerTargetConfidenceState | null) ?? null,
      label: readString(confidence, 'label') ?? 'Not captured',
      detail: readString(confidence, 'detail') ?? 'This run predates Phase 6 state capture.',
      coverageStatus:
        (readString(
          confidence,
          'coverage_status'
        ) as AdsOptimizerStateCoverageStatus | null) ?? 'missing',
      reasonCodes: readReasonCodes(confidence, 'reason_codes'),
    },
    importance: {
      value:
        (readString(
          importance,
          'value'
        ) as AdsOptimizerTargetImportanceTier | null) ?? null,
      label: readString(importance, 'label') ?? 'Not captured',
      detail: readString(importance, 'detail') ?? 'This run predates Phase 6 state capture.',
      coverageStatus:
        (readString(
          importance,
          'coverage_status'
        ) as AdsOptimizerStateCoverageStatus | null) ?? 'missing',
      reasonCodes: readReasonCodes(importance, 'reason_codes'),
    },
    opportunityScore: numberValue(scores?.opportunity),
    riskScore: numberValue(scores?.risk),
    opportunityReasonCodes: readReasonCodes(scores, 'opportunity_reason_codes'),
    riskReasonCodes: readReasonCodes(scores, 'risk_reason_codes'),
    summaryReasonCodes: readReasonCodes(stateEngine, 'reason_codes'),
  };
};

export const readAdsOptimizerProductRunState = (
  payload: RuntimeJsonObject
): AdsOptimizerProductRunState | null => {
  const stateEngine = asJsonObject(payload.state_engine);
  if (!stateEngine) return null;

  const productState = asJsonObject(stateEngine.product_state);
  const objective = asJsonObject(stateEngine.objective);

  return {
    engineVersion: readString(stateEngine, 'engine_version') ?? STATE_ENGINE_VERSION,
    value:
      (readString(productState, 'value') as AdsOptimizerProductState | null) ?? 'structurally_weak',
    label: readString(productState, 'label') ?? labelize(readString(productState, 'value')),
    objective:
      (readString(objective, 'value') as AdsOptimizerObjective | null) ?? 'Recover',
    objectiveReason: readString(objective, 'reason') ?? 'This run predates captured objective state.',
    reason: readString(productState, 'reason') ?? 'This run predates captured product state.',
    coverageStatus:
      (readString(stateEngine, 'coverage_status') as AdsOptimizerStateCoverageStatus | null) ??
      'missing',
    reasonCodes: readReasonCodes(stateEngine, 'reason_codes'),
    notes: readReasonCodes(stateEngine, 'notes'),
  };
};
