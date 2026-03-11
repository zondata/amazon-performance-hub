import 'server-only';

import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

import { ensureDefaultRulePackVersion } from './repoConfig';
import type {
  AdsOptimizerRoleTransitionLog,
  AdsOptimizerRoleTransitionLogRow,
  AdsOptimizerProductSnapshot,
  AdsOptimizerProductSnapshotRow,
  AdsOptimizerRecommendationSnapshot,
  AdsOptimizerRecommendationSnapshotRow,
  AdsOptimizerRun,
  AdsOptimizerRunRow,
  AdsOptimizerRunStatus,
  AdsOptimizerTargetSnapshot,
  AdsOptimizerTargetSnapshotRow,
  CreateAdsOptimizerRoleTransitionLogPayload,
  JsonObject,
} from './runtimeTypes';
import {
  mapAdsOptimizerRoleTransitionLogRow,
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

const ROLE_TRANSITION_LOG_SELECT = [
  'role_transition_log_id',
  'run_id',
  'target_snapshot_id',
  'account_id',
  'marketplace',
  'asin',
  'target_id',
  'from_role',
  'to_role',
  'transition_reason_json',
  'created_at',
].join(',');

const PHASE4_PLACEHOLDER_REASON_CODES = new Set([
  'PHASE4_BACKBONE_ONLY',
  'NO_RECOMMENDATION_ENGINE_ACTIVE',
]);

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

const asJsonObject = (value: unknown, fieldName: string): JsonObject => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object.`);
  }
  return value as JsonObject;
};

const normalizeJsonValueForInsert = (value: unknown, fieldName: string): unknown => {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      normalizeJsonValueForInsert(entry, `${fieldName}[${index}]`)
    );
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        normalizeJsonValueForInsert(entry, `${fieldName}.${key}`),
      ])
    );
  }

  throw new Error(`${fieldName} contains unsupported JSON value type ${typeof value}.`);
};

const normalizeJsonObjectForInsert = (value: unknown, fieldName: string): JsonObject =>
  asJsonObject(normalizeJsonValueForInsert(value, fieldName), fieldName);

const assertPhase11RecommendationSnapshotContract = (args: {
  row:
    | CreateAdsOptimizerRecommendationSnapshotPayload
    | AdsOptimizerRecommendationSnapshot;
  index: number;
  fieldPrefix: string;
}) => {
  const reasonCodes =
    'reasonCodes' in args.row
      ? args.row.reasonCodes
      : args.row.reason_codes_json;
  const snapshotPayload =
    'snapshotPayload' in args.row
      ? args.row.snapshotPayload
      : args.row.snapshot_payload_json;
  const status = args.row.status;
  const actionType = 'actionType' in args.row ? args.row.actionType : args.row.action_type;
  const payload = asJsonObject(
    snapshotPayload,
    `${args.fieldPrefix}[${args.index}].snapshot_payload_json`
  );

  if (status === 'pending_phase5') {
    throw new Error(
      `${args.fieldPrefix}[${args.index}] attempted to persist legacy pending_phase5 recommendation rows during Phase 8.`
    );
  }
  if ((reasonCodes ?? []).some((code) => PHASE4_PLACEHOLDER_REASON_CODES.has(code))) {
    throw new Error(
      `${args.fieldPrefix}[${args.index}] still contains Phase 4 placeholder reason codes.`
    );
  }
  if (payload.execution_boundary !== 'read_only_recommendation_only') {
    throw new Error(
      `${args.fieldPrefix}[${args.index}] must persist execution_boundary=read_only_recommendation_only.`
    );
  }
  if (payload.workspace_handoff !== 'not_started') {
    throw new Error(
      `${args.fieldPrefix}[${args.index}] must persist workspace_handoff=not_started.`
    );
  }
  if (payload.writes_execution_tables !== false) {
    throw new Error(
      `${args.fieldPrefix}[${args.index}] must persist writes_execution_tables=false.`
    );
  }
  if (payload.phase !== 11) {
    throw new Error(`${args.fieldPrefix}[${args.index}] must persist phase=11 recommendation rows.`);
  }
  asJsonObject(
    payload.portfolio_controls,
    `${args.fieldPrefix}[${args.index}].snapshot_payload_json.portfolio_controls`
  );
  asJsonObject(
    payload.query_diagnostics,
    `${args.fieldPrefix}[${args.index}].snapshot_payload_json.query_diagnostics`
  );
  asJsonObject(
    payload.placement_diagnostics,
    `${args.fieldPrefix}[${args.index}].snapshot_payload_json.placement_diagnostics`
  );
  if (!Array.isArray(payload.exception_signals)) {
    throw new Error(
      `${args.fieldPrefix}[${args.index}].snapshot_payload_json.exception_signals must be an array.`
    );
  }
  if (status === 'generated' && (!actionType || actionType.trim().length === 0)) {
    throw new Error(
      `${args.fieldPrefix}[${args.index}] must persist action_type for generated recommendation rows.`
    );
  }
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

export const getAdsOptimizerRunById = async (runId: string): Promise<AdsOptimizerRun | null> => {
  const { data, error } = await supabaseAdmin
    .from('ads_optimizer_runs')
    .select(RUN_SELECT)
    .eq('run_id', runId)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read optimizer run ${runId}: ${error.message}`);
  }
  if (!data) return null;

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
  const preparedRows = rows.map((row, index) => ({
    ...row,
    reasonCodes: (row.reasonCodes ?? []).filter((code): code is string => typeof code === 'string'),
    snapshotPayload: normalizeJsonObjectForInsert(
      row.snapshotPayload,
      `ads_optimizer_recommendation_snapshot.insert[${index}].snapshot_payload_json`
    ),
  }));

  preparedRows.forEach((row, index) =>
    assertPhase11RecommendationSnapshotContract({
      row,
      index,
      fieldPrefix: 'ads_optimizer_recommendation_snapshot.insert',
    })
  );

  const { data, error } = await supabaseAdmin
    .from('ads_optimizer_recommendation_snapshot')
    .insert(
      preparedRows.map((row) => ({
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

  const mapped = ((data ?? []) as unknown as AdsOptimizerRecommendationSnapshotRow[]).map(
    mapAdsOptimizerRecommendationSnapshotRow
  );
  mapped.forEach((row, index) =>
    assertPhase11RecommendationSnapshotContract({
      row,
      index,
      fieldPrefix: 'ads_optimizer_recommendation_snapshot.persisted',
    })
  );
  return mapped;
};

export const insertAdsOptimizerRoleTransitionLogs = async (
  rows: CreateAdsOptimizerRoleTransitionLogPayload[]
): Promise<AdsOptimizerRoleTransitionLog[]> => {
  if (rows.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from('ads_optimizer_role_transition_log')
    .insert(
      rows.map((row) => ({
        run_id: row.runId,
        target_snapshot_id: row.targetSnapshotId,
        account_id: env.accountId,
        marketplace: env.marketplace,
        asin: row.asin,
        target_id: row.targetId,
        from_role: row.fromRole,
        to_role: row.toRole,
        transition_reason_json: row.transitionReason,
      }))
    )
    .select(ROLE_TRANSITION_LOG_SELECT);

  if (error) {
    throw new Error(`Failed to insert optimizer role transition logs: ${error.message}`);
  }

  return ((data ?? []) as unknown as AdsOptimizerRoleTransitionLogRow[]).map(
    mapAdsOptimizerRoleTransitionLogRow
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

export const listAdsOptimizerTargetSnapshotsByRun = async (
  runId: string
): Promise<AdsOptimizerTargetSnapshot[]> => {
  const { data, error } = await supabaseAdmin
    .from('ads_optimizer_target_snapshot')
    .select(TARGET_SNAPSHOT_SELECT)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .eq('run_id', runId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list optimizer target snapshots: ${error.message}`);
  }

  return ((data ?? []) as unknown as AdsOptimizerTargetSnapshotRow[]).map(
    mapAdsOptimizerTargetSnapshotRow
  );
};

export const listAdsOptimizerRecommendationSnapshotsByRun = async (
  runId: string
): Promise<AdsOptimizerRecommendationSnapshot[]> => {
  const { data, error } = await supabaseAdmin
    .from('ads_optimizer_recommendation_snapshot')
    .select(RECOMMENDATION_SNAPSHOT_SELECT)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .eq('run_id', runId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list optimizer recommendation snapshots: ${error.message}`);
  }

  return ((data ?? []) as unknown as AdsOptimizerRecommendationSnapshotRow[]).map(
    mapAdsOptimizerRecommendationSnapshotRow
  );
};

export const listAdsOptimizerProductSnapshotsByRun = async (
  runId: string
): Promise<AdsOptimizerProductSnapshot[]> => {
  const { data, error } = await supabaseAdmin
    .from('ads_optimizer_product_snapshot')
    .select(PRODUCT_SNAPSHOT_SELECT)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .eq('run_id', runId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list optimizer product snapshots: ${error.message}`);
  }

  return ((data ?? []) as unknown as AdsOptimizerProductSnapshotRow[]).map(
    mapAdsOptimizerProductSnapshotRow
  );
};

export const listAdsOptimizerRoleTransitionLogsByAsin = async (args: {
  asin: string;
  limit?: number;
}): Promise<AdsOptimizerRoleTransitionLog[]> => {
  const { data, error } = await supabaseAdmin
    .from('ads_optimizer_role_transition_log')
    .select(ROLE_TRANSITION_LOG_SELECT)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .eq('asin', args.asin)
    .order('created_at', { ascending: false })
    .limit(args.limit ?? 250);

  if (error) {
    throw new Error(`Failed to list optimizer role transition logs: ${error.message}`);
  }

  return ((data ?? []) as unknown as AdsOptimizerRoleTransitionLogRow[]).map(
    mapAdsOptimizerRoleTransitionLogRow
  );
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
