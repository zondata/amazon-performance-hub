import 'server-only';

import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  AdsObjectivePreset,
  AdsObjectivePresetRow,
  ListObjectivePresetsOptions,
  ObjectivePresetPayload,
  mapObjectivePresetRow,
} from './types';
import {
  validateCreateObjectivePresetPayload,
  validateUpdateObjectivePresetPayload,
} from './validation';

const OBJECTIVE_PRESET_SELECT = [
  'id',
  'account_id',
  'marketplace',
  'channel',
  'name',
  'objective',
  'hypothesis',
  'forecast_json',
  'review_after_days',
  'notes',
  'is_archived',
  'created_at',
  'updated_at',
].join(',');

const DEFAULT_LIST_LIMIT = 100;

const validateListLimit = (limit: number | undefined): number => {
  if (limit === undefined) {
    return DEFAULT_LIST_LIMIT;
  }
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error('limit must be a positive integer');
  }
  return limit;
};

const getObjectivePresetById = async (presetId: string): Promise<AdsObjectivePreset | null> => {
  const { data, error } = await supabaseAdmin
    .from('ads_objective_presets')
    .select(OBJECTIVE_PRESET_SELECT)
    .eq('id', presetId)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load objective preset: ${error.message}`);
  }

  return data ? mapObjectivePresetRow(data as unknown as AdsObjectivePresetRow) : null;
};

export const createObjectivePreset = async (
  payload: ObjectivePresetPayload
): Promise<AdsObjectivePreset> => {
  const { value, errors } = validateCreateObjectivePresetPayload(payload);
  if (errors.length > 0) {
    throw new Error(`Objective preset validation failed: ${errors.join(', ')}`);
  }

  const { data, error } = await supabaseAdmin
    .from('ads_objective_presets')
    .insert({
      account_id: env.accountId,
      marketplace: env.marketplace,
      channel: value.channel,
      name: value.name,
      objective: value.objective,
      hypothesis: value.hypothesis,
      forecast_json: value.forecast_json,
      review_after_days: value.review_after_days,
      notes: value.notes,
    })
    .select(OBJECTIVE_PRESET_SELECT)
    .single();

  if (error || !data) {
    throw new Error(`Failed to create objective preset: ${error?.message ?? 'unknown error'}`);
  }

  return mapObjectivePresetRow(data as unknown as AdsObjectivePresetRow);
};

export const updateObjectivePreset = async (
  presetId: string,
  payload: ObjectivePresetPayload
): Promise<AdsObjectivePreset> => {
  const { value, errors } = validateUpdateObjectivePresetPayload(payload);
  if (errors.length > 0) {
    throw new Error(`Objective preset validation failed: ${errors.join(', ')}`);
  }

  const { data, error } = await supabaseAdmin
    .from('ads_objective_presets')
    .update({
      ...value,
      updated_at: new Date().toISOString(),
    })
    .eq('id', presetId)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .select(OBJECTIVE_PRESET_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update objective preset: ${error.message}`);
  }
  if (!data) {
    throw new Error('Objective preset not found.');
  }

  return mapObjectivePresetRow(data as unknown as AdsObjectivePresetRow);
};

export const archiveObjectivePreset = async (presetId: string): Promise<AdsObjectivePreset> => {
  const existing = await getObjectivePresetById(presetId);
  if (!existing) {
    throw new Error('Objective preset not found.');
  }

  const { data, error } = await supabaseAdmin
    .from('ads_objective_presets')
    .update({
      is_archived: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', presetId)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .select(OBJECTIVE_PRESET_SELECT)
    .single();

  if (error || !data) {
    throw new Error(`Failed to archive objective preset: ${error?.message ?? 'unknown error'}`);
  }

  return mapObjectivePresetRow(data as unknown as AdsObjectivePresetRow);
};

export const listObjectivePresets = async (
  options: ListObjectivePresetsOptions = {}
): Promise<AdsObjectivePreset[]> => {
  const limit = validateListLimit(options.limit);
  let query = supabaseAdmin
    .from('ads_objective_presets')
    .select(OBJECTIVE_PRESET_SELECT)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .order('updated_at', { ascending: false })
    .range(0, limit - 1);

  if (options.channel === null) {
    query = query.is('channel', null);
  } else if (options.channel) {
    query = query.eq('channel', options.channel);
  }

  if (!options.includeArchived) {
    query = query.eq('is_archived', false);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list objective presets: ${error.message}`);
  }

  return ((data ?? []) as unknown as AdsObjectivePresetRow[]).map(mapObjectivePresetRow);
};
