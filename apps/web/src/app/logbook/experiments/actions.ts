'use server';

import { revalidatePath } from 'next/cache';

import { env } from '@/lib/env';
import { runSbUpdateGenerator, runSpUpdateGenerator } from '@/lib/bulksheets/runGenerators';
import { downloadTemplateToLocalPath } from '@/lib/bulksheets/templateStore';
import { selectBulkgenPlansForExecution } from '@/lib/logbook/contracts/reviewPatchPlan';
import {
  REVIEW_CHANGES_PAGE_KEY,
  RECOMMENDED_REVIEW_CHANGES_UI_SETTINGS,
  type ReviewChangesUiSettings,
  type ReviewSortMode,
} from '@/lib/logbook/reviewProposedChangesDisplayModel';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { savePageSettings } from '@/lib/uiSettings/savePageSettings';

type JsonObject = Record<string, unknown>;

type SaveReviewSettingsResult = { ok: true } | { ok: false; error: string };

type GenerateFinalPlanBulksheetInput = {
  experimentId: string;
  channel: 'SP' | 'SB';
  runId: string;
};

type GenerateFinalPlanBulksheetResult =
  | { ok: true; run_id: string; channel: 'SP' | 'SB'; final_plan_pack_id?: string | null }
  | { ok: false; error: string };

const asObject = (value: unknown): JsonObject | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonObject;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const allowedSortModes = new Set<ReviewSortMode>([
  'damage_risk_first',
  'objective_kpi_risk_high_first',
]);

const sanitizeReviewChangesSettings = (settings: unknown): ReviewChangesUiSettings => {
  const row = asObject(settings);
  const visibleColumnsRaw = Array.isArray(row?.visibleColumns) ? row?.visibleColumns : [];
  const visibleColumns = visibleColumnsRaw
    .map((value) => asString(value))
    .filter((value): value is string => Boolean(value));
  const uniqueVisibleColumns = [...new Set(visibleColumns)];

  const sortModeCandidate = asString(row?.sortMode);
  const sortMode = allowedSortModes.has(sortModeCandidate as ReviewSortMode)
    ? (sortModeCandidate as ReviewSortMode)
    : RECOMMENDED_REVIEW_CHANGES_UI_SETTINGS.sortMode;

  return {
    showIds: row?.showIds === true,
    sortMode,
    visibleColumns:
      uniqueVisibleColumns.length > 0
        ? (uniqueVisibleColumns as ReviewChangesUiSettings['visibleColumns'])
        : RECOMMENDED_REVIEW_CHANGES_UI_SETTINGS.visibleColumns,
  };
};

export const saveExperimentReviewChangesSettings = async (
  settings: unknown
): Promise<SaveReviewSettingsResult> => {
  try {
    const sanitized = sanitizeReviewChangesSettings(settings);
    await savePageSettings({
      accountId: env.accountId,
      marketplace: env.marketplace,
      pageKey: REVIEW_CHANGES_PAGE_KEY,
      settings: sanitized,
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to save review settings.',
    };
  }
};

export const generateExperimentFinalPlanBulksheet = async (
  input: GenerateFinalPlanBulksheetInput
): Promise<GenerateFinalPlanBulksheetResult> => {
  const experimentId = asString(input.experimentId);
  const runId = asString(input.runId);
  const channel = input.channel;

  if (!experimentId || !runId || (channel !== 'SP' && channel !== 'SB')) {
    return { ok: false, error: 'Missing final plan identifiers.' };
  }

  try {
    const { data: experimentRow, error: experimentError } = await supabaseAdmin
      .from('log_experiments')
      .select('experiment_id,scope')
      .eq('account_id', env.accountId)
      .eq('marketplace', env.marketplace)
      .eq('experiment_id', experimentId)
      .maybeSingle();

    if (experimentError || !experimentRow?.experiment_id) {
      throw new Error(`Experiment not found: ${experimentError?.message ?? 'unknown error'}`);
    }

    const scope = experimentRow.scope;
    const selection = selectBulkgenPlansForExecution(scope);
    if (selection.source !== 'final_plan') {
      throw new Error('Final plan is required before bulksheet generation.');
    }

    const matchedPlan = selection.plans.find((plan) => plan.channel === channel && plan.run_id === runId);
    if (!matchedPlan) {
      throw new Error(`Final plan entry not found for ${channel} run_id=${runId}.`);
    }

    const scopeObj = asObject(scope);
    const productId = asString(scopeObj?.product_id);
    const finalPlanPackId = selection.final_plan_pack_id ?? null;
    const planRefNote = finalPlanPackId ? `final_plan_pack_id=${finalPlanPackId}` : null;
    const generatorNotes = [matchedPlan.notes ?? null, planRefNote]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join(' | ');

    if (!env.bulkgenOutRoot) {
      throw new Error('BULKGEN_OUT_ROOT is required.');
    }

    if (matchedPlan.channel === 'SP') {
      const templatePath = await downloadTemplateToLocalPath('sp_update');
      await runSpUpdateGenerator({
        templatePath,
        outRoot: env.bulkgenOutRoot,
        notes: generatorNotes || null,
        runId: matchedPlan.run_id,
        productId: productId ?? null,
        experimentId,
        finalPlanPackId,
        logEnabled: true,
        actions: matchedPlan.actions as Record<string, unknown>[],
      });
    } else {
      const templatePath = await downloadTemplateToLocalPath('sb_update');
      await runSbUpdateGenerator({
        templatePath,
        outRoot: env.bulkgenOutRoot,
        notes: generatorNotes || null,
        runId: matchedPlan.run_id,
        productId: productId ?? null,
        experimentId,
        finalPlanPackId,
        logEnabled: true,
        actions: matchedPlan.actions as Record<string, unknown>[],
      });
    }

    revalidatePath(`/logbook/experiments/${experimentId}`);

    return {
      ok: true,
      run_id: matchedPlan.run_id,
      channel: matchedPlan.channel,
      final_plan_pack_id: finalPlanPackId,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to generate final plan bulksheet.',
    };
  }
};
