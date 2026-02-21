import 'server-only';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  buildProductChangesExplorerViewModel,
  ProductChangesExplorerChangeRow,
  ProductChangesExplorerEntityRow,
  ProductChangesExplorerExperimentRow,
  ProductChangesExplorerFilters,
  ProductChangesExplorerLinkRow,
  ProductChangesExplorerRow,
  ProductChangesExplorerValidationRow,
} from './buildProductChangesExplorerViewModel';

type GetProductChangesExplorerDataParams = {
  accountId: string;
  marketplace: string;
  asin: string;
  start: string;
  end: string;
  filters?: ProductChangesExplorerFilters;
};

export const getProductChangesExplorerData = async ({
  accountId,
  marketplace,
  asin,
  start,
  end,
  filters,
}: GetProductChangesExplorerDataParams): Promise<ProductChangesExplorerRow[]> => {
  const normalizedAsin = asin.trim().toUpperCase();

  const { data: entityIdRows, error: entityIdError } = await supabaseAdmin
    .from('log_change_entities')
    .select('change_id')
    .eq('product_id', normalizedAsin)
    .order('created_at', { ascending: false })
    .limit(10000);

  if (entityIdError) {
    throw new Error(`Failed to load product-linked change ids: ${entityIdError.message}`);
  }

  const candidateChangeIds = Array.from(
    new Set((entityIdRows ?? []).map((row) => row.change_id as string))
  );

  if (candidateChangeIds.length === 0) {
    return [];
  }

  const { data: changesData, error: changesError } = await supabaseAdmin
    .from('log_changes')
    .select(
      'change_id,occurred_at,channel,change_type,summary,why,source,before_json,after_json,created_at'
    )
    .eq('account_id', accountId)
    .eq('marketplace', marketplace)
    .in('change_id', candidateChangeIds)
    .gte('occurred_at', `${start}T00:00:00Z`)
    .lte('occurred_at', `${end}T23:59:59Z`)
    .order('occurred_at', { ascending: false })
    .limit(5000);

  if (changesError) {
    throw new Error(`Failed to load product changes: ${changesError.message}`);
  }

  const changes = (changesData ?? []) as ProductChangesExplorerChangeRow[];
  if (changes.length === 0) {
    return [];
  }

  const changeIds = changes.map((row) => row.change_id);

  const [entitiesResult, validationsResult, linksResult] = await Promise.all([
    supabaseAdmin
      .from('log_change_entities')
      .select(
        'change_entity_id,change_id,entity_type,product_id,campaign_id,ad_group_id,target_id,keyword_id,note,extra,created_at'
      )
      .in('change_id', changeIds)
      .order('created_at', { ascending: false })
      .limit(10000),
    supabaseAdmin
      .from('log_change_validations')
      .select('change_id,status,checked_at,created_at')
      .in('change_id', changeIds)
      .order('checked_at', { ascending: false })
      .limit(10000),
    supabaseAdmin
      .from('log_experiment_changes')
      .select('experiment_id,change_id,created_at')
      .in('change_id', changeIds)
      .order('created_at', { ascending: false })
      .limit(10000),
  ]);

  if (entitiesResult.error) {
    throw new Error(`Failed to load change entities: ${entitiesResult.error.message}`);
  }

  if (validationsResult.error) {
    throw new Error(`Failed to load change validations: ${validationsResult.error.message}`);
  }

  if (linksResult.error) {
    throw new Error(`Failed to load experiment links: ${linksResult.error.message}`);
  }

  const entities = (entitiesResult.data ?? []) as ProductChangesExplorerEntityRow[];
  const validations = (validationsResult.data ?? []) as ProductChangesExplorerValidationRow[];
  const links = (linksResult.data ?? []) as ProductChangesExplorerLinkRow[];

  const experimentIds = Array.from(new Set(links.map((row) => row.experiment_id)));
  let experiments: ProductChangesExplorerExperimentRow[] = [];

  if (experimentIds.length > 0) {
    const { data: experimentsData, error: experimentsError } = await supabaseAdmin
      .from('log_experiments')
      .select('experiment_id,name')
      .eq('account_id', accountId)
      .eq('marketplace', marketplace)
      .in('experiment_id', experimentIds)
      .limit(1000);

    if (experimentsError) {
      throw new Error(`Failed to load linked experiments: ${experimentsError.message}`);
    }

    experiments = (experimentsData ?? []) as ProductChangesExplorerExperimentRow[];
  }

  return buildProductChangesExplorerViewModel({
    changes,
    entities,
    validations,
    links,
    experiments,
    filters,
  });
};
