'use server';

import 'server-only';

import { env } from '@/lib/env';
import {
  normalizeScopeWithAdsOptimizationContractV1,
  type AdsOptimizationContractV1,
} from '@/lib/logbook/contracts/adsOptimizationContractV1';
import {
  buildFinalPlanSnapshot,
  extractProposalBulkgenPlansFromScope,
} from '@/lib/logbook/contracts/reviewPatchPlan';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

import { parseReviewPatchPack } from './parseReviewPatchPack';
import {
  formatSemanticIssuesForError,
  toSemanticErrorDetails,
  validateReviewPatchDecisionIds,
} from './semanticValidation';

type JsonRecord = Record<string, unknown>;

type ImportInput = {
  fileText: string;
  expectedExperimentId?: string;
};

type ExperimentRow = {
  experiment_id: string;
  scope: unknown | null;
};

export type ImportReviewPatchPackResult = {
  ok: boolean;
  experiment_id?: string;
  review_patch_pack_id?: string;
  final_plan_pack_id?: string;
  product_asin?: string;
  status_updated?: boolean;
  summary?: {
    actions_total: number;
    accepted_actions: number;
    rejected_actions: number;
    modified_actions: number;
  };
  warnings?: string[];
  error?: string;
  details?: Record<string, unknown>;
};

const asRecord = (value: unknown): JsonRecord | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonRecord;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const mergeContract = (scope: JsonRecord, contractPatch: Partial<AdsOptimizationContractV1>) => {
  const currentContract = asRecord(scope.contract);
  const currentAds = asRecord(currentContract?.ads_optimization_v1) ?? {};

  return {
    ...scope,
    contract: {
      ...(currentContract ?? {}),
      ads_optimization_v1: {
        ...currentAds,
        ...contractPatch,
      },
    },
  };
};

export const importReviewPatchPack = async (
  input: ImportInput
): Promise<ImportReviewPatchPackResult> => {
  const parsed = parseReviewPatchPack(input.fileText, {
    expectedExperimentId: input.expectedExperimentId,
  });
  if (!parsed.ok) {
    return {
      ok: false,
      error: parsed.error,
    };
  }

  try {
    const warnings: string[] = [];
    const pack = parsed.value;

    const { data: experimentData, error: experimentError } = await supabaseAdmin
      .from('log_experiments')
      .select('experiment_id,scope')
      .eq('experiment_id', pack.links.experiment_id)
      .eq('account_id', env.accountId)
      .eq('marketplace', env.marketplace)
      .maybeSingle();

    if (experimentError || !experimentData?.experiment_id) {
      throw new Error(`Experiment not found: ${experimentError?.message ?? 'unknown error'}`);
    }

    const experiment = experimentData as ExperimentRow;
    const scopeBase =
      normalizeScopeWithAdsOptimizationContractV1(experiment.scope, {
        defaultWorkflowMode: true,
      }) ?? {};

    const proposalPlans = extractProposalBulkgenPlansFromScope(scopeBase);
    if (proposalPlans.length === 0) {
      throw new Error('No proposal bulkgen plans found in experiment scope.');
    }
    const semanticIssues = validateReviewPatchDecisionIds({
      decisions: pack.patch.decisions,
      proposalPlans,
    });
    if (semanticIssues.length > 0) {
      return {
        ok: false,
        error: formatSemanticIssuesForError(
          semanticIssues,
          'Semantic validation failed for review patch pack.'
        ),
        details: toSemanticErrorDetails({
          issues: semanticIssues,
          warnings: [],
        }),
      };
    }

    const built = buildFinalPlanSnapshot({
      proposalPlans,
      reviewPatchPack: pack,
    });
    warnings.push(...built.warnings);

    const nextScopeWithContract = mergeContract(scopeBase, {
      review_patch: pack,
      final_plan: built.finalPlan,
    });
    const nextScope = {
      ...nextScopeWithContract,
      status: 'REVIEWED',
    };

    const { error: updateError } = await supabaseAdmin
      .from('log_experiments')
      .update({
        scope: nextScope,
      })
      .eq('experiment_id', experiment.experiment_id)
      .eq('account_id', env.accountId)
      .eq('marketplace', env.marketplace);

    if (updateError) {
      throw new Error(`Failed updating experiment scope with review patch: ${updateError.message}`);
    }

    return {
      ok: true,
      experiment_id: experiment.experiment_id,
      review_patch_pack_id: pack.pack_id,
      final_plan_pack_id: built.finalPlan.pack_id,
      product_asin: asString(asRecord(nextScope)?.product_id)?.toUpperCase() ?? undefined,
      status_updated: true,
      summary: built.finalPlan.summary,
      warnings,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown review patch import error.',
    };
  }
};
