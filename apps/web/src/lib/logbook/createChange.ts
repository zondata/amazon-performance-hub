'use server';

import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ChangeFormPayload, validateChangePayload } from './validation';

export const createChange = async (payload: ChangeFormPayload) => {
  const { value, errors } = validateChangePayload(payload);
  if (errors.length) {
    throw new Error(`Change validation failed: ${errors.join(', ')}`);
  }

  const occurred_at = value.occurred_at ?? new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('log_changes')
    .insert({
      account_id: env.accountId,
      marketplace: env.marketplace,
      occurred_at,
      channel: value.channel,
      change_type: value.change_type,
      summary: value.summary,
      why: value.why,
      before_json: value.before_json,
      after_json: value.after_json,
      source: value.source ?? 'manual',
    })
    .select('change_id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create change: ${error?.message ?? 'unknown error'}`);
  }

  const changeId = data.change_id as string;

  const entityRows = (value.entities ?? [])
    .filter((entity) => entity.entity_type)
    .map((entity) => ({
      change_id: changeId,
      entity_type: entity.entity_type,
      product_id: entity.product_id ?? null,
      campaign_id: entity.campaign_id ?? null,
      ad_group_id: entity.ad_group_id ?? null,
      target_id: entity.target_id ?? null,
      keyword_id: entity.keyword_id ?? null,
      note: entity.note ?? null,
      extra: null,
    }));

  if (entityRows.length > 0) {
    const { error: entityError } = await supabaseAdmin
      .from('log_change_entities')
      .insert(entityRows);

    if (entityError) {
      throw new Error(`Failed to create change entities: ${entityError.message}`);
    }
  }

  return changeId;
};
