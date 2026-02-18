import 'server-only';

import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type LogChangeInput = {
  occurred_at?: string;
  channel: string;
  change_type: string;
  summary: string;
  why?: string;
  before_json?: unknown;
  after_json?: unknown;
  source?: string;
  source_upload_id?: string;
  entities: {
    entity_type: string;
    product_id?: string;
    campaign_id?: string;
    ad_group_id?: string;
    target_id?: string;
    keyword_id?: string;
    note?: string;
    extra?: unknown;
  }[];
};

export type BulkgenLogEntry = {
  dedupeKey: string;
  change: LogChangeInput;
};

export const writeBulkgenLogs = async (params: {
  accountId: string;
  marketplace: string;
  entries: BulkgenLogEntry[];
  experimentId?: string;
}): Promise<{ created: number; skipped: number }> => {
  let created = 0;
  const skipped = 0;

  for (const entry of params.entries) {
    const payload: Record<string, unknown> = {
      account_id: params.accountId,
      marketplace: params.marketplace,
      channel: entry.change.channel,
      change_type: entry.change.change_type,
      summary: entry.change.summary,
      why: entry.change.why ?? null,
      before_json: entry.change.before_json ?? null,
      after_json: entry.change.after_json ?? null,
      source: entry.change.source ?? 'bulkgen',
      source_upload_id: entry.change.source_upload_id ?? null,
    };

    if (entry.change.occurred_at) {
      payload.occurred_at = entry.change.occurred_at;
    }

    const { data, error } = await supabaseAdmin
      .from('log_changes')
      .insert(payload)
      .select('change_id')
      .single();

    if (error || !data) {
      throw new Error(`Failed to insert log_changes: ${error?.message ?? 'unknown error'}`);
    }

    const changeId = data.change_id as string;
    created += 1;

    const entities = entry.change.entities ?? [];
    if (entities.length > 0) {
      const rows = entities.map((entity) => ({
        change_id: changeId,
        entity_type: entity.entity_type,
        product_id: entity.product_id ?? null,
        campaign_id: entity.campaign_id ?? null,
        ad_group_id: entity.ad_group_id ?? null,
        target_id: entity.target_id ?? null,
        keyword_id: entity.keyword_id ?? null,
        note: entity.note ?? null,
        extra: entity.extra ?? null,
      }));

      const { error: entityError } = await supabaseAdmin
        .from('log_change_entities')
        .insert(rows);

      if (entityError) {
        throw new Error(`Failed to insert log_change_entities: ${entityError.message}`);
      }
    }

    if (params.experimentId) {
      const { error: linkError } = await supabaseAdmin
        .from('log_experiment_changes')
        .upsert(
          {
            experiment_id: params.experimentId,
            change_id: changeId,
          },
          { onConflict: 'experiment_id,change_id', ignoreDuplicates: true }
        );

      if (linkError) {
        throw new Error(`Failed to link experiment: ${linkError.message}`);
      }
    }
  }

  return { created, skipped };
};
