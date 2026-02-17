import 'server-only';

import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type ExperimentDetail = {
  experiment_id: string;
  name: string;
  objective: string;
  hypothesis: string | null;
  evaluation_lag_days: number | null;
  evaluation_window_days: number | null;
  primary_metrics: unknown | null;
  guardrails: unknown | null;
  scope: unknown | null;
  created_at: string;
  status: string;
};

export type ExperimentLinkedChange = {
  change_id: string;
  occurred_at: string;
  channel: string;
  change_type: string;
  summary: string;
  why: string | null;
  source: string;
  entity_hints: {
    product_ids: string[];
    campaign_ids: string[];
    ad_group_ids: string[];
    target_ids: string[];
  };
};

type ExperimentRow = Omit<ExperimentDetail, 'status'>;

type LinkRow = {
  change_id: string;
};

type ChangeRow = {
  change_id: string;
  occurred_at: string;
  channel: string;
  change_type: string;
  summary: string;
  why: string | null;
  source: string;
};

type EntityRow = {
  change_id: string;
  product_id: string | null;
  campaign_id: string | null;
  ad_group_id: string | null;
  target_id: string | null;
};

const deriveStatus = (scope: unknown) => {
  if (!scope || typeof scope !== 'object') return 'planned';
  const status = (scope as { status?: unknown }).status;
  return typeof status === 'string' && status.trim() ? status : 'planned';
};

const uniqueStrings = (values: Array<string | null | undefined>) => {
  const set = new Set<string>();
  values.forEach((value) => {
    if (!value) return;
    set.add(value);
  });
  return Array.from(set.values());
};

export const getExperimentDetail = async (
  experimentId: string
): Promise<{ experiment: ExperimentDetail; linkedChanges: ExperimentLinkedChange[] }> => {
  const { data, error } = await supabaseAdmin
    .from('log_experiments')
    .select(
      'experiment_id,name,objective,hypothesis,evaluation_lag_days,evaluation_window_days,primary_metrics,guardrails,scope,created_at'
    )
    .eq('experiment_id', experimentId)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .single();

  if (error || !data) {
    throw new Error(`Experiment not found: ${error?.message ?? 'unknown error'}`);
  }

  const experimentRow = data as ExperimentRow;

  const { data: linkRows, error: linkError } = await supabaseAdmin
    .from('log_experiment_changes')
    .select('change_id')
    .eq('experiment_id', experimentId);

  if (linkError) {
    throw new Error(`Failed to load experiment links: ${linkError.message}`);
  }

  const changeIds = (linkRows as LinkRow[] | null)?.map((row) => row.change_id) ?? [];
  if (changeIds.length === 0) {
    return {
      experiment: { ...experimentRow, status: deriveStatus(experimentRow.scope) },
      linkedChanges: [],
    };
  }

  const { data: changeRows, error: changeError } = await supabaseAdmin
    .from('log_changes')
    .select('change_id,occurred_at,channel,change_type,summary,why,source')
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .in('change_id', changeIds);

  if (changeError) {
    throw new Error(`Failed to load linked changes: ${changeError.message}`);
  }

  const { data: entityRows } = await supabaseAdmin
    .from('log_change_entities')
    .select('change_id,product_id,campaign_id,ad_group_id,target_id')
    .in('change_id', changeIds);

  const entitiesByChange = new Map<string, EntityRow[]>();
  (entityRows as EntityRow[] | null)?.forEach((row) => {
    const existing = entitiesByChange.get(row.change_id) ?? [];
    existing.push(row);
    entitiesByChange.set(row.change_id, existing);
  });

  const linkedChanges = ((changeRows ?? []) as ChangeRow[])
    .map((row) => {
      const entities = entitiesByChange.get(row.change_id) ?? [];
      return {
        ...row,
        entity_hints: {
          product_ids: uniqueStrings(entities.map((entity) => entity.product_id)),
          campaign_ids: uniqueStrings(entities.map((entity) => entity.campaign_id)),
          ad_group_ids: uniqueStrings(entities.map((entity) => entity.ad_group_id)),
          target_ids: uniqueStrings(entities.map((entity) => entity.target_id)),
        },
      };
    })
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

  return {
    experiment: { ...experimentRow, status: deriveStatus(experimentRow.scope) },
    linkedChanges,
  };
};
