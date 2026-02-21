export type ExperimentFormPayload = {
  name?: string | null;
  objective?: string | null;
  hypothesis?: string | null;
  status?: string | null;
  product_id?: string | null;
  evaluation_lag_days?: number | null;
  evaluation_window_days?: number | null;
  primary_metrics?: unknown;
  guardrails?: unknown;
};

export type ChangeEntityFormPayload = {
  entity_type?: string | null;
  product_id?: string | null;
  campaign_id?: string | null;
  ad_group_id?: string | null;
  target_id?: string | null;
  keyword_id?: string | null;
  note?: string | null;
};

export type ChangeFormPayload = {
  occurred_at?: string | null;
  channel?: string | null;
  change_type?: string | null;
  summary?: string | null;
  why?: string | null;
  source?: string | null;
  before_json?: unknown;
  after_json?: unknown;
  entities?: ChangeEntityFormPayload[] | null;
};

export type ValidationResult<T> = {
  value: T;
  errors: string[];
};

const optionalTrimmed = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

export const safeParseJson = (raw: string, fieldLabel: string) => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { value: undefined as unknown, error: undefined };
  }
  try {
    return { value: JSON.parse(trimmed), error: undefined };
  } catch {
    return { value: undefined as unknown, error: `${fieldLabel} must be valid JSON` };
  }
};

export const validateExperimentPayload = (
  payload: ExperimentFormPayload
): ValidationResult<Required<ExperimentFormPayload>> => {
  const errors: string[] = [];
  const name = optionalTrimmed(payload.name);
  const objective = optionalTrimmed(payload.objective);
  const hypothesis = optionalTrimmed(payload.hypothesis);
  const status = optionalTrimmed(payload.status) ?? 'planned';
  const product_id = optionalTrimmed(payload.product_id) ?? null;

  const evaluation_lag_days =
    typeof payload.evaluation_lag_days === 'number'
      ? payload.evaluation_lag_days
      : undefined;
  const evaluation_window_days =
    typeof payload.evaluation_window_days === 'number'
      ? payload.evaluation_window_days
      : undefined;

  if (!name) errors.push('name is required');
  if (!objective) errors.push('objective is required');

  return {
    value: {
      name: name ?? '',
      objective: objective ?? '',
      hypothesis: hypothesis ?? null,
      status,
      product_id,
      evaluation_lag_days: evaluation_lag_days ?? null,
      evaluation_window_days: evaluation_window_days ?? null,
      primary_metrics: payload.primary_metrics ?? null,
      guardrails: payload.guardrails ?? null,
    },
    errors,
  };
};

export const validateChangePayload = (
  payload: ChangeFormPayload
): ValidationResult<Required<ChangeFormPayload>> => {
  const errors: string[] = [];
  const channel = optionalTrimmed(payload.channel);
  const change_type = optionalTrimmed(payload.change_type);
  const summary = optionalTrimmed(payload.summary);
  const why = optionalTrimmed(payload.why) ?? null;
  const source = optionalTrimmed(payload.source) ?? 'manual';
  const occurred_at = optionalTrimmed(payload.occurred_at) ?? null;

  if (!channel) errors.push('channel is required');
  if (!change_type) errors.push('change_type is required');
  if (!summary) errors.push('summary is required');

  const entities = Array.isArray(payload.entities) ? payload.entities : [];

  return {
    value: {
      occurred_at,
      channel: channel ?? '',
      change_type: change_type ?? '',
      summary: summary ?? '',
      why,
      source,
      before_json: payload.before_json ?? null,
      after_json: payload.after_json ?? null,
      entities,
    },
    errors,
  };
};
