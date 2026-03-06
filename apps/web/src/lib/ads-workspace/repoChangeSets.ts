import 'server-only';

import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  AdsChangeSet,
  AdsChangeSetRow,
  ChangeSetPayload,
  ListChangeSetsOptions,
  mapChangeSetRow,
} from './types';
import {
  validateCreateChangeSetPayload,
  validateUpdateChangeSetPayload,
} from './validation';

const CHANGE_SET_SELECT = [
  'id',
  'account_id',
  'marketplace',
  'experiment_id',
  'name',
  'status',
  'objective',
  'hypothesis',
  'forecast_window_days',
  'review_after_days',
  'notes',
  'filters_json',
  'generated_run_id',
  'generated_artifact_json',
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

export const createChangeSet = async (payload: ChangeSetPayload): Promise<AdsChangeSet> => {
  const { value, errors } = validateCreateChangeSetPayload(payload);
  if (errors.length > 0) {
    throw new Error(`Change set validation failed: ${errors.join(', ')}`);
  }

  const { data, error } = await supabaseAdmin
    .from('ads_change_sets')
    .insert({
      account_id: env.accountId,
      marketplace: env.marketplace,
      experiment_id: value.experiment_id,
      name: value.name,
      status: value.status,
      objective: value.objective,
      hypothesis: value.hypothesis,
      forecast_window_days: value.forecast_window_days,
      review_after_days: value.review_after_days,
      notes: value.notes,
      filters_json: value.filters_json,
      generated_run_id: value.generated_run_id,
      generated_artifact_json: value.generated_artifact_json,
    })
    .select(CHANGE_SET_SELECT)
    .single();

  if (error || !data) {
    throw new Error(`Failed to create change set: ${error?.message ?? 'unknown error'}`);
  }

  return mapChangeSetRow(data as unknown as AdsChangeSetRow);
};

export const updateChangeSet = async (
  changeSetId: string,
  payload: ChangeSetPayload
): Promise<AdsChangeSet> => {
  const { value, errors } = validateUpdateChangeSetPayload(payload);
  if (errors.length > 0) {
    throw new Error(`Change set validation failed: ${errors.join(', ')}`);
  }

  const { data, error } = await supabaseAdmin
    .from('ads_change_sets')
    .update({
      ...value,
      updated_at: new Date().toISOString(),
    })
    .eq('id', changeSetId)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .select(CHANGE_SET_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update change set: ${error.message}`);
  }
  if (!data) {
    throw new Error('Change set not found.');
  }

  return mapChangeSetRow(data as unknown as AdsChangeSetRow);
};

export const getChangeSet = async (changeSetId: string): Promise<AdsChangeSet | null> => {
  const { data, error } = await supabaseAdmin
    .from('ads_change_sets')
    .select(CHANGE_SET_SELECT)
    .eq('id', changeSetId)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load change set: ${error.message}`);
  }

  return data ? mapChangeSetRow(data as unknown as AdsChangeSetRow) : null;
};

export const listChangeSets = async (
  options: ListChangeSetsOptions = {}
): Promise<AdsChangeSet[]> => {
  const limit = validateListLimit(options.limit);
  let query = supabaseAdmin
    .from('ads_change_sets')
    .select(CHANGE_SET_SELECT)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .order('updated_at', { ascending: false })
    .range(0, limit - 1);

  if (Array.isArray(options.status)) {
    if (options.status.length > 0) {
      query = query.in('status', options.status);
    }
  } else if (options.status) {
    query = query.eq('status', options.status);
  }

  if (options.experiment_id) {
    query = query.eq('experiment_id', options.experiment_id);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list change sets: ${error.message}`);
  }

  return ((data ?? []) as unknown as AdsChangeSetRow[]).map(mapChangeSetRow);
};
