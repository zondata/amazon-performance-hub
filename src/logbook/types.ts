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
  before_json?: unknown;
  after_json?: unknown;
  source?: string;
  source_upload_id?: string;
  entities: LogChangeEntityInput[];
};

export type LogChangeRow = LogChangeInput & {
  change_id: string;
  account_id: string;
  marketplace: string;
  created_at: string;
};
