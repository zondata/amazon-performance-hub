import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ asin: string }> };

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonRecord;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asSkillIds = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  const seen = new Set<string>();
  const out: string[] = [];

  for (const entry of value) {
    const id = asString(entry);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }

  return out;
};

const normalizeAsin = (value: string): string => value.trim().toUpperCase();

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

  const notesProvided = Object.prototype.hasOwnProperty.call(body, 'notes');
  const skillsProvided = Object.prototype.hasOwnProperty.call(body, 'skills');
  const intentProvided = Object.prototype.hasOwnProperty.call(body, 'intent');

  const notes = notesProvided ? asString(body.notes) : null;
  const skills = skillsProvided ? asSkillIds(body.skills) : null;
  if (skillsProvided && skills === null) {
    return new Response('skills must be an array of strings when provided.', { status: 400 });
  }

  const intentValue = body.intent;
  const intent = intentProvided ? asRecord(intentValue) : null;
  if (intentProvided && intentValue !== null && !intent) {
    return new Response('intent must be an object or null when provided.', { status: 400 });
  }

  const { data: productRow, error: productError } = await supabaseAdmin
    .from('products')
    .select('product_id')
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .eq('asin', asin)
    .maybeSingle();

  if (productError) {
    return new Response(`Failed loading product: ${productError.message}`, { status: 500 });
  }

  if (!productRow?.product_id) {
    return new Response('Product not found.', { status: 404 });
  }

  const productId = String(productRow.product_id);

  const { data: profileRow, error: profileError } = await supabaseAdmin
    .from('product_profile')
    .select('profile_json')
    .eq('product_id', productId)
    .maybeSingle();

  if (profileError) {
    return new Response(`Failed loading product profile: ${profileError.message}`, { status: 500 });
  }

  const existingProfile = asRecord(profileRow?.profile_json) ?? {};
  const nextProfile: JsonRecord = { ...existingProfile };

  if (notesProvided) {
    if (notes) {
      nextProfile.notes = notes;
    } else {
      delete nextProfile.notes;
    }
  }

  if (skillsProvided) {
    nextProfile.skills = skills ?? [];
  }

  if (intentProvided) {
    if (intent) {
      nextProfile.intent = intent;
    } else {
      delete nextProfile.intent;
    }
  }

  const { error: upsertError } = await supabaseAdmin
    .from('product_profile')
    .upsert(
      {
        product_id: productId,
        profile_json: nextProfile,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'product_id' }
    );

  if (upsertError) {
    return new Response(`Failed saving product profile: ${upsertError.message}`, { status: 500 });
  }

  return Response.json({
    ok: true,
    asin,
    profile_json: nextProfile,
  });
}
