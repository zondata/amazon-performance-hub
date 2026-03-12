import 'server-only';

import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type {
  AdsOptimizerRecommendationOverride,
  AdsOptimizerRecommendationOverrideRow,
  SaveAdsOptimizerRecommendationOverridePayload,
} from './types';
import { mapAdsOptimizerRecommendationOverrideRow } from './types';
import { validateSaveAdsOptimizerRecommendationOverridePayload } from './validation';

const RECOMMENDATION_OVERRIDE_SELECT = [
  'recommendation_override_id',
  'account_id',
  'marketplace',
  'product_id',
  'asin',
  'target_id',
  'run_id',
  'target_snapshot_id',
  'recommendation_snapshot_id',
  'override_scope',
  'replacement_action_bundle_json',
  'operator_note',
  'is_archived',
  'last_applied_at',
  'last_applied_change_set_id',
  'apply_count',
  'created_at',
  'updated_at',
  'archived_at',
].join(',');

const assertProductExists = async (productId: string, asin: string) => {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('product_id,asin')
    .eq('product_id', productId)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to validate product scope for optimizer override: ${error.message}`);
  }
  if (!data) {
    throw new Error('Product was not found in this account/marketplace.');
  }
  if (String(data.asin ?? '') !== asin) {
    throw new Error('Override ASIN does not match the scoped product.');
  }
};

const assertRunScope = async (runId: string, asin: string) => {
  const { data, error } = await supabaseAdmin
    .from('ads_optimizer_runs')
    .select('run_id,selected_asin')
    .eq('run_id', runId)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to validate optimizer run scope: ${error.message}`);
  }
  if (!data) {
    throw new Error('Optimizer run was not found in this account/marketplace.');
  }
  if (String(data.selected_asin ?? '') !== asin) {
    throw new Error('Override ASIN does not match the saved optimizer run.');
  }
};

const assertTargetSnapshotScope = async (args: {
  targetSnapshotId: string;
  runId: string;
  asin: string;
  targetId: string;
}) => {
  const { data, error } = await supabaseAdmin
    .from('ads_optimizer_target_snapshot')
    .select('target_snapshot_id,run_id,asin,target_id')
    .eq('target_snapshot_id', args.targetSnapshotId)
    .eq('run_id', args.runId)
    .eq('asin', args.asin)
    .eq('target_id', args.targetId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to validate target snapshot scope: ${error.message}`);
  }
  if (!data) {
    throw new Error('Target snapshot was not found for the supplied run/ASIN/target scope.');
  }
};

const assertRecommendationSnapshotScope = async (args: {
  recommendationSnapshotId: string;
  targetSnapshotId: string;
  runId: string;
  asin: string;
}) => {
  const { data, error } = await supabaseAdmin
    .from('ads_optimizer_recommendation_snapshot')
    .select('recommendation_snapshot_id,target_snapshot_id,run_id,asin')
    .eq('recommendation_snapshot_id', args.recommendationSnapshotId)
    .eq('target_snapshot_id', args.targetSnapshotId)
    .eq('run_id', args.runId)
    .eq('asin', args.asin)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to validate recommendation snapshot scope: ${error.message}`);
  }
  if (!data) {
    throw new Error(
      'Recommendation snapshot was not found for the supplied run/target snapshot scope.'
    );
  }
};

const archiveExistingRecommendationOverrides = async (args: {
  productId: string;
  targetId: string;
  recommendationSnapshotId: string;
  overrideScope: 'one_time' | 'persistent';
}) => {
  const now = new Date().toISOString();
  const matches = await Promise.all([
    args.overrideScope === 'one_time'
      ? supabaseAdmin
          .from('ads_optimizer_recommendation_overrides')
          .update({
            is_archived: true,
            archived_at: now,
            updated_at: now,
          })
          .eq('account_id', env.accountId)
          .eq('marketplace', env.marketplace)
          .eq('recommendation_snapshot_id', args.recommendationSnapshotId)
          .eq('override_scope', 'one_time')
          .eq('is_archived', false)
      : Promise.resolve({ error: null }),
    args.overrideScope === 'persistent'
      ? supabaseAdmin
          .from('ads_optimizer_recommendation_overrides')
          .update({
            is_archived: true,
            archived_at: now,
            updated_at: now,
          })
          .eq('account_id', env.accountId)
          .eq('marketplace', env.marketplace)
          .eq('product_id', args.productId)
          .eq('target_id', args.targetId)
          .eq('override_scope', 'persistent')
          .eq('is_archived', false)
      : Promise.resolve({ error: null }),
  ]);

  const failing = matches.find((result) => result.error);
  if (failing?.error) {
    throw new Error(
      `Failed to archive conflicting optimizer recommendation overrides: ${failing.error.message}`
    );
  }
};

export const saveAdsOptimizerRecommendationOverride = async (
  payload: SaveAdsOptimizerRecommendationOverridePayload
): Promise<AdsOptimizerRecommendationOverride> => {
  const value = validateSaveAdsOptimizerRecommendationOverridePayload(payload);

  await assertProductExists(value.product_id, value.asin);
  await assertRunScope(value.run_id, value.asin);
  await assertTargetSnapshotScope({
    targetSnapshotId: value.target_snapshot_id,
    runId: value.run_id,
    asin: value.asin,
    targetId: value.target_id,
  });
  await assertRecommendationSnapshotScope({
    recommendationSnapshotId: value.recommendation_snapshot_id,
    targetSnapshotId: value.target_snapshot_id,
    runId: value.run_id,
    asin: value.asin,
  });
  await archiveExistingRecommendationOverrides({
    productId: value.product_id,
    targetId: value.target_id,
    recommendationSnapshotId: value.recommendation_snapshot_id,
    overrideScope: value.override_scope,
  });

  const { data, error } = await supabaseAdmin
    .from('ads_optimizer_recommendation_overrides')
    .insert({
      account_id: env.accountId,
      marketplace: env.marketplace,
      product_id: value.product_id,
      asin: value.asin,
      target_id: value.target_id,
      run_id: value.run_id,
      target_snapshot_id: value.target_snapshot_id,
      recommendation_snapshot_id: value.recommendation_snapshot_id,
      override_scope: value.override_scope,
      replacement_action_bundle_json: value.replacement_action_bundle_json,
      operator_note: value.operator_note,
    })
    .select(RECOMMENDATION_OVERRIDE_SELECT)
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to save optimizer recommendation override: ${error?.message ?? 'unknown error'}`
    );
  }

  return mapAdsOptimizerRecommendationOverrideRow(
    data as unknown as AdsOptimizerRecommendationOverrideRow
  );
};

export const listActiveAdsOptimizerRecommendationOverrides = async (args: {
  productId: string;
  targetIds: string[];
  recommendationSnapshotIds: string[];
}): Promise<AdsOptimizerRecommendationOverride[]> => {
  const targetIds = [...new Set(args.targetIds.filter(Boolean))];
  const recommendationSnapshotIds = [...new Set(args.recommendationSnapshotIds.filter(Boolean))];

  const [persistent, oneTime] = await Promise.all([
    targetIds.length > 0
      ? supabaseAdmin
          .from('ads_optimizer_recommendation_overrides')
          .select(RECOMMENDATION_OVERRIDE_SELECT)
          .eq('account_id', env.accountId)
          .eq('marketplace', env.marketplace)
          .eq('product_id', args.productId)
          .eq('override_scope', 'persistent')
          .eq('is_archived', false)
          .in('target_id', targetIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    recommendationSnapshotIds.length > 0
      ? supabaseAdmin
          .from('ads_optimizer_recommendation_overrides')
          .select(RECOMMENDATION_OVERRIDE_SELECT)
          .eq('account_id', env.accountId)
          .eq('marketplace', env.marketplace)
          .eq('product_id', args.productId)
          .eq('override_scope', 'one_time')
          .eq('is_archived', false)
          .in('recommendation_snapshot_id', recommendationSnapshotIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (persistent.error) {
    throw new Error(
      `Failed to load persistent optimizer recommendation overrides: ${persistent.error.message}`
    );
  }
  if (oneTime.error) {
    throw new Error(
      `Failed to load one-time optimizer recommendation overrides: ${oneTime.error.message}`
    );
  }

  return [...(oneTime.data ?? []), ...(persistent.data ?? [])].map((row) =>
    mapAdsOptimizerRecommendationOverrideRow(row as unknown as AdsOptimizerRecommendationOverrideRow)
  );
};

export const markAdsOptimizerRecommendationOverridesApplied = async (args: {
  overrideIds: string[];
  changeSetId: string;
}) => {
  const overrideIds = [...new Set(args.overrideIds.filter(Boolean))];
  if (overrideIds.length === 0) {
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('ads_optimizer_recommendation_overrides')
    .select(RECOMMENDATION_OVERRIDE_SELECT)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .in('recommendation_override_id', overrideIds);

  if (error) {
    throw new Error(
      `Failed to load optimizer recommendation overrides for apply tracking: ${error.message}`
    );
  }

  const rows = ((data ?? []) as unknown as AdsOptimizerRecommendationOverrideRow[]).map(
    mapAdsOptimizerRecommendationOverrideRow
  );
  const now = new Date().toISOString();

  const updates = await Promise.all(
    rows.map((row) =>
      supabaseAdmin
        .from('ads_optimizer_recommendation_overrides')
        .update({
          is_archived: row.override_scope === 'one_time',
          archived_at: row.override_scope === 'one_time' ? now : null,
          last_applied_at: now,
          last_applied_change_set_id: args.changeSetId,
          apply_count: row.apply_count + 1,
          updated_at: now,
        })
        .eq('recommendation_override_id', row.recommendation_override_id)
        .eq('account_id', env.accountId)
        .eq('marketplace', env.marketplace)
    )
  );

  const failing = updates.find((result) => result.error);
  if (failing?.error) {
    throw new Error(
      `Failed to update optimizer recommendation override apply tracking: ${failing.error.message}`
    );
  }
};
