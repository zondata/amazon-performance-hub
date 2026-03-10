import 'server-only';

import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

import { ensureDefaultRulePackVersion } from './repoConfig';
import type {
  AdsOptimizerProductSnapshot,
  AdsOptimizerProductSnapshotRow,
  AdsOptimizerRecommendationSnapshot,
  AdsOptimizerRecommendationSnapshotRow,
  AdsOptimizerRun,
  AdsOptimizerRunRow,
  AdsOptimizerRunStatus,
  AdsOptimizerTargetSnapshot,
  AdsOptimizerTargetSnapshotRow,
  JsonObject,
} from './runtimeTypes';
import {
  mapAdsOptimizerProductSnapshotRow,
  mapAdsOptimizerRecommendationSnapshotRow,
  mapAdsOptimizerRunRow,
  mapAdsOptimizerTargetSnapshotRow,
} from './runtimeTypes';
import type { AdsOptimizerRulePackVersion } from './types';

const RUN_SELECT = [
  'run_id',
  'account_id',
  'marketplace',
  'channel',
  'scope_type',
  'selected_asin',
  'run_kind',
  'date_start',
  'date_end',
  'rule_pack_version_id',
  'rule_pack_version_label',
  'status',
  'input_summary_json',
  'diagnostics_json',
  'product_snapshot_count',
  'target_snapshot_count',
  'recommendation_snapshot_count',
  'role_transition_count',
  'created_at',
  'started_at',
  'completed_at',
].join(',');

const PRODUCT_SNAPSHOT_SELECT = [
  'product_snapshot_id',
  'run_id',
  'account_id',
  'marketplace',
  'product_id',
  'asin',
  'snapshot_payload_json',
  'created_at',
].join(',');

const TARGET_SNAPSHOT_SELECT = [
  'target_snapshot_id',
  'run_id',
  'account_id',
  'marketplace',
  'asin',
  'campaign_id',
  'ad_group_id',
  'target_id',
  'source_scope',
  'coverage_note',
  'snapshot_payload_json',
  'created_at',
].join(',');

const RECOMMENDATION_SNAPSHOT_SELECT = [
  'recommendation_snapshot_id',
  'run_id',
  'target_snapshot_id',
  'account_id',
  'marketplace',
  'asin',
  'status',
  'action_type',
  'reason_codes_json',
  'snapshot_payload_json',
  'created_at',
].join(',');

export type AdsOptimizerRuntimeContext = {
  activeVersion: AdsOptimizerRulePackVersion;
};

export type CreateAdsOptimizerRunPayload = {
  selectedAsin: string;
  dateStart: string;
  dateEnd: string;
  rulePackVersionId: string;
  rulePackVersionLabel: string;
  inputSummary: JsonObject;
};

export type UpdateAdsOptimizerRunPayload = {
  status: AdsOptimizerRunStatus;
  diagnostics?: JsonObject | null;
  productSnapshotCount?: number;
  targetSnapshotCount?: number;
  recommendationSnapshotCount?: number;
  roleTransitionCount?: number;
  startedAt?: string | null;
  completedAt?: string | null;
};

export type CreateAdsOptimizerProductSnapshotPayload = {
  runId: string;
  productId: string | null;
  asin: string;
  snapshotPayload: JsonObject;
};

export type CreateAdsOptimizerTargetSnapshotPayload = {
  runId: string;
  asin: string;
  campaignId: string;
  adGroupId: string;
  targetId: string;
  sourceScope: string;
  coverageNote: string | null;
  snapshotPayload: JsonObject;
};

export type CreateAdsOptimizerRecommendationSnapshotPayload = {
  runId: string;
  targetSnapshotId: string;
  asin: string;
  status: 'pending_phase5' | 'generated' | 'skipped';
  actionType: string | null;
  reasonCodes: string[] | null;
  snapshotPayload: JsonObject;
};

export const getAdsOptimizerRuntimeContext = async (): Promise<AdsOptimizerRuntimeContext> => {
  const foundation = await ensureDefaultRulePackVersion();
  if (!foundation.activeVersion) {
    throw new Error('No active optimizer rule pack version is available for manual runs.');
  }

  return {
    activeVersion: foundation.activeVersion,
  };
};

export const createAdsOptimizerRun = async (
  payload: CreateAdsOptimizerRunPayload
): Promise<AdsOptimizerRun> => {
  const { data, error } = await supabaseAdmin
    .from('ads_optimizer_runs')
    .insert({
      account_id: env.accountId,
      marketplace: env.marketplace,
      channel: 'sp',
      scope_type: 'product',
      selected_asin: payload.selectedAsin,
      run_kind: 'manual',
      date_start: payload.dateStart,
      date_end: payload.dateEnd,
      rule_pack_version_id: payload.rulePackVersionId,
      rule_pack_version_label: payload.rulePackVersionLabel,
      status: 'pending',
      input_summary_json: payload.inputSummary,
    })
    .select(RUN_SELECT)
    .single();

  if (error || !data) {
    throw new Error(`Failed to create optimizer run: ${error?.message ?? 'unknown error'}`);
  }

  return mapAdsOptimizerRunRow(data as unknown as AdsOptimizerRunRow);
};

export const updateAdsOptimizerRun = async (
  runId: string,
  payload: UpdateAdsOptimizerRunPayload
): Promise<AdsOptimizerRun> => {
  const updateBody: Record<string, unknown> = {
    status: payload.status,
  };

  if (payload.diagnostics !== undefined) {
    updateBody.diagnostics_json = payload.diagnostics;
  }
  if (payload.productSnapshotCount !== undefined) {
    updateBody.product_snapshot_count = payload.productSnapshotCount;
  }
  if (payload.targetSnapshotCount !== undefined) {
    updateBody.target_snapshot_count = payload.targetSnapshotCount;
  }
  if (payload.recommendationSnapshotCount !== undefined) {
    updateBody.recommendation_snapshot_count = payload.recommendationSnapshotCount;
  }
  if (payload.roleTransitionCount !== undefined) {
    updateBody.role_transition_count = payload.roleTransitionCount;
  }
  if (payload.startedAt !== undefined) {
    updateBody.started_at = payload.startedAt;
  }
  if (payload.completedAt !== undefined) {
    updateBody.completed_at = payload.completedAt;
  }

  const { data, error } = await supabaseAdmin
    .from('ads_optimizer_runs')
    .update(updateBody)
    .eq('run_id', runId)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .select(RUN_SELECT)
    .single();

  if (error || !data) {
    throw new Error(`Failed to update optimizer run: ${error?.message ?? 'unknown error'}`);
  }

  return mapAdsOptimizerRunRow(data as unknown as AdsOptimizerRunRow);
};

export const insertAdsOptimizerProductSnapshots = async (
  rows: CreateAdsOptimizerProductSnapshotPayload[]
): Promise<AdsOptimizerProductSnapshot[]> => {
  if (rows.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from('ads_optimizer_product_snapshot')
    .insert(
      rows.map((row) => ({
        run_id: row.runId,
        account_id: env.accountId,
        marketplace: env.marketplace,
        product_id: row.productId,
        asin: row.asin,
        snapshot_payload_json: row.snapshotPayload,
      }))
    )
    .select(PRODUCT_SNAPSHOT_SELECT);

  if (error) {
    throw new Error(`Failed to insert optimizer product snapshots: ${error.message}`);
  }

  return ((data ?? []) as unknown as AdsOptimizerProductSnapshotRow[]).map(
    mapAdsOptimizerProductSnapshotRow
  );
};

export const insertAdsOptimizerTargetSnapshots = async (
  rows: CreateAdsOptimizerTargetSnapshotPayload[]
): Promise<AdsOptimizerTargetSnapshot[]> => {
  if (rows.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from('ads_optimizer_target_snapshot')
    .insert(
      rows.map((row) => ({
        run_id: row.runId,
        account_id: env.accountId,
        marketplace: env.marketplace,
        asin: row.asin,
        campaign_id: row.campaignId,
        ad_group_id: row.adGroupId,
        target_id: row.targetId,
        source_scope: row.sourceScope,
        coverage_note: row.coverageNote,
        snapshot_payload_json: row.snapshotPayload,
      }))
    )
    .select(TARGET_SNAPSHOT_SELECT);

  if (error) {
    throw new Error(`Failed to insert optimizer target snapshots: ${error.message}`);
  }

  return ((data ?? []) as unknown as AdsOptimizerTargetSnapshotRow[]).map(
    mapAdsOptimizerTargetSnapshotRow
  );
};

export const insertAdsOptimizerRecommendationSnapshots = async (
  rows: CreateAdsOptimizerRecommendationSnapshotPayload[]
): Promise<AdsOptimizerRecommendationSnapshot[]> => {
  if (rows.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from('ads_optimizer_recommendation_snapshot')
    .insert(
      rows.map((row) => ({
        run_id: row.runId,
        target_snapshot_id: row.targetSnapshotId,
        account_id: env.accountId,
        marketplace: env.marketplace,
        asin: row.asin,
        status: row.status,
        action_type: row.actionType,
        reason_codes_json: row.reasonCodes,
        snapshot_payload_json: row.snapshotPayload,
      }))
    )
    .select(RECOMMENDATION_SNAPSHOT_SELECT);

  if (error) {
    throw new Error(`Failed to insert optimizer recommendation snapshots: ${error.message}`);
  }

  return ((data ?? []) as unknown as AdsOptimizerRecommendationSnapshotRow[]).map(
    mapAdsOptimizerRecommendationSnapshotRow
  );
};

export const listAdsOptimizerRuns = async (args: {
  asin?: string;
  limit?: number;
} = {}): Promise<AdsOptimizerRun[]> => {
  let query = supabaseAdmin
    .from('ads_optimizer_runs')
    .select(RUN_SELECT)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .order('created_at', { ascending: false })
    .limit(args.limit ?? 25);

  if (args.asin) {
    query = query.eq('selected_asin', args.asin);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list optimizer runs: ${error.message}`);
  }

  return ((data ?? []) as unknown as AdsOptimizerRunRow[]).map(mapAdsOptimizerRunRow);
};

export const findOptimizerProductByAsin = async (asin: string) => {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('product_id,asin,title')
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .eq('asin', asin)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve optimizer product metadata: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    productId: String(data.product_id),
    asin: String(data.asin ?? asin),
    title: typeof data.title === 'string' ? data.title : null,
  };
};
