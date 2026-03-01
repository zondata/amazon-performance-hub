import { revalidatePath } from 'next/cache';

import { env } from '@/lib/env';
import { buildFinalPlanSnapshot, extractProposalBulkgenPlansFromScope } from '@/lib/logbook/contracts/reviewPatchPlan';
import { parseReviewPatchPack } from '@/lib/logbook/aiPack/parseReviewPatchPack';
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

const jsonFailure = (status: number, error: string, details?: Record<string, unknown>) =>
  Response.json(
    {
      ok: false,
      error,
      ...(details ? { details } : {}),
    },
    { status }
  );

export async function POST(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const experimentId = id?.trim();
  if (!experimentId) {
    return jsonFailure(400, 'Missing experiment id.', {
      code: 'missing_experiment_id',
    });
  }

  const { data: experimentData, error: experimentError } = await supabaseAdmin
    .from('log_experiments')
    .select('experiment_id,scope')
    .eq('experiment_id', experimentId)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .maybeSingle();

  if (experimentError || !experimentData?.experiment_id) {
    return jsonFailure(404, `Experiment not found: ${experimentError?.message ?? 'unknown error'}`, {
      code: 'experiment_not_found',
      experiment_id: experimentId,
    });
  }

  const scope = asRecord(experimentData.scope) ?? {};
  const contract = asRecord(asRecord(scope.contract)?.ads_optimization_v1) ?? {};

  const reviewPatchRaw = asRecord(contract.review_patch);
  if (!reviewPatchRaw) {
    return jsonFailure(400, 'Review patch is missing. Save review decisions before finalizing.', {
      code: 'missing_review_patch',
      experiment_id: experimentId,
    });
  }

  const parsedPatch = parseReviewPatchPack(JSON.stringify(reviewPatchRaw), {
    expectedExperimentId: experimentId,
  });
  if (!parsedPatch.ok) {
    return jsonFailure(400, `Stored review patch is invalid: ${parsedPatch.error}`, {
      code: 'invalid_review_patch',
      experiment_id: experimentId,
    });
  }

  const proposalPlans = extractProposalBulkgenPlansFromScope(scope);
  if (proposalPlans.length === 0) {
    return jsonFailure(400, 'Proposal bulkgen plans are missing; cannot finalize.', {
      code: 'missing_proposal_plans',
      experiment_id: experimentId,
    });
  }

  const built = buildFinalPlanSnapshot({
    proposalPlans,
    reviewPatchPack: parsedPatch.value,
  });

  const nextScope = {
    ...scope,
    status: 'FINALIZED',
    contract: {
      ...(asRecord(scope.contract) ?? {}),
      ads_optimization_v1: {
        ...contract,
        review_patch: parsedPatch.value,
        final_plan: built.finalPlan,
      },
    },
  };

  const { error: updateError } = await supabaseAdmin
    .from('log_experiments')
    .update({
      scope: nextScope,
    })
    .eq('experiment_id', experimentId)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace);

  if (updateError) {
    return jsonFailure(500, `Failed to finalize plan: ${updateError.message}`, {
      code: 'finalize_update_failed',
      experiment_id: experimentId,
    });
  }

  revalidatePath(`/logbook/experiments/${experimentId}`);
  const asin = asString(scope.product_id)?.toUpperCase();
  if (asin) {
    revalidatePath(`/products/${asin}`);
  }

  return Response.json({
    ok: true,
    experiment_id: experimentId,
    final_plan_pack_id: built.finalPlan.pack_id,
    summary: built.finalPlan.summary,
    warnings: built.warnings,
  });
}
