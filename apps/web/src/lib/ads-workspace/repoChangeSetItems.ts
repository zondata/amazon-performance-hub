import 'server-only';

import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getChangeSet } from './repoChangeSets';
import {
  AdsChangeSetItem,
  AdsChangeSetItemRow,
  ChangeSetItemPayload,
  mapChangeSetItemRow,
} from './types';
import {
  validateCreateChangeSetItemPayload,
  validateUpdateChangeSetItemPayload,
} from './validation';

const CHANGE_SET_ITEM_SELECT = [
  'id',
  'change_set_id',
  'channel',
  'entity_level',
  'entity_key',
  'campaign_id',
  'ad_group_id',
  'target_id',
  'target_key',
  'placement_code',
  'action_type',
  'before_json',
  'after_json',
  'objective',
  'hypothesis',
  'forecast_json',
  'review_after_days',
  'notes',
  'objective_preset_id',
  'ui_context_json',
  'created_at',
  'updated_at',
].join(',');

type ItemScopeRow = {
  id: string;
  change_set_id: string;
};

const assertChangeSetScope = async (changeSetId: string) => {
  const changeSet = await getChangeSet(changeSetId);
  if (!changeSet) {
    throw new Error('Change set not found.');
  }
  return changeSet;
};

const assertObjectivePresetScope = async (presetId: string | null) => {
  if (!presetId) {
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('ads_objective_presets')
    .select('id')
    .eq('id', presetId)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load objective preset: ${error.message}`);
  }
  if (!data) {
    throw new Error('Objective preset not found.');
  }
};

const getScopedItem = async (itemId: string): Promise<ItemScopeRow> => {
  const { data, error } = await supabaseAdmin
    .from('ads_change_set_items')
    .select('id,change_set_id')
    .eq('id', itemId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load change set item: ${error.message}`);
  }
  if (!data) {
    throw new Error('Change set item not found.');
  }

  await assertChangeSetScope((data as unknown as ItemScopeRow).change_set_id);
  return data as unknown as ItemScopeRow;
};

export const getChangeSetItem = async (itemId: string): Promise<AdsChangeSetItem | null> => {
  const scopedItem = await getScopedItem(itemId);

  const { data, error } = await supabaseAdmin
    .from('ads_change_set_items')
    .select(CHANGE_SET_ITEM_SELECT)
    .eq('id', scopedItem.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load change set item: ${error.message}`);
  }

  return data ? mapChangeSetItemRow(data as unknown as AdsChangeSetItemRow) : null;
};

export const createChangeSetItems = async (
  changeSetId: string,
  payloads: ChangeSetItemPayload[]
): Promise<AdsChangeSetItem[]> => {
  await assertChangeSetScope(changeSetId);
  if (!Array.isArray(payloads) || payloads.length === 0) {
    throw new Error('At least one change set item is required.');
  }

  const errors: string[] = [];
  const inserts = [];
  for (const [index, payload] of payloads.entries()) {
    const result = validateCreateChangeSetItemPayload(payload);
    if (result.errors.length > 0) {
      errors.push(`item ${index + 1}: ${result.errors.join(', ')}`);
      continue;
    }

    await assertObjectivePresetScope(result.value.objective_preset_id);
    inserts.push({
      change_set_id: changeSetId,
      channel: result.value.channel,
      entity_level: result.value.entity_level,
      entity_key: result.value.entity_key,
      campaign_id: result.value.campaign_id,
      ad_group_id: result.value.ad_group_id,
      target_id: result.value.target_id,
      target_key: result.value.target_key,
      placement_code: result.value.placement_code,
      action_type: result.value.action_type,
      before_json: result.value.before_json,
      after_json: result.value.after_json,
      objective: result.value.objective,
      hypothesis: result.value.hypothesis,
      forecast_json: result.value.forecast_json,
      review_after_days: result.value.review_after_days,
      notes: result.value.notes,
      objective_preset_id: result.value.objective_preset_id,
      ui_context_json: result.value.ui_context_json,
    });
  }

  if (errors.length > 0) {
    throw new Error(`Change set item validation failed: ${errors.join('; ')}`);
  }

  const { data, error } = await supabaseAdmin
    .from('ads_change_set_items')
    .insert(inserts)
    .select(CHANGE_SET_ITEM_SELECT);

  if (error) {
    throw new Error(`Failed to create change set items: ${error.message}`);
  }

  return ((data ?? []) as unknown as AdsChangeSetItemRow[]).map(mapChangeSetItemRow);
};

export const updateChangeSetItem = async (
  itemId: string,
  payload: ChangeSetItemPayload
): Promise<AdsChangeSetItem> => {
  await getScopedItem(itemId);

  const { value, errors } = validateUpdateChangeSetItemPayload(payload);
  if (errors.length > 0) {
    throw new Error(`Change set item validation failed: ${errors.join(', ')}`);
  }

  await assertObjectivePresetScope(value.objective_preset_id ?? null);

  const { data, error } = await supabaseAdmin
    .from('ads_change_set_items')
    .update({
      ...value,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .select(CHANGE_SET_ITEM_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update change set item: ${error.message}`);
  }
  if (!data) {
    throw new Error('Change set item not found.');
  }

  return mapChangeSetItemRow(data as unknown as AdsChangeSetItemRow);
};

export const deleteChangeSetItem = async (itemId: string): Promise<void> => {
  await getScopedItem(itemId);

  const { error } = await supabaseAdmin
    .from('ads_change_set_items')
    .delete()
    .eq('id', itemId);

  if (error) {
    throw new Error(`Failed to delete change set item: ${error.message}`);
  }
};

export const listChangeSetItems = async (changeSetId: string): Promise<AdsChangeSetItem[]> => {
  await assertChangeSetScope(changeSetId);

  const { data, error } = await supabaseAdmin
    .from('ads_change_set_items')
    .select(CHANGE_SET_ITEM_SELECT)
    .eq('change_set_id', changeSetId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to list change set items: ${error.message}`);
  }

  return ((data ?? []) as unknown as AdsChangeSetItemRow[]).map(mapChangeSetItemRow);
};
