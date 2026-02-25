import { validateIntentString } from '@/lib/logbook/driverIntent';
import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ asin: string; id: string }> };

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

export async function PATCH(request: Request, { params }: Ctx) {
  const { asin: rawAsin, id: rawId } = await params;
  const asin = normalizeAsin(rawAsin ?? '');
  const id = (rawId ?? '').trim();

  if (!asin || !id) {
    return new Response('Missing ASIN or intent id.', { status: 400 });
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

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (Object.prototype.hasOwnProperty.call(body, 'channel')) {
    const channel = normalizeChannel(body.channel);
    if (!channel) {
      return new Response('channel must be one of: sp, sb, sd.', { status: 400 });
    }
    patch.channel = channel;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'campaign_id')) {
    const campaignId = asString(body.campaign_id);
    if (!campaignId) {
      return new Response('campaign_id must be a non-empty string when provided.', { status: 400 });
    }
    patch.campaign_id = campaignId;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'intent')) {
    try {
      patch.intent = validateIntentString(String(body.intent ?? ''));
    } catch (error) {
      return new Response(error instanceof Error ? error.message : 'intent is invalid.', {
        status: 400,
      });
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'notes')) {
    patch.notes = asString(body.notes);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'is_driver')) {
    patch.is_driver = body.is_driver === true;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'updated_by')) {
    patch.updated_by = asString(body.updated_by);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'constraints_json')) {
    const constraints = asRecord(body.constraints_json);
    if (body.constraints_json !== null && !constraints) {
      return new Response('constraints_json must be an object or null when provided.', {
        status: 400,
      });
    }
    patch.constraints_json = constraints ?? {};
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('log_driver_campaign_intents')
    .update(patch)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .eq('asin_norm', asin)
    .eq('id', id)
    .select(selectFields)
    .maybeSingle();

  if (updateError) {
    return new Response(`Failed updating driver intent: ${updateError.message}`, { status: 500 });
  }

  if (!updated) {
    return new Response('Driver intent not found.', { status: 404 });
  }

  return Response.json({ ok: true, intent: updated });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { asin: rawAsin, id: rawId } = await params;
  const asin = normalizeAsin(rawAsin ?? '');
  const id = (rawId ?? '').trim();

  if (!asin || !id) {
    return new Response('Missing ASIN or intent id.', { status: 400 });
  }

  const { error: deleteError } = await supabaseAdmin
    .from('log_driver_campaign_intents')
    .delete()
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .eq('asin_norm', asin)
    .eq('id', id);

  if (deleteError) {
    return new Response(`Failed deleting driver intent: ${deleteError.message}`, { status: 500 });
  }

  return Response.json({ ok: true, id });
}
