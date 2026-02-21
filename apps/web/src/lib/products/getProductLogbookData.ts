import 'server-only';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  buildProductLogbookViewModel,
  ProductLogbookDataViewModel,
  ProductLogbookChangeRow,
  ProductLogbookEntityRow,
  ProductLogbookEvaluationRow,
  ProductLogbookExperimentLinkRow,
  ProductLogbookExperimentRow,
  ProductLogbookValidationRow,
} from './buildProductLogbookViewModel';

type GetProductLogbookDataParams = {
  accountId: string;
  marketplace: string;
  asin: string;
};

export const getProductLogbookData = async ({
  accountId,
  marketplace,
  asin,
}: GetProductLogbookDataParams): Promise<ProductLogbookDataViewModel> => {
  const normalizedAsin = asin.trim().toUpperCase();

  const { data: experimentsData, error: experimentsError } = await supabaseAdmin
    .from('log_experiments')
    .select(
      'experiment_id,name,objective,hypothesis,evaluation_lag_days,evaluation_window_days,primary_metrics,guardrails,scope,created_at'
    )
    .eq('account_id', accountId)
    .eq('marketplace', marketplace)
    .contains('scope', { product_id: normalizedAsin })
    .order('created_at', { ascending: false })
    .limit(500);

  if (experimentsError) {
    throw new Error(`Failed to load product experiments: ${experimentsError.message}`);
  }

  const experiments = (experimentsData ?? []) as ProductLogbookExperimentRow[];
  const experimentIds = experiments.map((row) => row.experiment_id);

  const { data: productEntityRows, error: productEntityError } = await supabaseAdmin
    .from('log_change_entities')
    .select('change_id')
    .eq('product_id', normalizedAsin)
    .order('created_at', { ascending: false })
    .limit(5000);

  if (productEntityError) {
    throw new Error(`Failed to load product-linked change ids: ${productEntityError.message}`);
  }

  const changeIds = Array.from(
    new Set((productEntityRows ?? []).map((row) => row.change_id as string))
  );

  if (changeIds.length === 0) {
    return buildProductLogbookViewModel({
      changes: [],
      entities: [],
      experimentLinks: [],
      experiments,
      evaluations: [],
      validations: [],
    });
  }

  const { data: changesData, error: changesError } = await supabaseAdmin
    .from('log_changes')
    .select(
      'change_id,occurred_at,channel,change_type,summary,why,source,before_json,after_json,created_at'
    )
    .eq('account_id', accountId)
    .eq('marketplace', marketplace)
    .in('change_id', changeIds)
    .order('occurred_at', { ascending: false })
    .limit(5000);

  if (changesError) {
    throw new Error(`Failed to load product changes: ${changesError.message}`);
  }

  const changes = (changesData ?? []) as ProductLogbookChangeRow[];

  const { data: entitiesData, error: entitiesError } = await supabaseAdmin
    .from('log_change_entities')
    .select(
      'change_entity_id,change_id,entity_type,product_id,campaign_id,ad_group_id,target_id,keyword_id,note,extra,created_at'
    )
    .in('change_id', changeIds)
    .order('created_at', { ascending: false })
    .limit(10000);

  if (entitiesError) {
    throw new Error(`Failed to load change entities: ${entitiesError.message}`);
  }

  const entities = (entitiesData ?? []) as ProductLogbookEntityRow[];

  const { data: linksData, error: linksError } = await supabaseAdmin
    .from('log_experiment_changes')
    .select('experiment_change_id,experiment_id,change_id,created_at')
    .in('change_id', changeIds)
    .limit(10000);

  if (linksError) {
    throw new Error(`Failed to load experiment links: ${linksError.message}`);
  }

  const links = (linksData ?? []) as ProductLogbookExperimentLinkRow[];

  const { data: validationsData, error: validationsError } = await supabaseAdmin
    .from('log_change_validations')
    .select(
      'change_id,status,expected_json,actual_json,diff_json,validated_upload_id,validated_snapshot_date,checked_at,created_at'
    )
    .in('change_id', changeIds)
    .order('checked_at', { ascending: false })
    .limit(10000);

  if (validationsError) {
    throw new Error(`Failed to load change validations: ${validationsError.message}`);
  }

  const validations = (validationsData ?? []) as ProductLogbookValidationRow[];

  let evaluations: ProductLogbookEvaluationRow[] = [];
  if (experimentIds.length > 0) {
    const { data: evaluationsData, error: evaluationsError } = await supabaseAdmin
      .from('log_evaluations')
      .select(
        'evaluation_id,experiment_id,evaluated_at,window_start,window_end,metrics_json,notes,created_at'
      )
      .eq('account_id', accountId)
      .eq('marketplace', marketplace)
      .in('experiment_id', experimentIds)
      .order('evaluated_at', { ascending: false })
      .limit(5000);

    if (evaluationsError) {
      throw new Error(`Failed to load experiment evaluations: ${evaluationsError.message}`);
    }

    evaluations = (evaluationsData ?? []) as ProductLogbookEvaluationRow[];
  }

  return buildProductLogbookViewModel({
    changes,
    entities,
    experimentLinks: links,
    experiments,
    evaluations,
    validations,
  });
};
