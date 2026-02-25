import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

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

const parseSkillIds = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;

  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of value) {
    const skillId = asString(entry);
    if (!skillId || seen.has(skillId)) continue;
    seen.add(skillId);
    out.push(skillId);
  }
  return out;
};

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const experimentId = id?.trim();
  if (!experimentId) {
    return new Response('Missing experiment id.', { status: 400 });
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

  const skillsProvided = Object.prototype.hasOwnProperty.call(body, 'skills');
  const skills = skillsProvided ? parseSkillIds(body.skills) : null;
  if (skillsProvided && skills === null) {
    return new Response('skills must be an array of strings when provided.', { status: 400 });
  }

  const { data: experimentRow, error: experimentError } = await supabaseAdmin
    .from('log_experiments')
    .select('scope')
    .eq('experiment_id', experimentId)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .maybeSingle();

  if (experimentError) {
    return new Response(`Failed loading experiment scope: ${experimentError.message}`, { status: 500 });
  }

  if (!experimentRow) {
    return new Response('Experiment not found.', { status: 404 });
  }

  const nextScope = {
    ...(asRecord(experimentRow.scope) ?? {}),
  };

  if (skillsProvided) {
    nextScope.skills = skills ?? [];
  }

  const { error: updateError } = await supabaseAdmin
    .from('log_experiments')
    .update({ scope: nextScope })
    .eq('experiment_id', experimentId)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace);

  if (updateError) {
    return new Response(`Failed updating experiment scope: ${updateError.message}`, { status: 500 });
  }

  return Response.json({
    ok: true,
    experiment_id: experimentId,
    scope: nextScope,
  });
}
