import type { ChangeSetItemPayload, ChangeSetPayload, JsonObject } from './types';

const ALLOWED_STATES = new Set(['enabled', 'paused', 'archived']);
const WORKSPACE_SURFACE = 'ads_workspace';

export type SpComposerTargetContext = {
  id: string;
  text: string;
  match_type: string | null;
  is_negative: boolean;
  current_state: string | null;
  current_bid: number | null;
};

export type SpComposerAdGroupContext = {
  id: string;
  name: string | null;
  current_state: string | null;
  current_default_bid: number | null;
};

export type SpComposerCampaignContext = {
  id: string;
  name: string | null;
  current_state: string | null;
  current_budget: number | null;
  current_bidding_strategy: string | null;
};

export type SpComposerPlacementContext = {
  placement_code: string;
  label: string;
  current_percentage: number | null;
};

export type SpChangeComposerContext = {
  channel: 'sp';
  surface: 'targets' | 'campaigns' | 'adgroups' | 'placements' | 'searchterms';
  target: SpComposerTargetContext | null;
  ad_group: SpComposerAdGroupContext | null;
  campaign: SpComposerCampaignContext;
  placement: SpComposerPlacementContext | null;
  placements?: SpComposerPlacementContext[] | null;
  coverage_note: string | null;
};

export type ResolvedSpComposerReasoning = {
  objective: string;
  hypothesis: string | null;
  forecast_json: JsonObject | null;
  forecast_window_days: number | null;
  review_after_days: number | null;
  notes: string | null;
  objective_preset_id: string | null;
};

export type BuildSpDraftMutationPlanInput = {
  change_set_name: string | null;
  filters_json: JsonObject;
  context: SpChangeComposerContext;
  reasoning: ResolvedSpComposerReasoning;
  target_bid?: string | number | null;
  target_state?: string | null;
  ad_group_default_bid?: string | number | null;
  ad_group_state?: string | null;
  campaign_budget?: string | number | null;
  campaign_state?: string | null;
  campaign_bidding_strategy?: string | null;
  placement_modifier_pct?: string | number | null;
  placement_modifier_updates?: Array<{
    placement_code: string | null | undefined;
    percentage: string | number | null | undefined;
  }>;
};

export type BuildSpDraftMutationPlanResult = {
  changeSetPayload: ChangeSetPayload;
  itemPayloads: ChangeSetItemPayload[];
};

const trimToNull = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseNonNegativeNumber = (value: string | number | null | undefined, fieldName: string) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(String(value));
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative number.`);
  }
  return parsed;
};

const parseNullableInteger = (value: string | number | null | undefined, fieldName: string) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(String(value));
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative integer.`);
  }
  return parsed;
};

const normalizeState = (value: string | null | undefined, fieldName: string) => {
  const trimmed = trimToNull(value);
  if (!trimmed) return null;
  const normalized = trimmed.toLowerCase();
  if (!ALLOWED_STATES.has(normalized)) {
    throw new Error(`${fieldName} must be one of: enabled, paused, archived.`);
  }
  return normalized;
};

const normalizeStrategy = (value: string | null | undefined) => trimToNull(value);

const normalizePlacementCode = (value: string | null | undefined) => trimToNull(value)?.toUpperCase() ?? null;

const sameNumber = (left: number | null, right: number | null) => {
  if (left === null || right === null) return left === right;
  return Math.abs(left - right) < 0.000001;
};

const sameString = (left: string | null, right: string | null) => {
  if (left === null || right === null) return left === right;
  return left.trim().toLowerCase() === right.trim().toLowerCase();
};

const defaultChangeSetName = () => {
  const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  return `SP draft ${timestamp}`;
};

export const buildForecastJson = (params: {
  forecastSummary?: string | null;
  forecastWindowDays?: string | number | null;
  baseForecastJson?: JsonObject | null;
}): { forecast_json: JsonObject | null; forecast_window_days: number | null } => {
  const forecastSummary = trimToNull(params.forecastSummary);
  const forecastWindowDays = parseNullableInteger(
    params.forecastWindowDays,
    'forecast_window_days'
  );
  const baseForecastJson = params.baseForecastJson ?? null;
  const nextForecastJson: JsonObject | null =
    forecastSummary || forecastWindowDays !== null
      ? {
          ...(baseForecastJson ?? {}),
          ...(forecastSummary ? { summary: forecastSummary } : {}),
          ...(forecastWindowDays !== null ? { window_days: forecastWindowDays } : {}),
        }
      : baseForecastJson;

  return {
    forecast_json: nextForecastJson,
    forecast_window_days:
      forecastWindowDays ??
      (typeof baseForecastJson?.window_days === 'number' && Number.isInteger(baseForecastJson.window_days)
        ? (baseForecastJson.window_days as number)
        : null),
  };
};

const buildUiContextJson = (context: SpChangeComposerContext): JsonObject => ({
  surface: WORKSPACE_SURFACE,
  row_surface: context.surface,
  campaign_name: context.campaign.name,
  ad_group_name: context.ad_group?.name ?? null,
  target_text: context.target?.text ?? null,
  match_type: context.target?.match_type ?? null,
  placement_label: context.placement?.label ?? null,
  placement_modifier_pct: context.placement?.current_percentage ?? null,
  editable_placement_codes:
    context.placements?.map((placement) => placement.placement_code) ??
    (context.placement ? [context.placement.placement_code] : []),
  coverage_note: context.coverage_note,
});

const buildReasoningFields = (reasoning: ResolvedSpComposerReasoning) => ({
  objective: reasoning.objective,
  hypothesis: reasoning.hypothesis,
  forecast_json: reasoning.forecast_json,
  review_after_days: reasoning.review_after_days,
  notes: reasoning.notes,
  objective_preset_id: reasoning.objective_preset_id,
});

const resolvePlacementContexts = (context: SpChangeComposerContext) => {
  const byCode = new Map<string, SpComposerPlacementContext>();
  for (const placement of context.placements ?? []) {
    const code = normalizePlacementCode(placement.placement_code);
    if (!code || byCode.has(code)) continue;
    byCode.set(code, {
      ...placement,
      placement_code: code,
    });
  }
  if (context.placement) {
    const code = normalizePlacementCode(context.placement.placement_code);
    if (code && !byCode.has(code)) {
      byCode.set(code, {
        ...context.placement,
        placement_code: code,
      });
    }
  }
  return byCode;
};

export const buildSpDraftMutationPlan = (
  input: BuildSpDraftMutationPlanInput
): BuildSpDraftMutationPlanResult => {
  const objective = trimToNull(input.reasoning.objective);
  if (!objective) {
    throw new Error('objective is required.');
  }

  const changeSetPayload: ChangeSetPayload = {
    name: trimToNull(input.change_set_name) ?? defaultChangeSetName(),
    status: 'draft',
    objective,
    hypothesis: input.reasoning.hypothesis,
    forecast_window_days: input.reasoning.forecast_window_days,
    review_after_days: input.reasoning.review_after_days,
    notes: input.reasoning.notes,
    filters_json: input.filters_json,
  };

  const itemPayloads: ChangeSetItemPayload[] = [];
  const ui_context_json = buildUiContextJson(input.context);
  const reasoningFields = buildReasoningFields({
    ...input.reasoning,
    objective,
  });

  const nextTargetBid = parseNonNegativeNumber(input.target_bid, 'target_bid');
  if (nextTargetBid !== null) {
    if (!input.context.target) {
      throw new Error('This row does not support target bid edits.');
    }
    if (input.context.target.is_negative) {
      throw new Error('Negative targets cannot stage update_target_bid actions.');
    }
    if (!sameNumber(input.context.target.current_bid, nextTargetBid)) {
      itemPayloads.push({
        channel: 'sp',
        entity_level: 'target',
        entity_key: input.context.target.id,
        campaign_id: input.context.campaign.id,
        ad_group_id: input.context.ad_group?.id ?? null,
        target_id: input.context.target.id,
        target_key: null,
        placement_code: null,
        action_type: 'update_target_bid',
        before_json: { bid: input.context.target.current_bid },
        after_json: { bid: nextTargetBid },
        ui_context_json,
        ...reasoningFields,
      });
    }
  }

  const nextTargetState = normalizeState(input.target_state, 'target_state');
  if (nextTargetState !== null) {
    if (!input.context.target) {
      throw new Error('This row does not support target state edits.');
    }
    if (!sameString(input.context.target.current_state, nextTargetState)) {
      itemPayloads.push({
        channel: 'sp',
        entity_level: 'target',
        entity_key: input.context.target.id,
        campaign_id: input.context.campaign.id,
        ad_group_id: input.context.ad_group?.id ?? null,
        target_id: input.context.target.id,
        target_key: null,
        placement_code: null,
        action_type: 'update_target_state',
        before_json: { state: input.context.target.current_state },
        after_json: { state: nextTargetState },
        ui_context_json,
        ...reasoningFields,
      });
    }
  }

  const adGroup = input.context.ad_group;
  const nextAdGroupBid = parseNonNegativeNumber(
    input.ad_group_default_bid,
    'ad_group_default_bid'
  );
  if (nextAdGroupBid !== null) {
    if (!adGroup) {
      throw new Error('This row does not support ad group bid edits.');
    }
    if (!sameNumber(adGroup.current_default_bid, nextAdGroupBid)) {
      itemPayloads.push({
        channel: 'sp',
        entity_level: 'ad_group',
        entity_key: adGroup.id,
        campaign_id: input.context.campaign.id,
        ad_group_id: adGroup.id,
        target_id: null,
        target_key: null,
        placement_code: null,
        action_type: 'update_ad_group_default_bid',
        before_json: { default_bid: adGroup.current_default_bid },
        after_json: { default_bid: nextAdGroupBid },
        ui_context_json,
        ...reasoningFields,
      });
    }
  }

  const nextAdGroupState = normalizeState(input.ad_group_state, 'ad_group_state');
  if (nextAdGroupState !== null) {
    if (!adGroup) {
      throw new Error('This row does not support ad group state edits.');
    }
    if (!sameString(adGroup.current_state, nextAdGroupState)) {
      itemPayloads.push({
        channel: 'sp',
        entity_level: 'ad_group',
        entity_key: adGroup.id,
        campaign_id: input.context.campaign.id,
        ad_group_id: adGroup.id,
        target_id: null,
        target_key: null,
        placement_code: null,
        action_type: 'update_ad_group_state',
        before_json: { state: adGroup.current_state },
        after_json: { state: nextAdGroupState },
        ui_context_json,
        ...reasoningFields,
      });
    }
  }

  const nextCampaignBudget = parseNonNegativeNumber(input.campaign_budget, 'campaign_budget');
  if (
    nextCampaignBudget !== null &&
    !sameNumber(input.context.campaign.current_budget, nextCampaignBudget)
  ) {
    itemPayloads.push({
      channel: 'sp',
      entity_level: 'campaign',
      entity_key: input.context.campaign.id,
      campaign_id: input.context.campaign.id,
      ad_group_id: null,
      target_id: null,
      target_key: null,
      placement_code: null,
      action_type: 'update_campaign_budget',
      before_json: { daily_budget: input.context.campaign.current_budget },
      after_json: { daily_budget: nextCampaignBudget },
      ui_context_json,
      ...reasoningFields,
    });
  }

  const nextCampaignState = normalizeState(input.campaign_state, 'campaign_state');
  if (
    nextCampaignState !== null &&
    !sameString(input.context.campaign.current_state, nextCampaignState)
  ) {
    itemPayloads.push({
      channel: 'sp',
      entity_level: 'campaign',
      entity_key: input.context.campaign.id,
      campaign_id: input.context.campaign.id,
      ad_group_id: null,
      target_id: null,
      target_key: null,
      placement_code: null,
      action_type: 'update_campaign_state',
      before_json: { state: input.context.campaign.current_state },
      after_json: { state: nextCampaignState },
      ui_context_json,
      ...reasoningFields,
    });
  }

  const nextCampaignStrategy = normalizeStrategy(input.campaign_bidding_strategy);
  if (
    nextCampaignStrategy !== null &&
    !sameString(input.context.campaign.current_bidding_strategy, nextCampaignStrategy)
  ) {
    itemPayloads.push({
      channel: 'sp',
      entity_level: 'campaign',
      entity_key: input.context.campaign.id,
      campaign_id: input.context.campaign.id,
      ad_group_id: null,
      target_id: null,
      target_key: null,
      placement_code: null,
      action_type: 'update_campaign_bidding_strategy',
      before_json: { bidding_strategy: input.context.campaign.current_bidding_strategy },
      after_json: { bidding_strategy: nextCampaignStrategy },
      ui_context_json,
      ...reasoningFields,
    });
  }

  const placementUpdates =
    input.placement_modifier_updates && input.placement_modifier_updates.length > 0
      ? input.placement_modifier_updates
      : input.context.placement
        ? [
            {
              placement_code: input.context.placement.placement_code,
              percentage: input.placement_modifier_pct,
            },
          ]
        : [];
  if (placementUpdates.length > 0) {
    const placementContexts = resolvePlacementContexts(input.context);
    if (placementContexts.size === 0) {
      throw new Error('This row does not support placement modifier edits.');
    }

    for (const update of placementUpdates) {
      const placementCode = normalizePlacementCode(update.placement_code);
      if (!placementCode) continue;
      const nextPlacementPct = parseNonNegativeNumber(
        update.percentage,
        `placement_modifier_pct:${placementCode}`
      );
      if (nextPlacementPct === null) continue;

      const placementContext = placementContexts.get(placementCode);
      if (!placementContext) {
        throw new Error(`This row does not support placement modifier edits for ${placementCode}.`);
      }
      if (sameNumber(placementContext.current_percentage, nextPlacementPct)) {
        continue;
      }

      itemPayloads.push({
        channel: 'sp',
        entity_level: 'placement',
        entity_key: `${input.context.campaign.id}::${placementContext.placement_code}`,
        campaign_id: input.context.campaign.id,
        ad_group_id: null,
        target_id: null,
        target_key: null,
        placement_code: placementContext.placement_code,
        action_type: 'update_placement_modifier',
        before_json: {
          placement_code: placementContext.placement_code,
          percentage: placementContext.current_percentage,
        },
        after_json: {
          placement_code: placementContext.placement_code,
          percentage: nextPlacementPct,
        },
        ui_context_json: {
          ...ui_context_json,
          placement_scope:
            input.context.surface === 'placements' ? 'placement_row' : 'campaign_context',
          placement_label: placementContext.label,
        },
        ...reasoningFields,
      });
    }
  }

  if (itemPayloads.length === 0) {
    throw new Error('No draft changes were staged. Change at least one editable field before saving.');
  }

  return {
    changeSetPayload,
    itemPayloads,
  };
};
