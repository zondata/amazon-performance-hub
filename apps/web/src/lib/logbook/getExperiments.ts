import 'server-only';

import { env } from '@/lib/env';
import { extractOutcomeScore } from '@/lib/logbook/aiPack/parseLogbookAiPack';
import { normalizeOutcomeScorePercent } from '@/lib/logbook/outcomePill';
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
  product_id: string | null;
  latest_evaluated_at: string | null;
  outcome_score: number | null;
};

type ExperimentRow = Omit<ExperimentListItem, 'linked_changes_count' | 'status'>;

type LinkRow = {
  experiment_id: string;
  change_id: string;
};

type EvaluationRow = {
  experiment_id: string;
  evaluated_at: string;
  metrics_json: unknown | null;
};

const deriveStatus = (scope: unknown) => {
  if (!scope || typeof scope !== 'object') return 'planned';
  const status = (scope as { status?: unknown }).status;
  return typeof status === 'string' && status.trim() ? status : 'planned';
};

const deriveProductId = (scope: unknown) => {
  if (!scope || typeof scope !== 'object') return null;
  const productId = (scope as { product_id?: unknown }).product_id;
  if (typeof productId !== 'string') return null;
  const trimmed = productId.trim();
  return trimmed.length > 0 ? trimmed : null;
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
  const [linksResult, evaluationsResult] = await Promise.all([
    supabaseAdmin
      .from('log_experiment_changes')
      .select('experiment_id,change_id')
      .in('experiment_id', experimentIds),
    supabaseAdmin
      .from('log_evaluations')
      .select('experiment_id,evaluated_at,metrics_json')
      .eq('account_id', env.accountId)
      .eq('marketplace', env.marketplace)
      .in('experiment_id', experimentIds)
      .order('evaluated_at', { ascending: false })
      .limit(5000),
  ]);

  if (linksResult.error) {
    throw new Error(`Failed to load experiment links: ${linksResult.error.message}`);
  }

  if (evaluationsResult.error) {
    throw new Error(`Failed to load experiment evaluations: ${evaluationsResult.error.message}`);
  }

  const countByExperiment = new Map<string, number>();
  (linksResult.data as LinkRow[] | null)?.forEach((link) => {
    countByExperiment.set(
      link.experiment_id,
      (countByExperiment.get(link.experiment_id) ?? 0) + 1
    );
  });

  const latestEvaluationByExperiment = new Map<string, EvaluationRow>();
  (evaluationsResult.data as EvaluationRow[] | null)?.forEach((evaluation) => {
    if (!latestEvaluationByExperiment.has(evaluation.experiment_id)) {
      latestEvaluationByExperiment.set(evaluation.experiment_id, evaluation);
    }
  });

  return rows.map((row) => ({
    ...row,
    linked_changes_count: countByExperiment.get(row.experiment_id) ?? 0,
    status: deriveStatus(row.scope),
    product_id: deriveProductId(row.scope),
    latest_evaluated_at: latestEvaluationByExperiment.get(row.experiment_id)?.evaluated_at ?? null,
    outcome_score: normalizeOutcomeScorePercent(
      extractOutcomeScore(latestEvaluationByExperiment.get(row.experiment_id)?.metrics_json ?? null)
    ),
  }));
};
