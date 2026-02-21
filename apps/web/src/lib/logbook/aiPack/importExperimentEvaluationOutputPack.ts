'use server';

import 'server-only';

import { computeExperimentKpis } from '@/lib/logbook/computeExperimentKpis';
import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

import { parseExperimentEvaluationOutputPack } from './parseExperimentEvaluationOutputPack';

type JsonObject = Record<string, unknown>;

type ImportInput = {
  fileText: string;
  currentAsin?: string;
  expectedExperimentId?: string;
};

export type ImportExperimentEvaluationOutputPackResult = {
  ok: boolean;
  evaluation_id?: string;
  experiment_id?: string;
  status_updated?: boolean;
  outcome_score?: number;
  outcome_label?: 'success' | 'mixed' | 'fail';
  test_window_start?: string;
  test_window_end?: string;
  error?: string;
};

type ExperimentRow = {
  experiment_id: string;
  evaluation_lag_days: number | null;
  scope: unknown | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const asObject = (value: unknown): JsonObject | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonObject;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeAsin = (value: unknown): string | null => {
  const text = asString(value);
  return text ? text.toUpperCase() : null;
};

const parseDateOnly = (value: unknown): string | null => {
  const text = asString(value);
  if (!text || !DATE_RE.test(text)) return null;
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return text;
};

const toDateOnlyFromIso = (value: string): string | null => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const deriveDateWindowFromScopeOrChanges = async (
  experimentId: string,
  scope: JsonObject | null
): Promise<{ startDate: string; endDate: string; source: 'scope' | 'linked_changes' }> => {
  const scopeStart = parseDateOnly(scope?.start_date);
  const scopeEnd = parseDateOnly(scope?.end_date);

  if (scopeStart && scopeEnd) {
    return {
      startDate: scopeStart,
      endDate: scopeEnd,
      source: 'scope',
    };
  }

  const { data: linkRows, error: linkError } = await supabaseAdmin
    .from('log_experiment_changes')
    .select('change_id')
    .eq('experiment_id', experimentId);

  if (linkError) {
    throw new Error(`Failed to load experiment links for window derivation: ${linkError.message}`);
  }

  const changeIds = (linkRows ?? []).map((row) => row.change_id as string);
  if (changeIds.length === 0) {
    throw new Error('Experiment is missing scope.start_date/end_date and has no linked changes to derive a KPI window.');
  }

  const { data: changeRows, error: changesError } = await supabaseAdmin
    .from('log_changes')
    .select('occurred_at')
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .in('change_id', changeIds)
    .order('occurred_at', { ascending: true })
    .limit(5000);

  if (changesError) {
    throw new Error(`Failed to load linked change dates: ${changesError.message}`);
  }

  const dates = (changeRows ?? [])
    .map((row) => toDateOnlyFromIso(String(row.occurred_at)))
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => a.localeCompare(b));

  if (dates.length === 0) {
    throw new Error('Unable to derive KPI window from linked changes.');
  }

  return {
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    source: 'linked_changes',
  };
};

export const importExperimentEvaluationOutputPack = async (
  input: ImportInput
): Promise<ImportExperimentEvaluationOutputPackResult> => {
  const parsed = parseExperimentEvaluationOutputPack(input.fileText, {
    expectedAsin: input.currentAsin,
    expectedExperimentId: input.expectedExperimentId,
  });

  if (!parsed.ok) {
    return {
      ok: false,
      error: parsed.error,
    };
  }

  try {
    const payload = parsed.value;

    const { data: experimentData, error: experimentError } = await supabaseAdmin
      .from('log_experiments')
      .select('experiment_id,evaluation_lag_days,scope')
      .eq('experiment_id', payload.experiment_id)
      .eq('account_id', env.accountId)
      .eq('marketplace', env.marketplace)
      .maybeSingle();

    if (experimentError || !experimentData?.experiment_id) {
      throw new Error(`Experiment not found: ${experimentError?.message ?? 'unknown error'}`);
    }

    const experiment = experimentData as ExperimentRow;
    const scope = asObject(experiment.scope);
    const scopeAsin = normalizeAsin(scope?.product_id);

    if (!scopeAsin) {
      throw new Error('Experiment scope.product_id is missing; cannot validate evaluation output ASIN.');
    }

    if (scopeAsin !== payload.product_asin) {
      throw new Error(
        `Pack ASIN (${payload.product_asin}) does not match experiment scope.product_id (${scopeAsin}).`
      );
    }

    const window = await deriveDateWindowFromScopeOrChanges(payload.experiment_id, scope);
    const kpis = await computeExperimentKpis({
      accountId: env.accountId,
      marketplace: env.marketplace,
      asin: scopeAsin,
      startDate: window.startDate,
      endDate: window.endDate,
      lagDays: experiment.evaluation_lag_days ?? 0,
    });

    const metricsJson = {
      computed_kpis: kpis,
      outcome: payload.evaluation.outcome,
      summary: payload.evaluation.summary,
      why: payload.evaluation.why,
      next_steps: payload.evaluation.next_steps,
      notes: payload.evaluation.notes,
      window_source: window.source,
    };

    const { data: evaluationData, error: evaluationError } = await supabaseAdmin
      .from('log_evaluations')
      .insert({
        experiment_id: payload.experiment_id,
        account_id: env.accountId,
        marketplace: env.marketplace,
        evaluated_at: new Date().toISOString(),
        window_start: kpis.windows.test.startDate,
        window_end: kpis.windows.test.endDate,
        metrics_json: metricsJson,
        notes: payload.evaluation.summary,
      })
      .select('evaluation_id')
      .single();

    if (evaluationError || !evaluationData?.evaluation_id) {
      throw new Error(`Failed to insert evaluation: ${evaluationError?.message ?? 'unknown error'}`);
    }

    let statusUpdated = false;
    if (payload.evaluation.mark_complete !== false) {
      const currentStatus = asString(scope?.status);
      if (currentStatus !== 'complete') {
        const nextScope: JsonObject = {
          ...(scope ?? {}),
          status: 'complete',
          outcome_summary: payload.evaluation.summary,
        };

        const { error: updateError } = await supabaseAdmin
          .from('log_experiments')
          .update({ scope: nextScope })
          .eq('experiment_id', payload.experiment_id)
          .eq('account_id', env.accountId)
          .eq('marketplace', env.marketplace);

        if (updateError) {
          throw new Error(`Failed to update experiment status: ${updateError.message}`);
        }

        statusUpdated = true;
      }
    }

    return {
      ok: true,
      evaluation_id: evaluationData.evaluation_id as string,
      experiment_id: payload.experiment_id,
      status_updated: statusUpdated,
      outcome_score: payload.evaluation.outcome.score,
      outcome_label: payload.evaluation.outcome.label,
      test_window_start: kpis.windows.test.startDate,
      test_window_end: kpis.windows.test.endDate,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown import error.',
    };
  }
};
