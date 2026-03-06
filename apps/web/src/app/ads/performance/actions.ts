'use server';

import {
  createChangeSetItems,
  listChangeSetItems,
} from '@/lib/ads-workspace/repoChangeSetItems';
import {
  createChangeSet,
  getChangeSet,
  updateChangeSet,
} from '@/lib/ads-workspace/repoChangeSets';
import {
  createObjectivePreset,
  getObjectivePreset,
} from '@/lib/ads-workspace/repoObjectivePresets';
import {
  buildForecastJson,
  buildSpDraftMutationPlan,
  type SpChangeComposerContext,
} from '@/lib/ads-workspace/spChangeComposer';
import {
  type SaveSpDraftActionState,
} from '@/lib/ads-workspace/spChangeComposerState';
import type { JsonObject } from '@/lib/ads-workspace/types';

const trimToNull = (value: FormDataEntryValue | null) => {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseJsonObjectField = (formData: FormData, fieldName: string): JsonObject => {
  const raw = String(formData.get(fieldName) ?? '').trim();
  if (!raw) {
    throw new Error(`${fieldName} is required.`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${fieldName} must be valid JSON.`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${fieldName} must be a JSON object.`);
  }
  return parsed as JsonObject;
};

const parseComposerContext = (formData: FormData): SpChangeComposerContext => {
  const parsed = parseJsonObjectField(formData, 'composer_context_json');
  return parsed as unknown as SpChangeComposerContext;
};

const resolveReasoning = async (formData: FormData) => {
  const selectedPresetId = trimToNull(formData.get('objective_preset_id'));
  const selectedPreset = selectedPresetId ? await getObjectivePreset(selectedPresetId) : null;
  if (selectedPresetId && !selectedPreset) {
    throw new Error('Selected objective preset was not found.');
  }

  const manualObjective = trimToNull(formData.get('objective'));
  const manualHypothesis = trimToNull(formData.get('hypothesis'));
  const manualNotes = trimToNull(formData.get('notes'));
  const reviewAfterRaw = trimToNull(formData.get('review_after_days'));
  let reviewAfterDays = selectedPreset?.review_after_days ?? null;
  if (reviewAfterRaw !== null) {
    const parsedReviewAfterDays = Number(reviewAfterRaw);
    if (!Number.isInteger(parsedReviewAfterDays) || parsedReviewAfterDays < 0) {
      throw new Error('review_after_days must be a non-negative integer.');
    }
    reviewAfterDays = parsedReviewAfterDays;
  }

  const forecast = buildForecastJson({
    forecastSummary: trimToNull(formData.get('forecast_summary')),
    forecastWindowDays: trimToNull(formData.get('forecast_window_days')),
    baseForecastJson: selectedPreset?.forecast_json ?? null,
  });

  const objective = manualObjective ?? selectedPreset?.objective ?? null;
  if (!objective) {
    throw new Error('objective is required.');
  }

  const reasoning = {
    objective,
    hypothesis: manualHypothesis ?? selectedPreset?.hypothesis ?? null,
    forecast_json: forecast.forecast_json,
    forecast_window_days: forecast.forecast_window_days,
    review_after_days: reviewAfterDays,
    notes: manualNotes ?? selectedPreset?.notes ?? null,
    objective_preset_id: selectedPreset?.id ?? null,
  };

  const saveObjectivePreset = formData.get('save_objective_preset') === '1';
  if (!saveObjectivePreset) {
    return { reasoning, createdPreset: null as { id: string; name: string } | null };
  }

  const presetName = trimToNull(formData.get('objective_preset_name'));
  if (!presetName) {
    throw new Error('objective_preset_name is required when saving a preset.');
  }

  const createdPreset = await createObjectivePreset({
    channel: 'sp',
    name: presetName,
    objective: reasoning.objective,
    hypothesis: reasoning.hypothesis,
    forecast_json: reasoning.forecast_json,
    review_after_days: reasoning.review_after_days,
    notes: reasoning.notes,
  });

  return {
    reasoning: {
      ...reasoning,
      objective_preset_id: createdPreset.id,
    },
    createdPreset: { id: createdPreset.id, name: createdPreset.name },
  };
};

export const saveSpDraftAction = async (
  _prevState: SaveSpDraftActionState,
  formData: FormData
): Promise<SaveSpDraftActionState> => {
  try {
    const filters_json = parseJsonObjectField(formData, 'filters_json');
    const context = parseComposerContext(formData);
    const activeChangeSetId = trimToNull(formData.get('active_change_set_id'));
    const changeSetName = trimToNull(formData.get('change_set_name'));
    const { reasoning, createdPreset } = await resolveReasoning(formData);

    const plan = buildSpDraftMutationPlan({
      change_set_name: changeSetName,
      filters_json,
      context,
      reasoning,
      target_bid: trimToNull(formData.get('target_bid')),
      target_state: trimToNull(formData.get('target_state')),
      ad_group_default_bid: trimToNull(formData.get('ad_group_default_bid')),
      ad_group_state: trimToNull(formData.get('ad_group_state')),
      campaign_budget: trimToNull(formData.get('campaign_budget')),
      campaign_state: trimToNull(formData.get('campaign_state')),
      campaign_bidding_strategy: trimToNull(formData.get('campaign_bidding_strategy')),
      top_of_search_modifier_pct: trimToNull(formData.get('top_of_search_modifier_pct')),
    });

    let changeSetId = activeChangeSetId;
    let persistedChangeSetName = plan.changeSetPayload.name ?? changeSetName ?? 'SP draft';

    if (changeSetId) {
      const existing = await getChangeSet(changeSetId);
      if (!existing) {
        throw new Error('Active draft change set was not found.');
      }
      if (existing.status !== 'draft') {
        throw new Error('Only draft change sets can accept new staged actions.');
      }
      const updated = await updateChangeSet(changeSetId, plan.changeSetPayload);
      persistedChangeSetName = updated.name;
    } else {
      const created = await createChangeSet(plan.changeSetPayload);
      changeSetId = created.id;
      persistedChangeSetName = created.name;
    }

    await createChangeSetItems(changeSetId, plan.itemPayloads);
    const queueItems = await listChangeSetItems(changeSetId);

    return {
      ok: true,
      error: null,
      message: `${plan.itemPayloads.length} draft action(s) staged.`,
      changeSetId,
      changeSetName: persistedChangeSetName,
      queueCount: queueItems.length,
      createdItemCount: plan.itemPayloads.length,
      createdPreset,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to save draft actions.',
      message: null,
      changeSetId: null,
      changeSetName: null,
      queueCount: 0,
      createdItemCount: 0,
      createdPreset: null,
    };
  }
};
