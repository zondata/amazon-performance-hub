import { revalidatePath } from 'next/cache';

import { env } from '@/lib/env';
import {
  REVIEW_PATCH_PACK_KIND_V1,
  REVIEW_PATCH_PACK_VERSION_V1,
} from '@/lib/logbook/contracts/adsOptimizationContractV1';
import {
  buildProposalActionRefs,
  extractProposalBulkgenPlansFromScope,
} from '@/lib/logbook/contracts/reviewPatchPlan';
import { importReviewPatchPack } from '@/lib/logbook/aiPack/importReviewPatchPack';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

const jsonFailure = (status: number, error: string, details?: Record<string, unknown>) =>
  Response.json(
    {
      ok: false,
      error,
      ...(details ? { details } : {}),
    },
    { status }
  );

const sanitizeFileSegment = (value: string): string => {
  const cleaned = value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]+/g, '');
  return cleaned.length > 0 ? cleaned.slice(0, 80) : 'experiment';
};

const buildPatchPackFromBody = (
  body: JsonRecord,
  experimentId: string
): JsonRecord => {
  const packLike = asString(body.kind) === REVIEW_PATCH_PACK_KIND_V1;
  if (packLike) return body;

  const decisionsRaw =
    Array.isArray(body.decisions) ? body.decisions : asRecord(body.patch)?.decisions;
  const decisions = Array.isArray(decisionsRaw) ? decisionsRaw : [];
  return {
    kind: REVIEW_PATCH_PACK_KIND_V1,
    pack_version: REVIEW_PATCH_PACK_VERSION_V1,
    pack_id: asString(body.pack_id) ?? `review_ui_${Date.now()}`,
    created_at: new Date().toISOString(),
    links: {
      experiment_id: experimentId,
      proposal_pack_id: asString(body.proposal_pack_id) ?? undefined,
    },
    trace: {
      workflow_mode: asString(body.workflow_mode)?.toLowerCase() === 'api' ? 'api' : 'manual',
      model: asString(body.model) ?? undefined,
      prompt_template_id: asString(body.prompt_template_id) ?? undefined,
    },
    patch: {
      decisions,
      notes: asString(body.notes) ?? asString(asRecord(body.patch)?.notes) ?? undefined,
    },
  };
};

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const experimentId = id?.trim();
  if (!experimentId) {
    return jsonFailure(400, 'Missing experiment id.');
  }

  const { data: experimentData, error: experimentError } = await supabaseAdmin
    .from('log_experiments')
    .select('experiment_id,name,scope')
    .eq('experiment_id', experimentId)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .maybeSingle();

  if (experimentError || !experimentData?.experiment_id) {
    return jsonFailure(404, `Experiment not found: ${experimentError?.message ?? 'unknown error'}`);
  }

  const scope = asRecord(experimentData.scope) ?? {};
  const contract = asRecord(asRecord(scope.contract)?.ads_optimization_v1);
  const existingPatchPack = asRecord(contract?.review_patch);

  const pack =
    existingPatchPack ??
    (() => {
      const plans = extractProposalBulkgenPlansFromScope(scope);
      const refs = buildProposalActionRefs(plans);
      return {
        kind: REVIEW_PATCH_PACK_KIND_V1,
        pack_version: REVIEW_PATCH_PACK_VERSION_V1,
        pack_id: `review_seed_${Date.now()}`,
        created_at: new Date().toISOString(),
        links: {
          experiment_id: experimentId,
          proposal_pack_id: asString(contract?.proposal_pack_id) ?? undefined,
        },
        trace: {
          workflow_mode: asString(asRecord(contract?.ai_run_meta)?.workflow_mode) === 'api' ? 'api' : 'manual',
          model: asString(asRecord(contract?.ai_run_meta)?.model) ?? undefined,
          prompt_template_id:
            asString(asRecord(contract?.ai_run_meta)?.prompt_template_id) ?? undefined,
        },
        patch: {
          decisions: refs.map((ref) => ({
            change_id: ref.change_id,
            decision: 'accept',
          })),
        },
      };
    })();

  const filename = `${sanitizeFileSegment(String(experimentData.name ?? 'experiment'))}_${experimentId}_review_patch_pack.json`;

  return new Response(`${JSON.stringify(pack, null, 2)}\n`, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
}

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const experimentId = id?.trim();
  if (!experimentId) {
    return jsonFailure(400, 'Missing experiment id.', {
      code: 'missing_experiment_id',
    });
  }

  let fileText = '';
  const contentType = request.headers.get('content-type') ?? '';

  try {
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file || !(file instanceof File) || file.size === 0) {
        return jsonFailure(400, 'JSON file is required.', { code: 'missing_file' });
      }
      fileText = await file.text();
    } else {
      const bodyRaw = (await request.json()) as unknown;
      const body = asRecord(bodyRaw);
      if (!body) {
        return jsonFailure(400, 'Body must be a JSON object.', { code: 'invalid_json_body' });
      }
      const pack = buildPatchPackFromBody(body, experimentId);
      fileText = JSON.stringify(pack);
    }
  } catch {
    return jsonFailure(400, 'Invalid request body.', { code: 'invalid_request_body' });
  }

  const result = await importReviewPatchPack({
    fileText,
    expectedExperimentId: experimentId,
  });

  if (!result.ok) {
    return jsonFailure(400, result.error ?? 'Failed to import review patch pack.', {
      code: 'review_patch_import_failed',
      experiment_id: experimentId,
      ...(result.details ? result.details : {}),
    });
  }

  revalidatePath(`/logbook/experiments/${experimentId}`);
  if (result.product_asin) {
    revalidatePath(`/products/${result.product_asin}`);
  }

  return Response.json({
    ok: true,
    experiment_id: result.experiment_id,
    review_patch_pack_id: result.review_patch_pack_id,
    final_plan_pack_id: result.final_plan_pack_id,
    summary: result.summary,
    warnings: result.warnings ?? [],
  });
}
