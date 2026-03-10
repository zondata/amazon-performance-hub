export const ADS_OPTIMIZER_RUN_STATUSES = [
  'pending',
  'running',
  'completed',
  'failed',
] as const;
export const ADS_OPTIMIZER_RUN_KINDS = ['manual'] as const;
export const ADS_OPTIMIZER_RECOMMENDATION_SNAPSHOT_STATUSES = [
  'pending_phase5',
  'generated',
  'skipped',
] as const;

export type JsonObject = Record<string, unknown>;

export type AdsOptimizerRunStatus = (typeof ADS_OPTIMIZER_RUN_STATUSES)[number];
export type AdsOptimizerRunKind = (typeof ADS_OPTIMIZER_RUN_KINDS)[number];
export type AdsOptimizerRecommendationSnapshotStatus =
  (typeof ADS_OPTIMIZER_RECOMMENDATION_SNAPSHOT_STATUSES)[number];

export type AdsOptimizerRun = {
  run_id: string;
  account_id: string;
  marketplace: string;
  channel: 'sp';
  scope_type: 'product';
  selected_asin: string;
  run_kind: AdsOptimizerRunKind;
  date_start: string;
  date_end: string;
  rule_pack_version_id: string;
  rule_pack_version_label: string;
  status: AdsOptimizerRunStatus;
  input_summary_json: JsonObject;
  diagnostics_json: JsonObject | null;
  product_snapshot_count: number;
  target_snapshot_count: number;
  recommendation_snapshot_count: number;
  role_transition_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type AdsOptimizerProductSnapshot = {
  product_snapshot_id: string;
  run_id: string;
  account_id: string;
  marketplace: string;
  product_id: string | null;
  asin: string;
  snapshot_payload_json: JsonObject;
  created_at: string;
};

export type AdsOptimizerTargetSnapshot = {
  target_snapshot_id: string;
  run_id: string;
  account_id: string;
  marketplace: string;
  asin: string;
  campaign_id: string;
  ad_group_id: string;
  target_id: string;
  source_scope: string;
  coverage_note: string | null;
  snapshot_payload_json: JsonObject;
  created_at: string;
};

export type AdsOptimizerRecommendationSnapshot = {
  recommendation_snapshot_id: string;
  run_id: string;
  target_snapshot_id: string;
  account_id: string;
  marketplace: string;
  asin: string;
  status: AdsOptimizerRecommendationSnapshotStatus;
  action_type: string | null;
  reason_codes_json: string[] | null;
  snapshot_payload_json: JsonObject;
  created_at: string;
};

export type AdsOptimizerRoleTransitionLog = {
  role_transition_log_id: string;
  run_id: string;
  target_snapshot_id: string | null;
  account_id: string;
  marketplace: string;
  asin: string;
  target_id: string | null;
  from_role: string | null;
  to_role: string | null;
  transition_reason_json: JsonObject | null;
  created_at: string;
};

export type CreateAdsOptimizerRoleTransitionLogPayload = {
  runId: string;
  targetSnapshotId: string | null;
  asin: string;
  targetId: string | null;
  fromRole: string | null;
  toRole: string | null;
  transitionReason: JsonObject | null;
};

export type AdsOptimizerRunRow = Omit<
  AdsOptimizerRun,
  'input_summary_json' | 'diagnostics_json'
> & {
  input_summary_json: unknown;
  diagnostics_json: unknown | null;
};

export type AdsOptimizerProductSnapshotRow = Omit<
  AdsOptimizerProductSnapshot,
  'snapshot_payload_json'
> & {
  snapshot_payload_json: unknown;
};

export type AdsOptimizerTargetSnapshotRow = Omit<
  AdsOptimizerTargetSnapshot,
  'snapshot_payload_json'
> & {
  snapshot_payload_json: unknown;
};

export type AdsOptimizerRecommendationSnapshotRow = Omit<
  AdsOptimizerRecommendationSnapshot,
  'reason_codes_json' | 'snapshot_payload_json'
> & {
  reason_codes_json: unknown | null;
  snapshot_payload_json: unknown;
};

export type AdsOptimizerRoleTransitionLogRow = Omit<
  AdsOptimizerRoleTransitionLog,
  'transition_reason_json'
> & {
  transition_reason_json: unknown | null;
};

const asJsonObject = (value: unknown, fieldName: string): JsonObject => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object.`);
  }
  return value as JsonObject;
};

const asNullableJsonObject = (value: unknown, fieldName: string): JsonObject | null => {
  if (value === null || value === undefined) return null;
  return asJsonObject(value, fieldName);
};

const asNullableStringArray = (value: unknown, fieldName: string): string[] | null => {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`${fieldName} must be an array of strings.`);
  }
  return value as string[];
};

export const mapAdsOptimizerRunRow = (row: AdsOptimizerRunRow): AdsOptimizerRun => ({
  ...row,
  channel: row.channel as 'sp',
  scope_type: row.scope_type as 'product',
  run_kind: row.run_kind as AdsOptimizerRunKind,
  status: row.status as AdsOptimizerRunStatus,
  input_summary_json: asJsonObject(row.input_summary_json, 'ads_optimizer_runs.input_summary_json'),
  diagnostics_json: asNullableJsonObject(
    row.diagnostics_json,
    'ads_optimizer_runs.diagnostics_json'
  ),
});

export const mapAdsOptimizerProductSnapshotRow = (
  row: AdsOptimizerProductSnapshotRow
): AdsOptimizerProductSnapshot => ({
  ...row,
  snapshot_payload_json: asJsonObject(
    row.snapshot_payload_json,
    'ads_optimizer_product_snapshot.snapshot_payload_json'
  ),
});

export const mapAdsOptimizerTargetSnapshotRow = (
  row: AdsOptimizerTargetSnapshotRow
): AdsOptimizerTargetSnapshot => ({
  ...row,
  snapshot_payload_json: asJsonObject(
    row.snapshot_payload_json,
    'ads_optimizer_target_snapshot.snapshot_payload_json'
  ),
});

export const mapAdsOptimizerRecommendationSnapshotRow = (
  row: AdsOptimizerRecommendationSnapshotRow
): AdsOptimizerRecommendationSnapshot => ({
  ...row,
  status: row.status as AdsOptimizerRecommendationSnapshotStatus,
  reason_codes_json: asNullableStringArray(
    row.reason_codes_json,
    'ads_optimizer_recommendation_snapshot.reason_codes_json'
  ),
  snapshot_payload_json: asJsonObject(
    row.snapshot_payload_json,
    'ads_optimizer_recommendation_snapshot.snapshot_payload_json'
  ),
});

export const mapAdsOptimizerRoleTransitionLogRow = (
  row: AdsOptimizerRoleTransitionLogRow
): AdsOptimizerRoleTransitionLog => ({
  ...row,
  transition_reason_json: asNullableJsonObject(
    row.transition_reason_json,
    'ads_optimizer_role_transition_log.transition_reason_json'
  ),
});
