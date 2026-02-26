import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { toMarketplaceDate } from '@/lib/time/marketplaceDate';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

type JsonRecord = Record<string, unknown>;

type ExperimentRow = {
  experiment_id: string;
  marketplace: string;
};

type PhaseLookupRow = {
  id: string;
};

type EventInsertRow = {
  id: string;
};

type SupportedEventType = 'guardrail_breach' | 'manual_intervention' | 'stop_loss' | 'rollback';

const SUPPORTED_EVENT_TYPES = new Set<SupportedEventType>([
  'guardrail_breach',
  'manual_intervention',
  'stop_loss',
  'rollback',
]);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const asRecord = (value: unknown): JsonRecord | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonRecord;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseDateOnly = (value: unknown): string | null => {
  const text = asString(value);
  if (!text || !DATE_RE.test(text)) return null;
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === text ? text : null;
};

const parseDateTime = (value: unknown): Date | null => {
  const text = asString(value);
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const jsonFailure = (
  status: number,
  error: string,
  details?: Record<string, unknown>
) =>
  Response.json(
    {
      ok: false,
      error,
      ...(details ? { details } : {}),
    },
    { status }
  );

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const experimentId = id?.trim();

  if (!experimentId) {
    return jsonFailure(400, 'Missing experiment id.', {
      code: 'missing_experiment_id',
    });
  }

  const { data: experimentData, error: experimentError } = await supabaseAdmin
    .from('log_experiments')
    .select('experiment_id,marketplace')
    .eq('experiment_id', experimentId)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .maybeSingle();

  if (experimentError) {
    return jsonFailure(500, `Failed loading experiment: ${experimentError.message}`, {
      code: 'experiment_load_failed',
      experiment_id: experimentId,
    });
  }

  if (!experimentData) {
    return jsonFailure(404, 'Experiment not found.', {
      code: 'experiment_not_found',
      experiment_id: experimentId,
    });
  }

  let bodyRaw: unknown;
  try {
    bodyRaw = await request.json();
  } catch {
    return jsonFailure(400, 'Invalid JSON body.', {
      code: 'invalid_json',
    });
  }

  const body = asRecord(bodyRaw);
  if (!body) {
    return jsonFailure(400, 'Body must be a JSON object.', {
      code: 'body_not_object',
    });
  }

  const eventTypeText = asString(body.event_type);
  if (!eventTypeText || !SUPPORTED_EVENT_TYPES.has(eventTypeText as SupportedEventType)) {
    return jsonFailure(
      400,
      'event_type must be one of: guardrail_breach, manual_intervention, stop_loss, rollback.',
      {
        code: 'invalid_event_type',
      }
    );
  }
  const eventType = eventTypeText as SupportedEventType;

  const runId = asString(body.run_id);
  const notes = asString(body.notes);
  const payload = body.payload === undefined ? {} : asRecord(body.payload);
  if (body.payload !== undefined && !payload) {
    return jsonFailure(400, 'payload must be an object when provided.', {
      code: 'invalid_payload',
    });
  }

  const experiment = experimentData as ExperimentRow;
  const occurredAtOverride = body.occurred_at === undefined ? null : parseDateTime(body.occurred_at);
  if (body.occurred_at !== undefined && !occurredAtOverride) {
    return jsonFailure(400, 'occurred_at must be a valid datetime when provided.', {
      code: 'invalid_occurred_at',
    });
  }
  const occurredAt = occurredAtOverride ?? new Date();

  const marketplaceDate = toMarketplaceDate(occurredAt, experiment.marketplace);
  const eventDate = body.event_date === undefined ? marketplaceDate : parseDateOnly(body.event_date);

  if (body.event_date !== undefined && !eventDate) {
    return jsonFailure(400, 'event_date must be YYYY-MM-DD when provided.', {
      code: 'invalid_event_date',
    });
  }

  let phaseId: string | null = null;
  if (runId) {
    const { data: phaseRow, error: phaseError } = await supabaseAdmin
      .from('log_experiment_phases')
      .select('id')
      .eq('experiment_id', experimentId)
      .eq('run_id', runId)
      .maybeSingle();

    if (phaseError) {
      return jsonFailure(500, `Failed resolving phase for run_id: ${phaseError.message}`, {
        code: 'phase_lookup_failed',
        experiment_id: experimentId,
        run_id: runId,
      });
    }

    phaseId = (phaseRow as PhaseLookupRow | null)?.id ?? null;
  }

  const payloadJson: JsonRecord = {
    ...(payload ?? {}),
  };
  if (notes) {
    payloadJson.notes = notes;
  }

  const { data: insertedRow, error: insertError } = await supabaseAdmin
    .from('log_experiment_events')
    .insert({
      experiment_id: experimentId,
      run_id: runId ?? null,
      phase_id: phaseId,
      event_type: eventType,
      event_date: eventDate,
      payload_json: payloadJson,
      occurred_at: occurredAt.toISOString(),
    })
    .select('id')
    .single();

  if (insertError || !insertedRow) {
    return jsonFailure(
      500,
      `Failed inserting experiment event: ${insertError?.message ?? 'unknown error'}`,
      {
        code: 'event_insert_failed',
        experiment_id: experimentId,
        run_id: runId ?? null,
        event_type: eventType,
      }
    );
  }

  return Response.json({
    ok: true,
    id: (insertedRow as EventInsertRow).id,
  });
}
