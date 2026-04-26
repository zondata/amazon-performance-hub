export type LogExperimentInput = {
  name: string;
  objective: string;
  hypothesis?: string;
  evaluation_lag_days?: number;
  evaluation_window_days?: number;
  primary_metrics?: unknown;
  guardrails?: unknown;
  scope?: unknown;
};

export type LogExperimentRow = LogExperimentInput & {
  experiment_id: string;
  account_id: string;
  marketplace: string;
  created_at: string;
};

export type LogChangeEntityInput = {
  entity_type: string;
  product_id?: string;
  asin?: string;
  sku?: string;
  campaign_id?: string;
  ad_group_id?: string;
  target_id?: string;
  keyword_id?: string;
  note?: string;
  extra?: unknown;
};

export type LogChangeInput = {
  occurred_at?: string;
  channel: string;
  change_type: string;
  summary: string;
  why?: string;
  expected_outcome?: string;
  evaluation_window_days?: number;
  notes?: string;
  before_json?: unknown;
  after_json?: unknown;
  dedupe_key?: string;
  source?: string;
  source_upload_id?: string;
  entities: LogChangeEntityInput[];
};

export type LogChangeRow = LogChangeInput & {
  change_id: string;
  account_id: string;
  marketplace: string;
  created_at: string;
  dedupe_key?: string;
};

export type ChangeOutcomeEvaluationInput = {
  change_id: string;
  evaluated_at?: string;
  window_start?: string;
  window_end?: string;
  actual_result?: string;
  learning?: string;
  notes?: string;
  metrics_json?: unknown;
};

export type ChangeOutcomeEvaluationRow = ChangeOutcomeEvaluationInput & {
  evaluation_id: string;
  account_id: string;
  marketplace: string;
  created_at: string;
};
