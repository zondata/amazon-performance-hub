import { deriveKivCarryForward } from '@/lib/logbook/kiv';
import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ asin: string }> };

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

const loadRows = async (asinNorm: string) => {
  const { data, error } = await supabaseAdmin
    .from('log_product_kiv_items')
    .select(selectFields)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .eq('asin_norm', asinNorm)
    .order('created_at', { ascending: false })
    .limit(10000);

  if (error) {
    throw new Error(`Failed loading KIV backlog: ${error.message}`);
  }

  return data ?? [];
};

export async function GET(_request: Request, { params }: Ctx) {
  const { asin: rawAsin } = await params;
  const asin = normalizeAsin(rawAsin ?? '');
  if (!asin) {
    return new Response('Missing ASIN.', { status: 400 });
  }

  try {
    const items = await loadRows(asin);
    return Response.json({
      ok: true,
      asin,
      kiv_backlog: deriveKivCarryForward(items),
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Failed loading KIV backlog.', {
      status: 500,
    });
  }
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

  const title = asString(body.title);
  if (!title) {
    return new Response('title is required.', { status: 400 });
  }

  const details = asString(body.details);
  const tags = body.tags === undefined ? [] : asStringArray(body.tags);
  if (body.tags !== undefined && tags === null) {
    return new Response('tags must be an array of strings when provided.', { status: 400 });
  }

  const priority = asOptionalInt(body.priority);
  if (body.priority !== undefined && priority === undefined) {
    return new Response('priority must be a number when provided.', { status: 400 });
  }

  const dueDate = asOptionalDate(body.due_date);
  if (body.due_date !== undefined && dueDate === undefined) {
    return new Response('due_date must be YYYY-MM-DD when provided.', { status: 400 });
  }

  const createdBy = asString(body.created_by);

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('log_product_kiv_items')
    .insert({
      account_id: env.accountId,
      marketplace: env.marketplace,
      asin_norm: asin,
      created_by: createdBy,
      status: 'open',
      title,
      details: details ?? null,
      source: 'manual',
      tags: tags ?? [],
      priority: priority ?? null,
      due_date: dueDate ?? null,
    })
    .select(selectFields)
    .single();

  if (insertError || !inserted) {
    return new Response(`Failed creating KIV item: ${insertError?.message ?? 'unknown error'}`, {
      status: 500,
    });
  }

  return Response.json({ ok: true, item: inserted });
}
