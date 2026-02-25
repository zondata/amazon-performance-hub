import { normalizeKivStatus } from '@/lib/logbook/kiv';
import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ asin: string; kivId: string }> };

type JsonRecord = Record<string, unknown>;

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

const asStringArray = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const parsed = asString(entry);
    if (!parsed || seen.has(parsed)) continue;
    seen.add(parsed);
    out.push(parsed);
  }
  return out;
};

const asOptionalInt = (value: unknown): number | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.floor(parsed);
};

const asOptionalDate = (value: unknown): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const text = asString(value);
  if (!text || !DATE_RE.test(text)) return undefined;
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10) === text ? text : undefined;
};

const normalizeAsin = (value: string): string => value.trim().toUpperCase();

const selectFields =
  'kiv_id,account_id,marketplace,asin_norm,created_at,created_by,status,title,details,source,source_experiment_id,tags,priority,due_date,resolved_at,resolution_notes';

export async function PATCH(request: Request, { params }: Ctx) {
  const { asin: rawAsin, kivId: rawKivId } = await params;
  const asin = normalizeAsin(rawAsin ?? '');
  const kivId = (rawKivId ?? '').trim();

  if (!asin || !kivId) {
    return new Response('Missing ASIN or KIV id.', { status: 400 });
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

  const patch: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    const status = normalizeKivStatus(body.status);
    patch.status = status;
    patch.resolved_at = status === 'open' ? null : new Date().toISOString();
  }

  if (Object.prototype.hasOwnProperty.call(body, 'title')) {
    const title = asString(body.title);
    if (!title) {
      return new Response('title must be a non-empty string when provided.', { status: 400 });
    }
    patch.title = title;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'details')) {
    patch.details = asString(body.details);
  }

  if (
    Object.prototype.hasOwnProperty.call(body, 'resolution_notes') ||
    Object.prototype.hasOwnProperty.call(body, 'notes')
  ) {
    const resolutionNotes = asString(body.resolution_notes ?? body.notes);
    patch.resolution_notes = resolutionNotes;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'tags')) {
    const tags = asStringArray(body.tags);
    if (tags === null) {
      return new Response('tags must be an array of strings when provided.', { status: 400 });
    }
    patch.tags = tags;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'priority')) {
    const priority = asOptionalInt(body.priority);
    if (priority === undefined) {
      return new Response('priority must be a number when provided.', { status: 400 });
    }
    patch.priority = priority;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'due_date')) {
    const dueDate = asOptionalDate(body.due_date);
    if (dueDate === undefined) {
      return new Response('due_date must be YYYY-MM-DD when provided.', { status: 400 });
    }
    patch.due_date = dueDate;
  }

  if (Object.keys(patch).length === 0) {
    return new Response('No supported fields provided for update.', { status: 400 });
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('log_product_kiv_items')
    .update(patch)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .eq('asin_norm', asin)
    .eq('kiv_id', kivId)
    .select(selectFields)
    .maybeSingle();

  if (updateError) {
    return new Response(`Failed updating KIV item: ${updateError.message}`, { status: 500 });
  }

  if (!updated) {
    return new Response('KIV item not found.', { status: 404 });
  }

  return Response.json({ ok: true, item: updated });
}
