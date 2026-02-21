'use server';

import 'server-only';

import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  LogbookAiPackEntity,
  ParsedLogbookAiPack,
  parseLogbookAiPack,
} from './parseLogbookAiPack';

type ImportLogbookAiPackInput = {
  fileText: string;
  currentAsin: string;
};

export type ImportLogbookAiPackResult = {
  ok: boolean;
  created_experiment_id?: string;
  upserted_change_ids_count: number;
  created_evaluation_id?: string;
  error?: string;
};

type ExistingExperimentRow = {
  experiment_id: string;
  scope: Record<string, unknown> | null;
};

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const normalizeAsin = (value: string) => value.trim().toUpperCase();

const dedupeEntityRows = (entities: LogbookAiPackEntity[]) => {
  const seen = new Set<string>();
  const rows: LogbookAiPackEntity[] = [];

  for (const entity of entities) {
    const signature = [
      entity.entity_type,
      entity.product_id ?? '',
      entity.campaign_id ?? '',
      entity.ad_group_id ?? '',
      entity.target_id ?? '',
      entity.keyword_id ?? '',
      entity.note ?? '',
      entity.extra ? JSON.stringify(entity.extra) : '',
    ].join('|');

    if (seen.has(signature)) continue;
    seen.add(signature);
    rows.push(entity);
  }

  return rows;
};

const resolveExperimentByDedupeKey = async (
  dedupeKey: string
): Promise<ExistingExperimentRow | null> => {
  const { data, error } = await supabaseAdmin
    .from('log_experiments')
    .select('experiment_id,scope')
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .contains('scope', { dedupe_key: dedupeKey })
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to resolve experiment dedupe key: ${error.message}`);
  }

  const row = (data?.[0] ?? null) as ExistingExperimentRow | null;
  return row;
};

const resolveExperimentId = async (
  experimentId: string | null,
  experimentDedupeKey: string | null
): Promise<string> => {
  if (experimentId) {
    const { data, error } = await supabaseAdmin
      .from('log_experiments')
      .select('experiment_id')
      .eq('experiment_id', experimentId)
      .eq('account_id', env.accountId)
      .eq('marketplace', env.marketplace)
      .maybeSingle();

    if (error || !data?.experiment_id) {
      throw new Error('Referenced experiment_id was not found in this account/marketplace.');
    }

    return data.experiment_id as string;
  }

  if (!experimentDedupeKey) {
    throw new Error('Missing experiment reference.');
  }

  const byDedupeKey = await resolveExperimentByDedupeKey(experimentDedupeKey);
  if (!byDedupeKey?.experiment_id) {
    throw new Error('Referenced experiment_dedupe_key was not found.');
  }

  return byDedupeKey.experiment_id;
};

const applyExperiment = async (parsed: Extract<ParsedLogbookAiPack, { kind: 'experiment' }>) => {
  const dedupeKey = parsed.experiment.dedupe_key;

  if (dedupeKey) {
    const existing = await resolveExperimentByDedupeKey(dedupeKey);
    if (existing?.experiment_id) {
      const mergedScope = {
        ...(existing.scope ?? {}),
        ...parsed.experiment.scope,
      };

      const { error } = await supabaseAdmin
        .from('log_experiments')
        .update({
          name: parsed.experiment.name,
          objective: parsed.experiment.objective,
          hypothesis: parsed.experiment.hypothesis,
          evaluation_lag_days: parsed.experiment.evaluation_lag_days,
          evaluation_window_days: parsed.experiment.evaluation_window_days,
          primary_metrics: parsed.experiment.primary_metrics,
          guardrails: parsed.experiment.guardrails,
          scope: mergedScope,
        })
        .eq('experiment_id', existing.experiment_id)
        .eq('account_id', env.accountId)
        .eq('marketplace', env.marketplace);

      if (error) {
        throw new Error(`Failed to update experiment: ${error.message}`);
      }

      return existing.experiment_id;
    }
  }

  const { data, error } = await supabaseAdmin
    .from('log_experiments')
    .insert({
      account_id: env.accountId,
      marketplace: env.marketplace,
      name: parsed.experiment.name,
      objective: parsed.experiment.objective,
      hypothesis: parsed.experiment.hypothesis,
      evaluation_lag_days: parsed.experiment.evaluation_lag_days,
      evaluation_window_days: parsed.experiment.evaluation_window_days,
      primary_metrics: parsed.experiment.primary_metrics,
      guardrails: parsed.experiment.guardrails,
      scope: parsed.experiment.scope,
    })
    .select('experiment_id')
    .single();

  if (error || !data?.experiment_id) {
    throw new Error(`Failed to create experiment: ${error?.message ?? 'unknown error'}`);
  }

  return data.experiment_id as string;
};

const insertMissingChangeEntities = async (changeId: string, entities: LogbookAiPackEntity[]) => {
  const deduped = dedupeEntityRows(entities);
  if (deduped.length === 0) return;

  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from('log_change_entities')
    .select('entity_type,product_id,campaign_id,ad_group_id,target_id,keyword_id,note,extra')
    .eq('change_id', changeId);

  if (existingError) {
    throw new Error(`Failed to load existing change entities: ${existingError.message}`);
  }

  const existingSignatures = new Set<string>();
  (existingRows ?? []).forEach((row) => {
    const signature = [
      row.entity_type ?? '',
      row.product_id ?? '',
      row.campaign_id ?? '',
      row.ad_group_id ?? '',
      row.target_id ?? '',
      row.keyword_id ?? '',
      row.note ?? '',
      row.extra ? JSON.stringify(row.extra) : '',
    ].join('|');
    existingSignatures.add(signature);
  });

  const inserts = deduped
    .map((entity) => {
      const signature = [
        entity.entity_type,
        entity.product_id ?? '',
        entity.campaign_id ?? '',
        entity.ad_group_id ?? '',
        entity.target_id ?? '',
        entity.keyword_id ?? '',
        entity.note ?? '',
        entity.extra ? JSON.stringify(entity.extra) : '',
      ].join('|');

      if (existingSignatures.has(signature)) return null;

      return {
        change_id: changeId,
        entity_type: entity.entity_type,
        product_id: entity.product_id,
        campaign_id: entity.campaign_id,
        ad_group_id: entity.ad_group_id,
        target_id: entity.target_id,
        keyword_id: entity.keyword_id,
        note: entity.note,
        extra: entity.extra,
      };
    })
    .filter((row) => Boolean(row));

  if (inserts.length === 0) return;

  const { error } = await supabaseAdmin.from('log_change_entities').insert(inserts);
  if (error) {
    throw new Error(`Failed to insert change entities: ${error.message}`);
  }
};

const ensureProductEntity = (entities: LogbookAiPackEntity[], asin: string) => {
  const normalizedAsin = normalizeAsin(asin);
  const hasProductLink = entities.some((entity) => entity.product_id === normalizedAsin);
  if (hasProductLink) return entities;

  return [
    {
      entity_type: 'product',
      product_id: normalizedAsin,
      campaign_id: null,
      ad_group_id: null,
      target_id: null,
      keyword_id: null,
      note: null,
      extra: null,
    },
    ...entities,
  ];
};

const applyChange = async (parsed: Extract<ParsedLogbookAiPack, { kind: 'change' }>) => {
  const changePayload = {
    account_id: env.accountId,
    marketplace: env.marketplace,
    dedupe_key: parsed.change.dedupe_key,
    occurred_at: parsed.change.occurred_at,
    channel: parsed.change.channel,
    change_type: parsed.change.change_type,
    summary: parsed.change.summary,
    why: parsed.change.why,
    source: parsed.change.source,
    before_json: parsed.change.before_json,
    after_json: parsed.change.after_json,
  };

  let changeId: string | null = null;

  if (parsed.change.dedupe_key) {
    const { data, error } = await supabaseAdmin
      .from('log_changes')
      .upsert(changePayload, {
        onConflict: 'account_id,dedupe_key',
      })
      .select('change_id')
      .single();

    if (error || !data?.change_id) {
      throw new Error(`Failed to upsert change: ${error?.message ?? 'unknown error'}`);
    }

    changeId = data.change_id as string;
  } else {
    const { data, error } = await supabaseAdmin
      .from('log_changes')
      .insert(changePayload)
      .select('change_id')
      .single();

    if (error || !data?.change_id) {
      throw new Error(`Failed to create change: ${error?.message ?? 'unknown error'}`);
    }

    changeId = data.change_id as string;
  }

  const entities = ensureProductEntity(parsed.change.entities, parsed.product_asin);
  await insertMissingChangeEntities(changeId, entities);

  if (parsed.change.experiment_id || parsed.change.experiment_dedupe_key) {
    const experimentId = await resolveExperimentId(
      parsed.change.experiment_id,
      parsed.change.experiment_dedupe_key
    );

    const { error } = await supabaseAdmin.from('log_experiment_changes').upsert(
      {
        experiment_id: experimentId,
        change_id: changeId,
      },
      {
        onConflict: 'experiment_id,change_id',
        ignoreDuplicates: true,
      }
    );

    if (error) {
      throw new Error(`Failed to link change to experiment: ${error.message}`);
    }
  }

  return changeId;
};

const applyEvaluation = async (
  parsed: Extract<ParsedLogbookAiPack, { kind: 'evaluation' }>
) => {
  const experimentId = await resolveExperimentId(
    parsed.evaluation.experiment_id,
    parsed.evaluation.experiment_dedupe_key
  );

  const { data, error } = await supabaseAdmin
    .from('log_evaluations')
    .insert({
      experiment_id: experimentId,
      account_id: env.accountId,
      marketplace: env.marketplace,
      evaluated_at: parsed.evaluation.evaluated_at,
      window_start: parsed.evaluation.window_start,
      window_end: parsed.evaluation.window_end,
      metrics_json: parsed.evaluation.metrics_json,
      notes: parsed.evaluation.notes,
    })
    .select('evaluation_id')
    .single();

  if (error || !data?.evaluation_id) {
    throw new Error(`Failed to create evaluation: ${error?.message ?? 'unknown error'}`);
  }

  const { data: experimentRow, error: experimentError } = await supabaseAdmin
    .from('log_experiments')
    .select('scope')
    .eq('experiment_id', experimentId)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .single();

  if (experimentError) {
    throw new Error(`Failed to load experiment scope for update: ${experimentError.message}`);
  }

  const nextScope = {
    ...(asObject(experimentRow.scope) ?? {}),
  } as Record<string, unknown>;

  if (parsed.evaluation.mark_complete) {
    nextScope.status = 'complete';
  }

  if (parsed.evaluation.status) {
    nextScope.status = parsed.evaluation.status;
  }

  if (parsed.evaluation.outcome_summary) {
    nextScope.outcome_summary = parsed.evaluation.outcome_summary;
  }

  const { error: updateError } = await supabaseAdmin
    .from('log_experiments')
    .update({ scope: nextScope })
    .eq('experiment_id', experimentId)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace);

  if (updateError) {
    throw new Error(`Failed to update experiment scope after evaluation: ${updateError.message}`);
  }

  return data.evaluation_id as string;
};

export const importLogbookAiPack = async ({
  fileText,
  currentAsin,
}: ImportLogbookAiPackInput): Promise<ImportLogbookAiPackResult> => {
  const parsed = parseLogbookAiPack(fileText, currentAsin);
  if (!parsed.ok) {
    return {
      ok: false,
      upserted_change_ids_count: 0,
      error: parsed.error,
    };
  }

  try {
    if (parsed.value.kind === 'experiment') {
      const experimentId = await applyExperiment(parsed.value);
      return {
        ok: true,
        created_experiment_id: experimentId,
        upserted_change_ids_count: 0,
      };
    }

    if (parsed.value.kind === 'change') {
      await applyChange(parsed.value);
      return {
        ok: true,
        upserted_change_ids_count: 1,
      };
    }

    const evaluationId = await applyEvaluation(parsed.value);
    return {
      ok: true,
      upserted_change_ids_count: 0,
      created_evaluation_id: evaluationId,
    };
  } catch (error) {
    return {
      ok: false,
      upserted_change_ids_count: 0,
      error: error instanceof Error ? error.message : 'Unknown import error.',
    };
  }
};
