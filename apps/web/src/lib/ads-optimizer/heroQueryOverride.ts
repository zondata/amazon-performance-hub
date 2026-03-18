import 'server-only';

import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { saveManualStrategicOverride } from './repoConfig';

export const ADS_OPTIMIZER_HERO_QUERY_OVERRIDE_KEY = 'hero_query_default';

type HeroQueryOverrideRow = {
  manual_override_id: string;
  override_value_json: unknown;
  created_at: string;
};

export const parseAdsOptimizerHeroQueryOverrideQuery = (value: unknown): string | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const query = (value as Record<string, unknown>).query;
  if (typeof query !== 'string') return null;
  const trimmed = query.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const getAdsOptimizerHeroQueryManualOverride = async (productId: string) => {
  const { data, error } = await supabaseAdmin
    .from('ads_optimizer_manual_overrides')
    .select('manual_override_id,override_value_json,created_at')
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .eq('product_id', productId)
    .eq('override_key', ADS_OPTIMIZER_HERO_QUERY_OVERRIDE_KEY)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load hero query override: ${error.message}`);
  }

  const row = (data ?? null) as HeroQueryOverrideRow | null;
  const query = parseAdsOptimizerHeroQueryOverrideQuery(row?.override_value_json ?? null);
  if (!row || !query) {
    return null;
  }

  return {
    manualOverrideId: row.manual_override_id,
    query,
    createdAt: row.created_at,
  };
};

export const saveAdsOptimizerHeroQueryManualOverride = async (args: {
  productId: string;
  query: string;
}) => {
  const trimmedQuery = args.query.trim();
  if (trimmedQuery.length === 0) {
    throw new Error('Hero query is required.');
  }

  return saveManualStrategicOverride({
    product_id: args.productId,
    override_key: ADS_OPTIMIZER_HERO_QUERY_OVERRIDE_KEY,
    override_value_json: {
      query: trimmedQuery,
    },
    notes: 'Overview hero query default',
  });
};

export const resetAdsOptimizerHeroQueryManualOverride = async (productId: string) => {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('ads_optimizer_manual_overrides')
    .update({
      is_archived: true,
      archived_at: now,
      updated_at: now,
    })
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .eq('product_id', productId)
    .eq('override_key', ADS_OPTIMIZER_HERO_QUERY_OVERRIDE_KEY)
    .eq('is_archived', false);

  if (error) {
    throw new Error(`Failed to reset hero query override: ${error.message}`);
  }
};
