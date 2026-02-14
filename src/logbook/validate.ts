import { LogChangeEntityInput, LogChangeInput, LogExperimentInput } from "./types";

type ParseResult<T> = { value: T; errors: string[] };

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function requiredString(value: unknown, field: string, errors: string[]): string {
  if (typeof value !== "string") {
    errors.push(`${field} is required and must be a string`);
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    errors.push(`${field} is required and must be non-empty`);
    return "";
  }
  return trimmed;
}

function optionalString(value: unknown, field: string, errors: string[]): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    errors.push(`${field} must be a string when provided`);
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function optionalNumber(value: unknown, field: string, errors: string[]): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${field} must be a finite number when provided`);
    return undefined;
  }
  return value;
}

function optionalIsoDate(value: unknown, field: string, errors: string[]): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    errors.push(`${field} must be a string when provided`);
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    errors.push(`${field} must be a valid date string when provided`);
    return undefined;
  }
  return trimmed;
}

function parseExperimentInputRaw(raw: unknown): ParseResult<LogExperimentInput> {
  const errors: string[] = [];
  if (!isRecord(raw)) {
    return { value: {} as LogExperimentInput, errors: ["Experiment JSON must be an object"] };
  }

  const name = requiredString(raw.name, "name", errors);
  const objective = requiredString(raw.objective, "objective", errors);

  const hypothesis = optionalString(raw.hypothesis, "hypothesis", errors);
  const evaluation_lag_days = optionalNumber(raw.evaluation_lag_days, "evaluation_lag_days", errors);
  const evaluation_window_days = optionalNumber(raw.evaluation_window_days, "evaluation_window_days", errors);

  return {
    value: {
      name,
      objective,
      hypothesis,
      evaluation_lag_days,
      evaluation_window_days,
      primary_metrics: raw.primary_metrics,
      guardrails: raw.guardrails,
      scope: raw.scope,
    },
    errors,
  };
}

function parseEntityInputRaw(raw: unknown, index: number): ParseResult<LogChangeEntityInput> {
  const errors: string[] = [];
  if (!isRecord(raw)) {
    return {
      value: {} as LogChangeEntityInput,
      errors: [`entities[${index}] must be an object`],
    };
  }

  const entity_type = requiredString(raw.entity_type, `entities[${index}].entity_type`, errors);

  const product_id = optionalString(raw.product_id, `entities[${index}].product_id`, errors);
  const campaign_id = optionalString(raw.campaign_id, `entities[${index}].campaign_id`, errors);
  const ad_group_id = optionalString(raw.ad_group_id, `entities[${index}].ad_group_id`, errors);
  const target_id = optionalString(raw.target_id, `entities[${index}].target_id`, errors);
  const keyword_id = optionalString(raw.keyword_id, `entities[${index}].keyword_id`, errors);
  const note = optionalString(raw.note, `entities[${index}].note`, errors);

  return {
    value: {
      entity_type,
      product_id,
      campaign_id,
      ad_group_id,
      target_id,
      keyword_id,
      note,
      extra: raw.extra,
    },
    errors,
  };
}

function parseChangeInputRaw(raw: unknown): ParseResult<LogChangeInput> {
  const errors: string[] = [];
  if (!isRecord(raw)) {
    return { value: {} as LogChangeInput, errors: ["Change JSON must be an object"] };
  }

  const channel = requiredString(raw.channel, "channel", errors);
  const change_type = requiredString(raw.change_type, "change_type", errors);
  const summary = requiredString(raw.summary, "summary", errors);

  const occurred_at = optionalIsoDate(raw.occurred_at, "occurred_at", errors);
  const why = optionalString(raw.why, "why", errors);
  const source = optionalString(raw.source, "source", errors);
  const source_upload_id = optionalString(raw.source_upload_id, "source_upload_id", errors);

  const entitiesRaw = raw.entities;
  const entities: LogChangeEntityInput[] = [];
  if (!Array.isArray(entitiesRaw)) {
    errors.push("entities is required and must be an array");
  } else {
    entitiesRaw.forEach((entity, idx) => {
      const parsed = parseEntityInputRaw(entity, idx);
      entities.push(parsed.value);
      errors.push(...parsed.errors);
    });
  }

  return {
    value: {
      occurred_at,
      channel,
      change_type,
      summary,
      why,
      before_json: raw.before_json,
      after_json: raw.after_json,
      source,
      source_upload_id,
      entities,
    },
    errors,
  };
}

function throwIfErrors(errors: string[], label: string) {
  if (!errors.length) return;
  const message = `${label} validation failed:\n- ${errors.join("\n- ")}`;
  throw new Error(message);
}

export function parseExperimentInput(raw: unknown): LogExperimentInput {
  const result = parseExperimentInputRaw(raw);
  throwIfErrors(result.errors, "Experiment");
  return result.value;
}

export function parseChangeInput(raw: unknown): LogChangeInput {
  const result = parseChangeInputRaw(raw);
  throwIfErrors(result.errors, "Change");
  return result.value;
}
