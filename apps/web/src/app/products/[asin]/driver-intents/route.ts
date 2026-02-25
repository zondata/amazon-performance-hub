import { validateIntentString } from '@/lib/logbook/driverIntent';
import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ asin: string }> };

type JsonRecord = Record<string, unknown>;

type Channel = 'sp' | 'sb' | 'sd';

const CHANNELS = new Set<Channel>(['sp', 'sb', 'sd']);

const asRecord = (value: unknown): JsonRecord | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonRecord;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeAsin = (value: string): string => value.trim().toUpperCase();

const normalizeChannel = (value: unknown): Channel | null => {
  const text = asString(value);
  if (!text) return null;
  const normalized = text.toLowerCase();
  if (!CHANNELS.has(normalized as Channel)) return null;
  return normalized as Channel;
};

const selectFields =
  'id,account_id,marketplace,asin_norm,created_at,updated_at,created_by,updated_by,channel,campaign_id,intent,is_driver,notes,constraints_json';

export async function GET(_request: Request, { params }: Ctx) {
  const { asin: rawAsin } = await params;
  const asin = normalizeAsin(rawAsin ?? '');
  if (!asin) {
    return new Response('Missing ASIN.', { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('log_driver_campaign_intents')
    .select(selectFields)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .eq('asin_norm', asin)
    .order('updated_at', { ascending: false })
    .limit(10000);

  if (error) {
    return new Response(`Failed loading driver intents: ${error.message}`, { status: 500 });
  }

  return Response.json({ ok: true, intents: data ?? [] });
}

export async function POST(request: Request, { params }: Ctx) {
  const { asin: rawAsin } = await params;
  const asin = normalizeAsin(rawAsin ?? '');
  if (!asin) {
    return new Response('Missing ASIN.', { status: 400 });
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

  const channel = normalizeChannel(body.channel);
  if (!channel) {
    return new Response('channel must be one of: sp, sb, sd.', { status: 400 });
  }

  const campaignId = asString(body.campaign_id);
  if (!campaignId) {
    return new Response('campaign_id is required.', { status: 400 });
  }

  let intent: string;
  try {
    intent = validateIntentString(String(body.intent ?? ''));
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'intent is invalid.', {
      status: 400,
    });
  }

  const notes = asString(body.notes);
  const createdBy = asString(body.created_by);
  const updatedBy = asString(body.updated_by);
  const constraints = body.constraints_json === undefined ? {} : asRecord(body.constraints_json);
  if (body.constraints_json !== undefined && !constraints) {
    return new Response('constraints_json must be an object when provided.', { status: 400 });
  }

  const isDriver = body.is_driver === undefined ? true : body.is_driver === true;

  const { data: upserted, error: upsertError } = await supabaseAdmin
    .from('log_driver_campaign_intents')
    .upsert(
      {
        account_id: env.accountId,
        marketplace: env.marketplace,
        asin_norm: asin,
        channel,
        campaign_id: campaignId,
        intent,
        is_driver: isDriver,
        notes: notes ?? null,
        constraints_json: constraints ?? {},
        created_by: createdBy,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'account_id,marketplace,asin_norm,channel,campaign_id',
      }
    )
    .select(selectFields)
    .single();

  if (upsertError || !upserted) {
    return new Response(`Failed upserting driver intent: ${upsertError?.message ?? 'unknown error'}`, {
      status: 500,
    });
  }

  return Response.json({ ok: true, intent: upserted });
}
