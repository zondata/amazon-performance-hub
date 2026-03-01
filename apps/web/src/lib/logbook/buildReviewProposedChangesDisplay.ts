import 'server-only';

import {
  fetchCurrentSbData,
  fetchCurrentSpData,
  type CurrentSbPlacement,
  type FetchCurrentSbResult,
  type FetchCurrentResult,
} from '@/lib/bulksheets/fetchCurrent';
import type { ExecutableBulkgenPlanV1, RankedProposalActionV1 } from '@/lib/logbook/contracts/reviewPatchPlan';
import type { ReviewProposedChangesDisplayRow } from '@/lib/logbook/reviewProposedChangesDisplayModel';

type BuildParams = {
  proposalPlans: ExecutableBulkgenPlanV1[];
  rankedActions: RankedProposalActionV1[];
  objective?: string | null;
};

type BuildResult = {
  rows: ReviewProposedChangesDisplayRow[];
  warnings: string[];
};

const NOT_FOUND = '(not found)';

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
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

const toOneSentence = (value: string): string => {
  const normalized = value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\r\n]+/g, ' ');
  if (!normalized) return '';
  const sentenceMatch = normalized.match(/^.*?[.!?](?:\s|$)/);
  const first = sentenceMatch ? sentenceMatch[0].trim() : normalized;
  return /[.!?]$/.test(first) ? first : `${first}.`;
};

const objectiveMode = (objective: string | null | undefined): 'growth' | 'efficiency' | 'neutral' => {
  const text = normalizeText(objective ?? '');
  if (!text) return 'neutral';
  if (text.includes('grow') || text.includes('scale') || text.includes('increase') || text.includes('expand')) {
    return 'growth';
  }
  if (text.includes('acos') || text.includes('efficien') || text.includes('profit') || text.includes('guardrail')) {
    return 'efficiency';
  }
  return 'neutral';
};

const actionGroupFromType = (actionType: string) => {
  if (actionType.endsWith('_state')) return 'State' as const;
  if (actionType === 'update_campaign_budget') return 'Budget' as const;
  if (actionType === 'update_campaign_bidding_strategy') return 'Strategy' as const;
  if (actionType === 'update_placement_modifier') return 'Placement' as const;
  if (actionType === 'update_target_bid' || actionType === 'update_ad_group_default_bid') return 'Bid' as const;
  return 'Other' as const;
};

const directionWord = (previous: number | null, next: number | null) => {
  if (previous === null || next === null) return 'adjust';
  if (next > previous) return 'increase';
  if (next < previous) return 'decrease';
  return 'keep';
};

const heuristicWhy = (params: {
  objective: string | null | undefined;
  actionType: string;
  previousNumeric: number | null;
  currentNumeric: number | null;
}) => {
  const mode = objectiveMode(params.objective);
  const group = actionGroupFromType(params.actionType);
  const direction = directionWord(params.previousNumeric, params.currentNumeric);

  if (mode === 'growth') {
    if (group === 'Budget' || group === 'Bid' || group === 'Placement') {
      return `For a growth objective, this ${direction} should expand delivery while guardrails are monitored.`;
    }
    if (group === 'State') {
      return 'For a growth objective, this state change keeps delivery focused on scalable inventory.';
    }
    return 'For a growth objective, this adjustment supports additional qualified traffic and conversion volume.';
  }

  if (mode === 'efficiency') {
    if (group === 'Budget' || group === 'Bid' || group === 'Placement') {
      return `For an efficiency objective, this ${direction} aims to control cost while preserving high-quality demand.`;
    }
    if (group === 'State') {
      return 'For an efficiency objective, this state change removes lower-quality spend from active delivery.';
    }
    return 'For an efficiency objective, this adjustment prioritizes profitability and guardrail adherence.';
  }

  return 'This change aligns with the current experiment goal and keeps execution within expected guardrails.';
};

const valueKeyByActionType = (channel: 'SP' | 'SB', actionType: string) => {
  if (actionType === 'update_campaign_budget') return 'new_budget';
  if (actionType === 'update_target_bid') return 'new_bid';
  if (actionType === 'update_ad_group_default_bid') return channel === 'SB' ? 'new_default_bid' : 'new_bid';
  if (actionType === 'update_placement_modifier') return 'new_pct';
  if (actionType === 'update_campaign_state' || actionType === 'update_target_state' || actionType === 'update_ad_group_state') {
    return 'new_state';
  }
  if (actionType === 'update_campaign_bidding_strategy') return 'new_strategy';
  return null;
};

const fieldLabelByActionType = (actionType: string) => {
  if (actionType === 'update_campaign_budget') return 'Budget';
  if (actionType === 'update_target_bid' || actionType === 'update_ad_group_default_bid') return 'Bid';
  if (actionType === 'update_placement_modifier') return 'Placement %';
  if (actionType === 'update_campaign_state' || actionType === 'update_target_state' || actionType === 'update_ad_group_state') {
    return 'State';
  }
  if (actionType === 'update_campaign_bidding_strategy') return 'Strategy';
  return 'Value';
};

const actionLabel = (params: {
  actionType: string;
  fieldLabel: string;
  currentValue: string | number | null;
}) => {
  const suffix = params.currentValue === null ? '' : ` -> ${String(params.currentValue)}`;
  if (params.actionType === 'update_campaign_budget') return `Set campaign budget${suffix}`;
  if (params.actionType === 'update_campaign_state') return `Set campaign state${suffix}`;
  if (params.actionType === 'update_campaign_bidding_strategy') return `Set campaign strategy${suffix}`;
  if (params.actionType === 'update_ad_group_state') return `Set ad group state${suffix}`;
  if (params.actionType === 'update_ad_group_default_bid') return `Set ad group default bid${suffix}`;
  if (params.actionType === 'update_target_bid') return `Set target bid${suffix}`;
  if (params.actionType === 'update_target_state') return `Set target state${suffix}`;
  if (params.actionType === 'update_placement_modifier') return `Set placement modifier${suffix}`;
  return `Update ${params.fieldLabel.toLowerCase()}${suffix}`;
};

const spPlacementKey = (campaignId: string, placementCode: string) =>
  `${campaignId}::${placementCode.trim().toLowerCase()}`;

const findSbPlacement = (
  current: FetchCurrentSbResult,
  action: Record<string, unknown>
): CurrentSbPlacement | null => {
  const campaignId = asString(action.campaign_id);
  if (!campaignId) return null;
  const rawNorm = asString(action.placement_raw) ? normalizeText(asString(action.placement_raw) as string) : null;
  const code = asString(action.placement_code)?.toUpperCase() ?? null;

  const matches = [...current.placementsByKey.values()].filter((placement) => {
    if (placement.campaign_id !== campaignId) return false;
    if (rawNorm && placement.placement_raw_norm !== rawNorm) return false;
    if (code && placement.placement_code !== code) return false;
    return true;
  });

  return matches.length === 1 ? matches[0] : null;
};

const buildLookupContext = async (proposalPlans: ExecutableBulkgenPlanV1[]) => {
  const warnings: string[] = [];

  const spActions = proposalPlans
    .filter((plan) => plan.channel === 'SP')
    .flatMap((plan) => plan.actions)
    .map((action) => ({
      type: asString(action.type) ?? '',
      campaign_id: asString(action.campaign_id) ?? undefined,
      target_id: asString(action.target_id) ?? undefined,
      ad_group_id: asString(action.ad_group_id) ?? undefined,
      placement_code: asString(action.placement_code) ?? undefined,
    }));

  const sbActions = proposalPlans
    .filter((plan) => plan.channel === 'SB')
    .flatMap((plan) => plan.actions)
    .map((action) => ({
      type: asString(action.type) ?? '',
      campaign_id: asString(action.campaign_id) ?? undefined,
      target_id: asString(action.target_id) ?? undefined,
      ad_group_id: asString(action.ad_group_id) ?? undefined,
      placement_raw: asString(action.placement_raw) ?? undefined,
      placement_code: asString(action.placement_code) ?? undefined,
    }));

  let spCurrent: FetchCurrentResult | null = null;
  let sbCurrent: FetchCurrentSbResult | null = null;

  if (spActions.length > 0) {
    try {
      spCurrent = await fetchCurrentSpData(spActions);
    } catch (error) {
      warnings.push(
        `Could not load current SP snapshot for review display: ${
          error instanceof Error ? error.message : 'unknown error'
        }`
      );
    }
  }

  if (sbActions.length > 0) {
    try {
      sbCurrent = await fetchCurrentSbData(sbActions);
    } catch (error) {
      warnings.push(
        `Could not load current SB snapshot for review display: ${
          error instanceof Error ? error.message : 'unknown error'
        }`
      );
    }
  }

  return { spCurrent, sbCurrent, warnings };
};

const coerceComparableValue = (value: string | number | null): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  return null;
};

const readWhyFromAction = (action: Record<string, unknown>): string | null => {
  const keys = ['why', 'reason', 'rationale', 'note'];
  for (const key of keys) {
    const value = asString(action[key]);
    if (value) return value;
  }
  return null;
};

export const buildReviewProposedChangesDisplay = async (params: BuildParams): Promise<BuildResult> => {
  const { spCurrent, sbCurrent, warnings } = await buildLookupContext(params.proposalPlans);

  const rows: ReviewProposedChangesDisplayRow[] = params.rankedActions.map((actionRef, index) => {
    const action = actionRef.action;
    const planNotes = params.proposalPlans[actionRef.plan_index]?.notes ?? null;
    const campaignId = asString(action.campaign_id);
    const adGroupId = asString(action.ad_group_id);
    const targetId = asString(action.target_id);
    const placementCode = asString(action.placement_code);
    const placementRaw = asString(action.placement_raw);

    let campaignName = NOT_FOUND;
    let adGroupName = NOT_FOUND;
    let targetDisplay = '—';
    let placementDisplay = '—';
    let previousValue: string | number | null = null;
    const snapshotDate = actionRef.channel === 'SP' ? spCurrent?.snapshotDate ?? null : sbCurrent?.snapshotDate ?? null;

    if (actionRef.channel === 'SP' && spCurrent) {
      const campaign = campaignId ? spCurrent.campaignsById.get(campaignId) : null;
      const adGroup = adGroupId ? spCurrent.adGroupsById.get(adGroupId) : null;
      const target = targetId ? spCurrent.targetsById.get(targetId) : null;
      campaignName = campaign?.campaign_name_raw ?? NOT_FOUND;
      adGroupName = adGroup?.ad_group_name_raw ?? (adGroupId ? NOT_FOUND : '—');
      if (target) {
        targetDisplay = `${target.expression_raw} [${target.match_type}]${target.is_negative ? ' (negative)' : ''}`;
      } else if (targetId) {
        targetDisplay = `${NOT_FOUND} (${targetId})`;
      }

      if (actionRef.action_type === 'update_campaign_budget') previousValue = campaign?.daily_budget ?? null;
      if (actionRef.action_type === 'update_campaign_state') previousValue = campaign?.state ?? null;
      if (actionRef.action_type === 'update_campaign_bidding_strategy') previousValue = campaign?.bidding_strategy ?? null;
      if (actionRef.action_type === 'update_ad_group_state') previousValue = adGroup?.state ?? null;
      if (actionRef.action_type === 'update_ad_group_default_bid') previousValue = adGroup?.default_bid ?? null;
      if (actionRef.action_type === 'update_target_bid') previousValue = target?.bid ?? null;
      if (actionRef.action_type === 'update_target_state') previousValue = target?.state ?? null;
      if (actionRef.action_type === 'update_placement_modifier') {
        const placement =
          campaignId && placementCode
            ? spCurrent.placementsByKey.get(spPlacementKey(campaignId, placementCode))
            : null;
        placementDisplay = placement?.placement_raw ?? placement?.placement_code ?? NOT_FOUND;
        previousValue = placement?.percentage ?? null;
      }
    }

    if (actionRef.channel === 'SB' && sbCurrent) {
      const campaign = campaignId ? sbCurrent.campaignsById.get(campaignId) : null;
      const adGroup = adGroupId ? sbCurrent.adGroupsById.get(adGroupId) : null;
      const target = targetId ? sbCurrent.targetsById.get(targetId) : null;
      campaignName = campaign?.campaign_name_raw ?? NOT_FOUND;
      adGroupName = adGroup?.ad_group_name_raw ?? (adGroupId ? NOT_FOUND : '—');
      if (target) {
        targetDisplay = `${target.expression_raw} [${target.match_type}]${target.is_negative ? ' (negative)' : ''}`;
      } else if (targetId) {
        targetDisplay = `${NOT_FOUND} (${targetId})`;
      }

      if (actionRef.action_type === 'update_campaign_budget') previousValue = campaign?.daily_budget ?? null;
      if (actionRef.action_type === 'update_campaign_state') previousValue = campaign?.state ?? null;
      if (actionRef.action_type === 'update_campaign_bidding_strategy') previousValue = campaign?.bidding_strategy ?? null;
      if (actionRef.action_type === 'update_ad_group_state') previousValue = adGroup?.state ?? null;
      if (actionRef.action_type === 'update_ad_group_default_bid') previousValue = adGroup?.default_bid ?? null;
      if (actionRef.action_type === 'update_target_bid') previousValue = target?.bid ?? null;
      if (actionRef.action_type === 'update_target_state') previousValue = target?.state ?? null;
      if (actionRef.action_type === 'update_placement_modifier') {
        const placement = findSbPlacement(sbCurrent, action);
        placementDisplay = placement?.placement_raw ?? placement?.placement_code ?? NOT_FOUND;
        previousValue = placement?.percentage ?? null;
      }
    }

    if (actionRef.action_type !== 'update_placement_modifier' && placementDisplay === '—') {
      placementDisplay = '—';
    } else if (actionRef.action_type === 'update_placement_modifier' && placementDisplay === '—') {
      placementDisplay = placementRaw ?? placementCode ?? NOT_FOUND;
    }

    const valueKey = valueKeyByActionType(actionRef.channel, actionRef.action_type);
    const currentValueRaw = valueKey ? action[valueKey] : null;
    const currentValue =
      typeof currentValueRaw === 'number' || typeof currentValueRaw === 'string'
        ? (currentValueRaw as string | number)
        : null;
    const previousNumeric = coerceComparableValue(previousValue);
    const currentNumeric = asFiniteNumber(currentValue);
    const delta =
      previousNumeric !== null && currentNumeric !== null ? currentNumeric - previousNumeric : null;
    const deltaPct =
      delta !== null && previousNumeric !== null && previousNumeric !== 0
        ? (delta / Math.abs(previousNumeric)) * 100
        : null;

    const explicitWhy = readWhyFromAction(action);
    const why = toOneSentence(
      explicitWhy ??
        planNotes ??
        heuristicWhy({
          objective: params.objective,
          actionType: actionRef.action_type,
          previousNumeric,
          currentNumeric,
        })
    );

    const fieldLabel = fieldLabelByActionType(actionRef.action_type);

    return {
      original_index: index,
      channel: actionRef.channel,
      run_id: actionRef.run_id,
      change_id: actionRef.change_id,
      action_type: actionRef.action_type,
      action_group: actionGroupFromType(actionRef.action_type),
      action_details: actionLabel({
        actionType: actionRef.action_type,
        fieldLabel,
        currentValue,
      }),
      field_label: fieldLabel,
      objective: asString(params.objective) ?? '—',
      campaign_name: campaignName,
      ad_group_name: adGroupName,
      target_display: targetDisplay,
      placement_display: placementDisplay,
      previous_value: previousValue,
      current_value: currentValue,
      delta,
      delta_pct: deltaPct,
      why,
      campaign_id: campaignId,
      ad_group_id: adGroupId,
      target_id: targetId,
      placement_code: placementCode,
      placement_raw: placementRaw,
      entity_ref: actionRef.entity_ref,
      summary: actionRef.summary,
      snapshot_date: snapshotDate,
      plan_notes: planNotes,
      raw_action: action,
      review_rank: actionRef.review_rank,
      numeric_field_key: actionRef.numeric_field_key,
      proposed_numeric_value: actionRef.proposed_numeric_value,
    };
  });

  return { rows, warnings };
};
