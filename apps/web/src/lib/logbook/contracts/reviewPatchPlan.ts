import {
  extractAdsOptimizationContractV1FromScope,
  type FinalPlanSnapshotV1,
  type PatchDecisionModeV1,
  type PatchDecisionV1,
  type ReviewPatchPackV1,
  type ReviewPatchPayloadV1,
} from './adsOptimizationContractV1';

type JsonRecord = Record<string, unknown>;

export type ExecutableBulkgenPlanV1 = {
  channel: 'SP' | 'SB';
  generator: 'bulkgen:sp:update' | 'bulkgen:sb:update';
  run_id: string;
  notes?: string;
  actions: JsonRecord[];
};

export type ProposalActionRefV1 = {
  change_id: string;
  channel: 'SP' | 'SB';
  generator: 'bulkgen:sp:update' | 'bulkgen:sb:update';
  run_id: string;
  plan_index: number;
  action_index: number;
  action_type: string;
  action: JsonRecord;
  entity_ref: string;
  summary: string;
  numeric_field_key?: string;
  proposed_numeric_value?: number;
};

export type ReviewRankingContextV1 = {
  objective?: string | null;
  forecast_kpis?: string[] | null;
};

export type RankedProposalActionV1 = ProposalActionRefV1 & {
  review_rank: {
    objective_alignment: number;
    expected_kpi_movement: number;
    risk_guardrail: number;
    magnitude: number;
  };
};

export type BulkgenPlanSelectionV1 = {
  plans: ExecutableBulkgenPlanV1[];
  source: 'final_plan' | 'proposal' | 'none';
  warning?: string;
  final_plan_pack_id?: string | null;
};

export type ApplyReviewPatchResultV1 = {
  bulkgen_plans: ExecutableBulkgenPlanV1[];
  summary: {
    actions_total: number;
    accepted_actions: number;
    rejected_actions: number;
    modified_actions: number;
  };
  warnings: string[];
};

const DEFAULT_RISK_SCORE = 5;

const asRecord = (value: unknown): JsonRecord | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonRecord;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const normalizeText = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const parseExecutableBulkgenPlans = (value: unknown): ExecutableBulkgenPlanV1[] => {
  if (!Array.isArray(value)) return [];
  const out: ExecutableBulkgenPlanV1[] = [];

  for (const entry of value) {
    const plan = asRecord(entry);
    if (!plan) continue;
    const channel = asString(plan.channel)?.toUpperCase();
    const generator = asString(plan.generator);
    const runId = asString(plan.run_id);
    const actionsRaw = Array.isArray(plan.actions) ? plan.actions : [];
    const actions = actionsRaw
      .map((action) => asRecord(action))
      .filter((action): action is JsonRecord => Boolean(action))
      .map((action) => ({ ...action }));

    if (!runId || actions.length === 0) continue;
    if (channel !== 'SP' && channel !== 'SB') continue;
    if (generator !== 'bulkgen:sp:update' && generator !== 'bulkgen:sb:update') continue;

    out.push({
      channel,
      generator,
      run_id: runId,
      notes: asString(plan.notes) ?? undefined,
      actions,
    } as ExecutableBulkgenPlanV1);
  }

  return out;
};

const hashText = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const actionType = (action: JsonRecord): string => asString(action.type) ?? 'unknown';

const numericFieldForAction = (
  channel: 'SP' | 'SB',
  action: JsonRecord
): string | null => {
  const type = actionType(action);
  if (type === 'update_campaign_budget') return 'new_budget';
  if (type === 'update_target_bid') return 'new_bid';
  if (type === 'update_placement_modifier') return 'new_pct';
  if (type === 'update_ad_group_default_bid') {
    if (channel === 'SB') return 'new_default_bid';
    return 'new_bid';
  }
  return null;
};

const actionSignature = (
  params: {
    channel: 'SP' | 'SB';
    generator: 'bulkgen:sp:update' | 'bulkgen:sb:update';
    run_id: string;
    action: JsonRecord;
  }
): string => {
  const action = params.action;
  const keys = [
    'campaign_id',
    'ad_group_id',
    'target_id',
    'placement_code',
    'placement_raw',
    'new_budget',
    'new_bid',
    'new_default_bid',
    'new_pct',
    'new_state',
    'new_strategy',
  ];

  const parts = [
    params.channel,
    params.generator,
    params.run_id,
    actionType(action),
  ];
  for (const key of keys) {
    const value = action[key];
    parts.push(`${key}=${value === undefined ? '' : String(value)}`);
  }
  return parts.join('|');
};

const existingStableActionId = (action: JsonRecord): string | null =>
  asString(action.change_id) ?? asString(action.action_id) ?? asString(action.id);

const entityRefForAction = (action: JsonRecord): string => {
  const campaignId = asString(action.campaign_id);
  const adGroupId = asString(action.ad_group_id);
  const targetId = asString(action.target_id);
  const placementCode = asString(action.placement_code);
  const placementRaw = asString(action.placement_raw);
  const pieces = [
    campaignId ? `campaign_id=${campaignId}` : null,
    adGroupId ? `ad_group_id=${adGroupId}` : null,
    targetId ? `target_id=${targetId}` : null,
    placementCode ? `placement_code=${placementCode}` : null,
    placementRaw ? `placement_raw=${placementRaw}` : null,
  ].filter((entry): entry is string => Boolean(entry));
  return pieces.length > 0 ? pieces.join(' · ') : 'global';
};

const summaryForAction = (
  channel: 'SP' | 'SB',
  action: JsonRecord,
  numericFieldKey: string | null
): string => {
  const type = actionType(action);
  const fieldValue =
    numericFieldKey !== null
      ? action[numericFieldKey]
      : action.new_state ?? action.new_strategy ?? null;
  const valueLabel =
    fieldValue === null || fieldValue === undefined ? '' : ` -> ${String(fieldValue)}`;
  return `${channel} ${type}${valueLabel}`;
};

export const extractProposalBulkgenPlansFromScope = (scope: unknown): ExecutableBulkgenPlanV1[] => {
  const scopeRecord = asRecord(scope);
  return parseExecutableBulkgenPlans(scopeRecord?.bulkgen_plans);
};

export const selectBulkgenPlansForExecution = (scope: unknown): BulkgenPlanSelectionV1 => {
  const proposalPlans = extractProposalBulkgenPlansFromScope(scope);
  const contract = extractAdsOptimizationContractV1FromScope(scope, {
    defaultWorkflowMode: true,
  });

  const finalPlans = parseExecutableBulkgenPlans(contract?.final_plan?.bulkgen_plans);
  if (finalPlans.length > 0) {
    return {
      plans: finalPlans,
      source: 'final_plan',
      final_plan_pack_id: contract?.final_plan?.pack_id ?? null,
    };
  }

  if (proposalPlans.length > 0) {
    return {
      plans: proposalPlans,
      source: 'proposal',
      warning:
        'Plan is not finalized; using proposal bulkgen_plans fallback. Save review decisions and finalize to lock a final plan.',
      final_plan_pack_id: null,
    };
  }

  return {
    plans: [],
    source: 'none',
    final_plan_pack_id: null,
  };
};

export const buildProposalActionRefs = (
  plans: ExecutableBulkgenPlanV1[]
): ProposalActionRefV1[] => {
  const refs: ProposalActionRefV1[] = [];
  const signatureSeenCount = new Map<string, number>();

  plans.forEach((plan, planIndex) => {
    plan.actions.forEach((action, actionIndex) => {
      const stableExistingId = existingStableActionId(action);
      const signature = actionSignature({
        channel: plan.channel,
        generator: plan.generator,
        run_id: plan.run_id,
        action,
      });
      const seenCount = signatureSeenCount.get(signature) ?? 0;
      signatureSeenCount.set(signature, seenCount + 1);
      const computedId = `chg_${hashText(`${signature}#${seenCount}`)}`;
      const changeId = stableExistingId ?? computedId;
      const numericFieldKey = numericFieldForAction(plan.channel, action);
      const proposedNumericValue =
        numericFieldKey !== null ? asFiniteNumber(action[numericFieldKey]) ?? undefined : undefined;

      refs.push({
        change_id: changeId,
        channel: plan.channel,
        generator: plan.generator,
        run_id: plan.run_id,
        plan_index: planIndex,
        action_index: actionIndex,
        action_type: actionType(action),
        action: { ...action },
        entity_ref: entityRefForAction(action),
        summary: summaryForAction(plan.channel, action, numericFieldKey),
        numeric_field_key: numericFieldKey ?? undefined,
        proposed_numeric_value: proposedNumericValue,
      });
    });
  });

  return refs;
};

const objectiveMode = (objective: string | null | undefined): 'growth' | 'efficiency' | 'neutral' => {
  const text = normalizeText(objective ?? '');
  if (!text) return 'neutral';
  if (
    text.includes('grow') ||
    text.includes('scale') ||
    text.includes('increase') ||
    text.includes('expand')
  ) {
    return 'growth';
  }
  if (
    text.includes('acos') ||
    text.includes('efficien') ||
    text.includes('profit') ||
    text.includes('reduce spend') ||
    text.includes('guardrail')
  ) {
    return 'efficiency';
  }
  return 'neutral';
};

const objectiveRank = (mode: 'growth' | 'efficiency' | 'neutral', actionTypeValue: string): number => {
  if (mode === 'neutral') return 1;

  if (mode === 'growth') {
    if (
      actionTypeValue === 'update_campaign_budget' ||
      actionTypeValue === 'update_target_bid' ||
      actionTypeValue === 'update_ad_group_default_bid' ||
      actionTypeValue === 'update_placement_modifier'
    ) {
      return 0;
    }
    if (actionTypeValue === 'update_campaign_state' || actionTypeValue === 'update_target_state') {
      return 2;
    }
    return 1;
  }

  if (actionTypeValue === 'update_campaign_state' || actionTypeValue === 'update_target_state') {
    return 0;
  }
  if (
    actionTypeValue === 'update_campaign_budget' ||
    actionTypeValue === 'update_target_bid' ||
    actionTypeValue === 'update_ad_group_default_bid'
  ) {
    return 1;
  }
  return 2;
};

const inferAffectedKpis = (actionTypeValue: string): string[] => {
  if (actionTypeValue === 'update_campaign_budget') return ['spend', 'sales', 'orders'];
  if (actionTypeValue === 'update_campaign_bidding_strategy') return ['acos', 'roas', 'cpc', 'spend'];
  if (actionTypeValue === 'update_target_bid' || actionTypeValue === 'update_ad_group_default_bid') {
    return ['spend', 'cpc', 'sales', 'orders', 'acos', 'roas'];
  }
  if (actionTypeValue === 'update_placement_modifier') return ['spend', 'sales', 'orders', 'acos', 'roas'];
  if (actionTypeValue === 'update_campaign_state' || actionTypeValue === 'update_target_state') {
    return ['spend', 'sales', 'orders'];
  }
  return ['spend'];
};

const expectedKpiRank = (actionTypeValue: string, forecastKpis: string[]): number => {
  if (forecastKpis.length === 0) return 1;
  const affected = inferAffectedKpis(actionTypeValue);
  const matches = affected.some((metric) =>
    forecastKpis.some((forecastKpi) => forecastKpi.includes(metric))
  );
  return matches ? 0 : 1;
};

const riskRank = (actionTypeValue: string): number => {
  if (actionTypeValue === 'update_campaign_state' || actionTypeValue === 'update_target_state') return 3;
  if (actionTypeValue === 'update_campaign_bidding_strategy') return 2;
  if (
    actionTypeValue === 'update_campaign_budget' ||
    actionTypeValue === 'update_target_bid' ||
    actionTypeValue === 'update_ad_group_default_bid' ||
    actionTypeValue === 'update_placement_modifier'
  ) {
    return 1;
  }
  return DEFAULT_RISK_SCORE;
};

export const rankAndSortProposalActions = (
  actions: ProposalActionRefV1[],
  context: ReviewRankingContextV1 = {}
): RankedProposalActionV1[] => {
  const mode = objectiveMode(context.objective);
  const forecastKpis = (context.forecast_kpis ?? [])
    .map((kpi) => normalizeText(kpi))
    .filter((kpi) => kpi.length > 0);

  const ranked = actions.map((action) => {
    const magnitude = Math.abs(action.proposed_numeric_value ?? 0);
    return {
      ...action,
      review_rank: {
        objective_alignment: objectiveRank(mode, action.action_type),
        expected_kpi_movement: expectedKpiRank(action.action_type, forecastKpis),
        risk_guardrail: riskRank(action.action_type),
        magnitude,
      },
    };
  });

  return ranked.sort((left, right) => {
    const objectiveCompare = left.review_rank.objective_alignment - right.review_rank.objective_alignment;
    if (objectiveCompare !== 0) return objectiveCompare;

    const kpiCompare = left.review_rank.expected_kpi_movement - right.review_rank.expected_kpi_movement;
    if (kpiCompare !== 0) return kpiCompare;

    const riskCompare = left.review_rank.risk_guardrail - right.review_rank.risk_guardrail;
    if (riskCompare !== 0) return riskCompare;

    const magnitudeCompare = right.review_rank.magnitude - left.review_rank.magnitude;
    if (magnitudeCompare !== 0) return magnitudeCompare;

    const channelCompare = left.channel.localeCompare(right.channel);
    if (channelCompare !== 0) return channelCompare;

    const runCompare = left.run_id.localeCompare(right.run_id);
    if (runCompare !== 0) return runCompare;

    return left.action_index - right.action_index;
  });
};

const normalizeDecisionMode = (value: unknown): PatchDecisionModeV1 => {
  const normalized = asString(value)?.toLowerCase();
  if (normalized === 'reject') return 'reject';
  if (normalized === 'modify') return 'modify';
  return 'accept';
};

const decisionOverride = (decision: PatchDecisionV1): number | null => {
  const direct = asFiniteNumber(decision.override_new_value);
  if (direct !== null) return direct;
  const nested = asRecord(decision.override);
  return asFiniteNumber(nested?.new_value);
};

const applyNumericOverride = (
  action: JsonRecord,
  numericFieldKey: string | undefined,
  overrideValue: number | null
): JsonRecord => {
  if (!numericFieldKey || overrideValue === null) return { ...action };
  return {
    ...action,
    [numericFieldKey]: overrideValue,
  };
};

export const applyReviewPatchToProposal = (
  proposalPlans: ExecutableBulkgenPlanV1[],
  patchPayload: ReviewPatchPayloadV1
): ApplyReviewPatchResultV1 => {
  const refs = buildProposalActionRefs(proposalPlans);
  const refByChangeId = new Map<string, ProposalActionRefV1>();
  const refByPosition = new Map<string, ProposalActionRefV1>();
  for (const ref of refs) {
    refByChangeId.set(ref.change_id, ref);
    refByPosition.set(`${ref.plan_index}:${ref.action_index}`, ref);
  }

  const decisionByChangeId = new Map<string, PatchDecisionV1>();
  const warnings: string[] = [];
  for (const decisionRaw of patchPayload.decisions ?? []) {
    const changeId = asString(decisionRaw.change_id);
    if (!changeId) continue;
    if (!refByChangeId.has(changeId)) {
      warnings.push(`Patch decision ignored; change_id not found in proposal: ${changeId}`);
      continue;
    }
    decisionByChangeId.set(changeId, decisionRaw);
  }

  let acceptedActions = 0;
  let rejectedActions = 0;
  let modifiedActions = 0;

  const nextPlans: ExecutableBulkgenPlanV1[] = [];
  proposalPlans.forEach((plan, planIndex) => {
    const nextActions: JsonRecord[] = [];
    plan.actions.forEach((action, actionIndex) => {
      const ref = refByPosition.get(`${planIndex}:${actionIndex}`);
      if (!ref) {
        acceptedActions += 1;
        nextActions.push({ ...action });
        return;
      }

      const decisionRaw = decisionByChangeId.get(ref.change_id);
      const decisionMode = normalizeDecisionMode(decisionRaw?.decision);
      if (decisionMode === 'reject') {
        rejectedActions += 1;
        return;
      }

      if (decisionMode === 'modify') {
        const override = decisionRaw ? decisionOverride(decisionRaw) : null;
        if (ref.numeric_field_key && override !== null) {
          modifiedActions += 1;
          nextActions.push(applyNumericOverride(action, ref.numeric_field_key, override));
          return;
        }
        warnings.push(
          `Change ${ref.change_id} requested modify but no numeric override was provided; action kept as proposed.`
        );
        modifiedActions += 1;
        nextActions.push({ ...action });
        return;
      }

      acceptedActions += 1;
      nextActions.push({ ...action });
    });

    if (nextActions.length > 0) {
      nextPlans.push({
        ...plan,
        actions: nextActions,
      });
    }
  });

  return {
    bulkgen_plans: nextPlans,
    summary: {
      actions_total: refs.length,
      accepted_actions: acceptedActions,
      rejected_actions: rejectedActions,
      modified_actions: modifiedActions,
    },
    warnings,
  };
};

export const buildFinalPlanSnapshot = (params: {
  proposalPlans: ExecutableBulkgenPlanV1[];
  reviewPatchPack: ReviewPatchPackV1;
}): { finalPlan: FinalPlanSnapshotV1; warnings: string[] } => {
  const applied = applyReviewPatchToProposal(params.proposalPlans, params.reviewPatchPack.patch);
  const planHash = hashText(
    JSON.stringify({
      review_patch_pack_id: params.reviewPatchPack.pack_id,
      bulkgen_plans: applied.bulkgen_plans,
    })
  );

  return {
    finalPlan: {
      pack_id: `final_${planHash}`,
      created_at: new Date().toISOString(),
      source: 'review_patch_applied',
      review_patch_pack_id: params.reviewPatchPack.pack_id,
      plan_source: 'scope.bulkgen_plans',
      summary: applied.summary,
      bulkgen_plans: applied.bulkgen_plans,
    },
    warnings: applied.warnings,
  };
};
