'use server';

import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ExperimentFormPayload, validateExperimentPayload } from './validation';

export const createExperiment = async (payload: ExperimentFormPayload) => {
  const { value, errors } = validateExperimentPayload(payload);
  if (errors.length) {
    throw new Error(`Experiment validation failed: ${errors.join(', ')}`);
  }

  const scope = value.status ? { status: value.status } : null;

  const { data, error } = await supabaseAdmin
    .from('log_experiments')
    .insert({
      account_id: env.accountId,
      marketplace: env.marketplace,
      name: value.name,
      objective: value.objective,
      hypothesis: value.hypothesis,
      evaluation_lag_days: value.evaluation_lag_days,
      evaluation_window_days: value.evaluation_window_days,
      primary_metrics: value.primary_metrics,
      guardrails: value.guardrails,
      scope,
    })
    .select('experiment_id')
    .single();

  if (error || !data || !data.experiment_id) {
    throw new Error(`Failed to create experiment: ${error?.message ?? 'unknown error'}`);
  }

  return data.experiment_id as string;
};
