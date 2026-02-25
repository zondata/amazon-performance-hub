const PACK_KIND = 'aph_experiment_evaluation_pack_v1';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type JsonRecord = Record<string, unknown>;

export type ParsedExperimentEvaluationOutputPack = {
  kind: typeof PACK_KIND;
  experiment_id: string;
  product_asin: string;
  evaluation: {
    summary: string;
    outcome: {
      score: number;
      label: 'success' | 'mixed' | 'fail';
      confidence: number;
      tags: string[];
    };
    why: string[];
    next_steps: string[];
    notes: string | null;
    mark_complete: boolean;
    kiv_updates: Array<{
      kiv_id?: string;
      title?: string;
      status: 'open' | 'done' | 'dismissed';
      resolution_notes?: string;
    }>;
  };
};

export type ParseExperimentEvaluationOutputPackResult =
  | { ok: true; value: ParsedExperimentEvaluationOutputPack }
  | { ok: false; error: string };

const asRecord = (value: unknown): JsonRecord | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonRecord;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeAsin = (value: unknown): string | null => {
  const text = asString(value);
  return text ? text.toUpperCase() : null;
};

const normalizeKivStatus = (value: unknown): 'open' | 'done' | 'dismissed' | null => {
  const text = asString(value);
  if (!text) return null;
  const normalized = text.toLowerCase();
  if (normalized === 'open' || normalized === 'done' || normalized === 'dismissed') {
    return normalized;
  }
  return null;
};

const uniqueStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  for (const entry of value) {
    const text = asString(entry);
    if (!text) continue;
    unique.add(text);
  }
  return Array.from(unique.values());
};

export const parseExperimentEvaluationOutputPack = (
  rawText: string,
  options?: {
    expectedAsin?: string;
    expectedExperimentId?: string;
  }
): ParseExperimentEvaluationOutputPackResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, error: 'Invalid JSON payload.' };
  }

  const root = asRecord(parsed);
  if (!root) {
    return { ok: false, error: 'Payload must be a JSON object.' };
  }

  const kind = asString(root.kind);
  if (kind !== PACK_KIND) {
    return { ok: false, error: `kind must be ${PACK_KIND}.` };
  }

  const diagnosticOk = root.ok;
  if (diagnosticOk === false) {
    const questions = uniqueStringArray(root.questions);
    return {
      ok: false,
      error:
        questions.length > 0
          ? `AI evaluation output marked ok=false with questions:\n- ${questions.join('\n- ')}`
          : 'AI evaluation output marked ok=false.',
    };
  }

  const experimentId = asString(root.experiment_id);
  if (!experimentId || !UUID_RE.test(experimentId)) {
    return { ok: false, error: 'experiment_id is required and must be a UUID.' };
  }

  const expectedExperimentId = asString(options?.expectedExperimentId);
  if (expectedExperimentId && expectedExperimentId !== experimentId) {
    return {
      ok: false,
      error: `experiment_id (${experimentId}) must match selected experiment (${expectedExperimentId}).`,
    };
  }

  const product = asRecord(root.product);
  const productAsin = normalizeAsin(product?.asin);
  if (!productAsin) {
    return { ok: false, error: 'Missing required field: product.asin.' };
  }

  const expectedAsin = normalizeAsin(options?.expectedAsin);
  if (expectedAsin && expectedAsin !== productAsin) {
    return {
      ok: false,
      error: `product.asin (${productAsin}) must match expected ASIN (${expectedAsin}).`,
    };
  }

  const evaluation = asRecord(root.evaluation);
  if (!evaluation) {
    return { ok: false, error: 'Missing required object: evaluation.' };
  }

  const summary = asString(evaluation.summary);
  if (!summary) {
    return { ok: false, error: 'evaluation.summary is required.' };
  }

  const outcome = asRecord(evaluation.outcome);
  if (!outcome) {
    return { ok: false, error: 'evaluation.outcome is required.' };
  }

  const score = asNumber(outcome.score);
  if (score === null || score < 0 || score > 100) {
    return { ok: false, error: 'evaluation.outcome.score must be a number from 0 to 100.' };
  }

  const label = asString(outcome.label);
  if (label !== 'success' && label !== 'mixed' && label !== 'fail') {
    return { ok: false, error: 'evaluation.outcome.label must be success|mixed|fail.' };
  }

  const confidence = asNumber(outcome.confidence);
  if (confidence === null || confidence < 0 || confidence > 1) {
    return { ok: false, error: 'evaluation.outcome.confidence must be a number from 0 to 1.' };
  }

  const tags = uniqueStringArray(outcome.tags);

  const why = uniqueStringArray(evaluation.why);
  const nextSteps = uniqueStringArray(evaluation.next_steps);
  const notes = asString(evaluation.notes);
  const markComplete = evaluation.mark_complete !== false;
  const kivUpdates: Array<{
    kiv_id?: string;
    title?: string;
    status: 'open' | 'done' | 'dismissed';
    resolution_notes?: string;
  }> = [];
  const kivUpdatesRaw = evaluation.kiv_updates;
  if (kivUpdatesRaw !== undefined) {
    if (!Array.isArray(kivUpdatesRaw)) {
      return { ok: false, error: 'evaluation.kiv_updates must be an array when provided.' };
    }

    for (let index = 0; index < kivUpdatesRaw.length; index += 1) {
      const row = asRecord(kivUpdatesRaw[index]);
      if (!row) {
        return { ok: false, error: `evaluation.kiv_updates[${index}] must be an object.` };
      }

      const kivId = asString(row.kiv_id) ?? undefined;
      const title = asString(row.title) ?? undefined;
      const status = normalizeKivStatus(row.status);
      if (!status) {
        return {
          ok: false,
          error: `evaluation.kiv_updates[${index}].status must be open|done|dismissed.`,
        };
      }
      if (!kivId && !title) {
        return {
          ok: false,
          error: `evaluation.kiv_updates[${index}] requires kiv_id or title.`,
        };
      }

      kivUpdates.push({
        ...(kivId ? { kiv_id: kivId } : {}),
        ...(title ? { title } : {}),
        status,
        ...(asString(row.resolution_notes) ? { resolution_notes: asString(row.resolution_notes) as string } : {}),
      });
    }
  }

  return {
    ok: true,
    value: {
      kind: PACK_KIND,
      experiment_id: experimentId,
      product_asin: productAsin,
      evaluation: {
        summary,
        outcome: {
          score,
          label,
          confidence,
          tags,
        },
        why,
        next_steps: nextSteps,
        notes,
        mark_complete: markComplete,
        kiv_updates: kivUpdates,
      },
    },
  };
};

export const EXPERIMENT_EVALUATION_OUTPUT_PACK_KIND = PACK_KIND;
