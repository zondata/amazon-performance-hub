import 'server-only';

import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type ExperimentListItem = {
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
  linked_changes_count: number;
  status: string;
};

type ExperimentRow = Omit<ExperimentListItem, 'linked_changes_count' | 'status'>;

type LinkRow = {
  experiment_id: string;
  change_id: string;
};

const deriveStatus = (scope: unknown) => {
  if (!scope || typeof scope !== 'object') return 'planned';
  const status = (scope as { status?: unknown }).status;
  return typeof status === 'string' && status.trim() ? status : 'planned';
};

export const getExperiments = async (): Promise<ExperimentListItem[]> => {
  const { data, error } = await supabaseAdmin
    .from('log_experiments')
    .select(
      'experiment_id,name,objective,hypothesis,evaluation_lag_days,evaluation_window_days,primary_metrics,guardrails,scope,created_at'
    )
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(`Failed to load experiments: ${error.message}`);
  }

  const rows = (data ?? []) as ExperimentRow[];
  if (rows.length === 0) return [];

  const experimentIds = rows.map((row) => row.experiment_id);
  const { data: links } = await supabaseAdmin
    .from('log_experiment_changes')
    .select('experiment_id,change_id')
    .in('experiment_id', experimentIds);

  const countByExperiment = new Map<string, number>();
  (links as LinkRow[] | null)?.forEach((link) => {
    countByExperiment.set(
      link.experiment_id,
      (countByExperiment.get(link.experiment_id) ?? 0) + 1
    );
  });

  return rows.map((row) => ({
    ...row,
    linked_changes_count: countByExperiment.get(row.experiment_id) ?? 0,
    status: deriveStatus(row.scope),
  }));
};
