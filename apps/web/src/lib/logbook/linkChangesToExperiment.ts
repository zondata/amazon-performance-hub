'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const linkChangesToExperiment = async (
  experimentId: string,
  changeIds: string[]
) => {
  const uniqueIds = Array.from(new Set(changeIds.filter(Boolean)));
  if (uniqueIds.length === 0) return 0;

  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from('log_experiment_changes')
    .select('change_id')
    .eq('experiment_id', experimentId)
    .in('change_id', uniqueIds);

  if (existingError) {
    throw new Error(`Failed to check existing links: ${existingError.message}`);
  }

  const existingIds = new Set(
    (existingRows ?? []).map((row) => row.change_id as string)
  );

  const rowsToInsert = uniqueIds
    .filter((id) => !existingIds.has(id))
    .map((changeId) => ({
      experiment_id: experimentId,
      change_id: changeId,
    }));

  if (rowsToInsert.length === 0) return 0;

  const { error } = await supabaseAdmin
    .from('log_experiment_changes')
    .insert(rowsToInsert);

  if (error) {
    throw new Error(`Failed to link changes: ${error.message}`);
  }

  return rowsToInsert.length;
};
