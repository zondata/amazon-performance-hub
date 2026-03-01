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

export type ExperimentListData = {
  experiments: ExperimentListItem[];
  warnings: string[];
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

const EXPERIMENT_PAGE_SIZE = 200;
const EXPERIMENT_HARD_CAP = 5000;
const LINK_PAGE_SIZE = 2000;
const LINK_HARD_CAP = 50000;
const EVALUATION_PAGE_SIZE = 2000;
const EVALUATION_HARD_CAP = 50000;

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const deriveStatus = (scope: unknown) => {
  const scopeObj = asObject(scope);
  const status = typeof scopeObj?.status === 'string' ? scopeObj.status.trim() : '';
  const normalizedStatus = status.toUpperCase();
  if (
    normalizedStatus === 'COMPLETE' ||
    normalizedStatus === 'EVALUATED' ||
    normalizedStatus === 'VALIDATED' ||
    normalizedStatus === 'UPLOADED' ||
    normalizedStatus === 'ABANDONED' ||
    normalizedStatus === 'ROLLED_BACK'
  ) {
    return status;
  }

  const contract = asObject(scopeObj?.contract);
  const adsContract = asObject(contract?.ads_optimization_v1);
  const finalPlan = asObject(adsContract?.final_plan);
  const reviewPatch = asObject(adsContract?.review_patch);
  const proposalPlans = Array.isArray(scopeObj?.bulkgen_plans) ? scopeObj?.bulkgen_plans : [];

  if (finalPlan && Array.isArray(finalPlan.bulkgen_plans) && finalPlan.bulkgen_plans.length > 0) {
    return 'FINALIZED';
  }
  if (reviewPatch && asObject(reviewPatch.patch) && Array.isArray(asObject(reviewPatch.patch)?.decisions)) {
    return 'REVIEWED';
  }
  if (proposalPlans.length > 0) {
    if (!status) return 'PROPOSED';
    if (normalizedStatus === 'PLANNED' || normalizedStatus === 'DRAFT') return 'PROPOSED';
    return status;
  }
  return status || 'planned';
};

const deriveProductId = (scope: unknown) => {
  if (!scope || typeof scope !== 'object') return null;
  const productId = (scope as { product_id?: unknown }).product_id;
  if (typeof productId !== 'string') return null;
  const trimmed = productId.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const getExperiments = async (): Promise<ExperimentListData> => {
  const warnings: string[] = [];
  const rows: ExperimentRow[] = [];

  for (let pageIndex = 0; ; pageIndex += 1) {
    const from = pageIndex * EXPERIMENT_PAGE_SIZE;
    const to = from + EXPERIMENT_PAGE_SIZE - 1;
    const { data, error } = await supabaseAdmin
      .from('log_experiments')
      .select(
        'experiment_id,name,objective,hypothesis,evaluation_lag_days,evaluation_window_days,primary_metrics,guardrails,scope,created_at'
      )
      .eq('account_id', env.accountId)
      .eq('marketplace', env.marketplace)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to load experiments: ${error.message}`);
    }

    const pageRows = (data ?? []) as ExperimentRow[];
    rows.push(...pageRows);

    if (rows.length >= EXPERIMENT_HARD_CAP) {
      rows.length = EXPERIMENT_HARD_CAP;
      warnings.push(
        `Experiments list reached hard cap (${EXPERIMENT_HARD_CAP.toLocaleString('en-US')}). Results may be truncated.`
      );
      break;
    }

    if (pageRows.length < EXPERIMENT_PAGE_SIZE) {
      break;
    }
  }

  if (rows.length === 0) {
    return {
      experiments: [],
      warnings,
    };
  }

  const experimentIds = rows.map((row) => row.experiment_id);
  const links: LinkRow[] = [];
  for (let pageIndex = 0; ; pageIndex += 1) {
    const from = pageIndex * LINK_PAGE_SIZE;
    const to = from + LINK_PAGE_SIZE - 1;
    const { data, error } = await supabaseAdmin
      .from('log_experiment_changes')
      .select('experiment_id,change_id')
      .in('experiment_id', experimentIds)
      .order('experiment_id', { ascending: true })
      .order('change_id', { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to load experiment links: ${error.message}`);
    }

    const pageRows = (data ?? []) as LinkRow[];
    links.push(...pageRows);

    if (links.length >= LINK_HARD_CAP) {
      links.length = LINK_HARD_CAP;
      warnings.push(
        `Experiment links reached hard cap (${LINK_HARD_CAP.toLocaleString('en-US')}). Linked-change counts may be truncated.`
      );
      break;
    }

    if (pageRows.length < LINK_PAGE_SIZE) {
      break;
    }
  }

  const evaluations: EvaluationRow[] = [];
  for (let pageIndex = 0; ; pageIndex += 1) {
    const from = pageIndex * EVALUATION_PAGE_SIZE;
    const to = from + EVALUATION_PAGE_SIZE - 1;
    const { data, error } = await supabaseAdmin
      .from('log_evaluations')
      .select('experiment_id,evaluated_at,metrics_json')
      .eq('account_id', env.accountId)
      .eq('marketplace', env.marketplace)
      .in('experiment_id', experimentIds)
      .order('evaluated_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to load experiment evaluations: ${error.message}`);
    }

    const pageRows = (data ?? []) as EvaluationRow[];
    evaluations.push(...pageRows);

    if (evaluations.length >= EVALUATION_HARD_CAP) {
      evaluations.length = EVALUATION_HARD_CAP;
      warnings.push(
        `Experiment evaluations reached hard cap (${EVALUATION_HARD_CAP.toLocaleString('en-US')}). Outcome badges may use incomplete history.`
      );
      break;
    }

    if (pageRows.length < EVALUATION_PAGE_SIZE) {
      break;
    }
  }

  const countByExperiment = new Map<string, number>();
  links.forEach((link) => {
    countByExperiment.set(
      link.experiment_id,
      (countByExperiment.get(link.experiment_id) ?? 0) + 1
    );
  });

  const latestEvaluationByExperiment = new Map<string, EvaluationRow>();
  evaluations.forEach((evaluation) => {
    if (!latestEvaluationByExperiment.has(evaluation.experiment_id)) {
      latestEvaluationByExperiment.set(evaluation.experiment_id, evaluation);
    }
  });

  return {
    experiments: rows.map((row) => ({
      ...row,
      linked_changes_count: countByExperiment.get(row.experiment_id) ?? 0,
      status: deriveStatus(row.scope),
      product_id: deriveProductId(row.scope),
      latest_evaluated_at:
        latestEvaluationByExperiment.get(row.experiment_id)?.evaluated_at ?? null,
      outcome_score: normalizeOutcomeScorePercent(
        extractOutcomeScore(
          latestEvaluationByExperiment.get(row.experiment_id)?.metrics_json ?? null
        )
      ),
    })),
    warnings,
  };
};
