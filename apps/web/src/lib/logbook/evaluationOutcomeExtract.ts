type JsonObject = Record<string, unknown>;

const asObject = (value: unknown): JsonObject | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonObject;
};

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export const extractEvaluationOutcome = (metrics_json: unknown): {
  score: number | null;
  label: 'success' | 'mixed' | 'fail' | null;
  summary: string | null;
  next_steps: string | null;
} => {
  const metrics = asObject(metrics_json);
  const outcome = asObject(metrics?.outcome);
  const labelRaw = asTrimmedString(outcome?.label);

  return {
    score: asFiniteNumber(outcome?.score),
    label: labelRaw === 'success' || labelRaw === 'mixed' || labelRaw === 'fail' ? labelRaw : null,
    summary: asTrimmedString(metrics?.summary),
    next_steps: asTrimmedString(metrics?.next_steps),
  };
};
