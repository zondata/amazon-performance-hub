'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { runSpUpdateGenerator } from '@/lib/bulksheets/runGenerators';
import { downloadTemplateToLocalPath } from '@/lib/bulksheets/templateStore';
import {
  createChangeSetItems,
  deleteChangeSetItem,
  getChangeSetItem,
  listChangeSetItems,
  updateChangeSetItem,
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
  buildSpDraftItemPatch,
  mapChangeSetItemsToSpUpdateActions,
} from '@/lib/ads-workspace/spDraftReview';
import {
  type SaveSpDraftActionState,
} from '@/lib/ads-workspace/spChangeComposerState';
import type { AdsChangeSet, AdsChangeSetStatus } from '@/lib/ads-workspace/types';
import { env } from '@/lib/env';
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

const parseReturnTo = (formData: FormData) => {
  const value = trimToNull(formData.get('return_to'));
  if (!value || !value.startsWith('/ads/performance')) {
    return '/ads/performance?panel=queue';
  }
  return value;
};

const redirectWithFlash = (returnTo: string, params: { notice?: string; error?: string }) => {
  const url = new URL(returnTo, 'http://localhost');
  url.searchParams.delete('queue_notice');
  url.searchParams.delete('queue_error');
  if (params.notice) {
    url.searchParams.set('queue_notice', params.notice);
  }
  if (params.error) {
    url.searchParams.set('queue_error', params.error);
  }
  redirect(`${url.pathname}?${url.searchParams.toString()}`);
};

const readChangeSetId = (formData: FormData) => {
  const changeSetId = trimToNull(formData.get('change_set_id'));
  if (!changeSetId) {
    throw new Error('change_set_id is required.');
  }
  return changeSetId;
};

const readItemId = (formData: FormData) => {
  const itemId = trimToNull(formData.get('item_id'));
  if (!itemId) {
    throw new Error('item_id is required.');
  }
  return itemId;
};

const requireChangeSet = async (changeSetId: string): Promise<AdsChangeSet> => {
  const changeSet = await getChangeSet(changeSetId);
  if (!changeSet) {
    throw new Error('Change set not found.');
  }
  return changeSet;
};

const ensureStatus = (changeSet: AdsChangeSet, allowed: AdsChangeSetStatus[]) => {
  if (!allowed.includes(changeSet.status)) {
    throw new Error(
      `Change set ${changeSet.name} is ${changeSet.status} and cannot perform this action.`
    );
  }
};

const parseOptionalExperimentId = (formData: FormData) => {
  const value = trimToNull(formData.get('experiment_id'));
  return value ?? null;
};

const parseOptionalNotes = (formData: FormData, fieldName: string) =>
  trimToNull(formData.get(fieldName));

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

export const saveQueueChangeSetMetaAction = async (formData: FormData) => {
  const returnTo = parseReturnTo(formData);

  try {
    const changeSetId = readChangeSetId(formData);
    const changeSet = await requireChangeSet(changeSetId);
    ensureStatus(changeSet, ['draft', 'review_ready']);

    const name = trimToNull(formData.get('change_set_name'));
    if (!name) {
      throw new Error('change_set_name is required.');
    }

    await updateChangeSet(changeSetId, {
      name,
      experiment_id: parseOptionalExperimentId(formData),
      notes: parseOptionalNotes(formData, 'change_set_notes'),
    });

    revalidatePath('/ads/performance');
    redirectWithFlash(returnTo, { notice: 'Change set details updated.' });
  } catch (error) {
    redirectWithFlash(returnTo, {
      error: error instanceof Error ? error.message : 'Failed to update change set.',
    });
  }
};

export const updateQueueChangeSetStatusAction = async (formData: FormData) => {
  const returnTo = parseReturnTo(formData);

  try {
    const changeSetId = readChangeSetId(formData);
    const targetStatus = trimToNull(formData.get('target_status'));
    if (
      targetStatus !== 'draft' &&
      targetStatus !== 'review_ready' &&
      targetStatus !== 'cancelled'
    ) {
      throw new Error('target_status must be draft, review_ready, or cancelled.');
    }

    const changeSet = await requireChangeSet(changeSetId);
    const items = await listChangeSetItems(changeSetId);

    if (targetStatus === 'review_ready') {
      ensureStatus(changeSet, ['draft']);
      if (items.length === 0) {
        throw new Error('A change set needs at least one staged item before review_ready.');
      }
    }
    if (targetStatus === 'draft') {
      ensureStatus(changeSet, ['review_ready']);
    }
    if (targetStatus === 'cancelled') {
      ensureStatus(changeSet, ['review_ready']);
    }

    await updateChangeSet(changeSetId, { status: targetStatus });

    revalidatePath('/ads/performance');
    redirectWithFlash(returnTo, {
      notice:
        targetStatus === 'review_ready'
          ? 'Change set marked review ready.'
          : targetStatus === 'draft'
            ? 'Change set moved back to draft.'
            : 'Change set cancelled.',
    });
  } catch (error) {
    redirectWithFlash(returnTo, {
      error: error instanceof Error ? error.message : 'Failed to update change set status.',
    });
  }
};

export const saveQueueItemAction = async (formData: FormData) => {
  const returnTo = parseReturnTo(formData);

  try {
    const itemId = readItemId(formData);
    const item = await getChangeSetItem(itemId);
    if (!item) {
      throw new Error('Change set item not found.');
    }

    const changeSet = await requireChangeSet(item.change_set_id);
    ensureStatus(changeSet, ['draft', 'review_ready']);

    const patch = buildSpDraftItemPatch({
      item,
      nextValueRaw: trimToNull(formData.get('next_value')),
      objective: trimToNull(formData.get('objective')),
      hypothesis: trimToNull(formData.get('hypothesis')),
      forecastSummary: trimToNull(formData.get('forecast_summary')),
      forecastWindowDays: trimToNull(formData.get('forecast_window_days')),
      reviewAfterDays: trimToNull(formData.get('review_after_days')),
      notes: trimToNull(formData.get('notes')),
    });

    await updateChangeSetItem(itemId, patch);

    revalidatePath('/ads/performance');
    redirectWithFlash(returnTo, { notice: 'Queue item updated.' });
  } catch (error) {
    redirectWithFlash(returnTo, {
      error: error instanceof Error ? error.message : 'Failed to update queue item.',
    });
  }
};

export const deleteQueueItemAction = async (formData: FormData) => {
  const returnTo = parseReturnTo(formData);

  try {
    const itemId = readItemId(formData);
    const item = await getChangeSetItem(itemId);
    if (!item) {
      throw new Error('Change set item not found.');
    }

    const changeSet = await requireChangeSet(item.change_set_id);
    ensureStatus(changeSet, ['draft', 'review_ready']);

    await deleteChangeSetItem(itemId);

    revalidatePath('/ads/performance');
    redirectWithFlash(returnTo, { notice: 'Queue item removed.' });
  } catch (error) {
    redirectWithFlash(returnTo, {
      error: error instanceof Error ? error.message : 'Failed to remove queue item.',
    });
  }
};

export const generateQueueChangeSetAction = async (formData: FormData) => {
  const returnTo = parseReturnTo(formData);

  try {
    if (!env.bulkgenOutRoot) {
      throw new Error('BULKGEN_OUT_ROOT is required before generating from Ads Workspace.');
    }
    if (!env.enableBulkgenSpawn) {
      throw new Error('ENABLE_BULKGEN_SPAWN=1 is required to generate from Ads Workspace.');
    }

    const changeSetId = readChangeSetId(formData);
    const changeSet = await requireChangeSet(changeSetId);
    ensureStatus(changeSet, ['review_ready']);

    if (changeSet.generated_run_id || changeSet.generated_artifact_json) {
      throw new Error('This change set has already been generated.');
    }

    const items = await listChangeSetItems(changeSetId);
    if (items.length === 0) {
      throw new Error('A change set needs staged items before generation.');
    }

    const actions = mapChangeSetItemsToSpUpdateActions(items);
    const templatePath = await downloadTemplateToLocalPath('sp_update');
    const runId = `adsws-sp-${changeSetId}-${Date.now()}`;
    const result = await runSpUpdateGenerator({
      templatePath,
      outRoot: env.bulkgenOutRoot,
      notes: changeSet.notes,
      runId,
      exportedAt: new Date().toISOString(),
      experimentId: changeSet.experiment_id ?? undefined,
      logEnabled: true,
      actions,
    });

    await updateChangeSet(changeSetId, {
      status: 'generated',
      generated_run_id: result.run_id,
      generated_artifact_json: {
        generator: 'bulkgen:sp:update',
        generated_at: new Date().toISOString(),
        action_count: actions.length,
        out_dir: result.out_dir,
        upload_strict_path: result.upload_strict_path ?? null,
        review_path: result.review_path,
        log_created: result.log_created ?? 0,
        log_skipped: result.log_skipped ?? 0,
        spawn_cwd: result.spawn_cwd ?? null,
      },
    });

    revalidatePath('/ads/performance');
    redirectWithFlash(returnTo, {
      notice: `Bulksheet generated and ${result.log_created ?? 0} logbook change(s) frozen.`,
    });
  } catch (error) {
    redirectWithFlash(returnTo, {
      error: error instanceof Error ? error.message : 'Failed to generate bulksheet.',
    });
  }
};
