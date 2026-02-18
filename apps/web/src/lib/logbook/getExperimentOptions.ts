import 'server-only';

import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type ExperimentOption = {
  experiment_id: string;
  name: string;
  created_at: string;
};

export const getExperimentOptions = async (): Promise<ExperimentOption[]> => {
  const { data, error } = await supabaseAdmin
    .from('log_experiments')
    .select('experiment_id,name,created_at')
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(`Failed to load experiments: ${error.message}`);
  }

  return (data ?? []) as ExperimentOption[];
};
