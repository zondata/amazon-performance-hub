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

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const experimentId = id?.trim();

  if (!experimentId) {
    return new Response('Missing experiment id.', { status: 400 });
  }

  const { data: experimentData, error: experimentError } = await supabaseAdmin
    .from('log_experiments')
    .select('experiment_id,marketplace')
    .eq('experiment_id', experimentId)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .maybeSingle();

  if (experimentError) {
    return new Response(`Failed loading experiment: ${experimentError.message}`, { status: 500 });
  }

  if (!experimentData) {
    return new Response('Experiment not found.', { status: 404 });
  }

  let bodyRaw: unknown;
  try {
    bodyRaw = await request.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  const body = asRecord(bodyRaw);
  if (!body) {
    return new Response('Body must be a JSON object.', { status: 400 });
  }

  const eventTypeText = asString(body.event_type);
  if (!eventTypeText || !SUPPORTED_EVENT_TYPES.has(eventTypeText as SupportedEventType)) {
    return new Response('event_type must be one of: guardrail_breach, manual_intervention, stop_loss, rollback.', {
      status: 400,
    });
  }
  const eventType = eventTypeText as SupportedEventType;

  const runId = asString(body.run_id);
  const notes = asString(body.notes);
  const payload = body.payload === undefined ? {} : asRecord(body.payload);
  if (body.payload !== undefined && !payload) {
    return new Response('payload must be an object when provided.', { status: 400 });
  }

  const experiment = experimentData as ExperimentRow;
  const now = new Date();
  const marketplaceDate = toMarketplaceDate(now, experiment.marketplace);
  const eventDate = body.event_date === undefined ? marketplaceDate : parseDateOnly(body.event_date);

  if (body.event_date !== undefined && !eventDate) {
    return new Response('event_date must be YYYY-MM-DD when provided.', { status: 400 });
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
      return new Response(`Failed resolving phase for run_id: ${phaseError.message}`, { status: 500 });
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
      occurred_at: now.toISOString(),
    })
    .select('id')
    .single();

  if (insertError || !insertedRow) {
    return new Response(`Failed inserting experiment event: ${insertError?.message ?? 'unknown error'}`, {
      status: 500,
    });
  }

  return Response.json({
    ok: true,
    id: (insertedRow as EventInsertRow).id,
  });
}
