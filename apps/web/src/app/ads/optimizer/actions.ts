'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect-error';

import {
  activateRulePackVersion,
  createRulePackVersionDraft,
  saveProductOptimizerSettings,
} from '@/lib/ads-optimizer/repoConfig';
import { executeAdsOptimizerWorkspaceHandoff } from '@/lib/ads-optimizer/handoff';
import { saveAdsOptimizerRecommendationOverride } from '@/lib/ads-optimizer/repoOverrides';
import { executeAdsOptimizerManualRun } from '@/lib/ads-optimizer/runtime';

const trimToNull = (value: FormDataEntryValue | null): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const ensureReturnTo = (value: string | null, fallback = '/ads/optimizer?view=config') => {
  if (!value || !value.startsWith('/ads/optimizer')) {
    return fallback;
  }
  return value;
};

const ensureWorkspaceReturnTo = (
  value: string | null,
  fallback = '/ads/performance?panel=queue'
) => {
  if (!value || !value.startsWith('/ads/performance')) {
    return fallback;
  }
  return value;
};

const redirectWithFlash = (
  returnTo: string,
  params: { notice?: string; error?: string; seeded?: boolean; overrideError?: boolean }
) => {
  const url = new URL(returnTo, 'http://localhost');
  url.searchParams.delete('notice');
  url.searchParams.delete('error');
  url.searchParams.delete('seeded');
  url.searchParams.delete('override_error');
  if (params.notice) {
    url.searchParams.set('notice', params.notice);
  }
  if (params.error) {
    url.searchParams.set('error', params.error);
  }
  if (params.seeded) {
    url.searchParams.set('seeded', '1');
  }
  if (params.overrideError) {
    url.searchParams.set('override_error', '1');
  }
  redirect(`${url.pathname}?${url.searchParams.toString()}`);
};

const redirectWorkspaceWithFlash = (
  returnTo: string,
  params: { notice?: string; error?: string; changeSetId?: string | null }
) => {
  const url = new URL(returnTo, 'http://localhost');
  url.searchParams.delete('queue_notice');
  url.searchParams.delete('queue_error');
  if (params.changeSetId) {
    url.searchParams.set('change_set', params.changeSetId);
  }
  if (params.notice) {
    url.searchParams.set('queue_notice', params.notice);
  }
  if (params.error) {
    url.searchParams.set('queue_error', params.error);
  }
  redirect(`${url.pathname}?${url.searchParams.toString()}`);
};

const rethrowRedirectError = (error: unknown) => {
  if (isRedirectError(error)) {
    throw error;
  }
};

export async function createAdsOptimizerDraftVersionAction(formData: FormData) {
  const returnTo = ensureReturnTo(trimToNull(formData.get('return_to')));

  try {
    const rulePackId = trimToNull(formData.get('rule_pack_id'));
    const sourceVersionId = trimToNull(formData.get('source_version_id'));
    const versionLabel = trimToNull(formData.get('version_label'));
    const changeSummary = trimToNull(formData.get('change_summary'));

    if (!rulePackId || !sourceVersionId || !versionLabel || !changeSummary) {
      throw new Error('rule_pack_id, source_version_id, version_label, and change_summary are required.');
    }

    const created = await createRulePackVersionDraft({
      rulePackId,
      sourceVersionId,
      versionLabel,
      changeSummary,
    });

    revalidatePath('/ads/optimizer');
    redirectWithFlash(returnTo, {
      notice: `Draft version ${created.version_label} created.`,
    });
  } catch (error) {
    rethrowRedirectError(error);
    redirectWithFlash(returnTo, {
      error: error instanceof Error ? error.message : 'Failed to create optimizer draft version.',
    });
  }
}

export async function activateAdsOptimizerRulePackVersionAction(formData: FormData) {
  const returnTo = ensureReturnTo(trimToNull(formData.get('return_to')));

  try {
    const rulePackVersionId = trimToNull(formData.get('rule_pack_version_id'));
    if (!rulePackVersionId) {
      throw new Error('rule_pack_version_id is required.');
    }

    const activated = await activateRulePackVersion(rulePackVersionId);
    revalidatePath('/ads/optimizer');
    redirectWithFlash(returnTo, {
      notice: `Activated version ${activated.version_label}.`,
    });
  } catch (error) {
    rethrowRedirectError(error);
    redirectWithFlash(returnTo, {
      error: error instanceof Error ? error.message : 'Failed to activate optimizer rule pack version.',
    });
  }
}

export async function saveAdsOptimizerProductSettingsAction(formData: FormData) {
  const returnTo = ensureReturnTo(trimToNull(formData.get('return_to')));

  try {
    const productId = trimToNull(formData.get('product_id'));
    const productAsin = trimToNull(formData.get('product_asin'));
    const archetype = trimToNull(formData.get('archetype'));
    const rulePackVersionId = trimToNull(formData.get('rule_pack_version_id'));
    const strategicNotes = trimToNull(formData.get('strategic_notes'));

    if (!productId || !archetype || !rulePackVersionId) {
      throw new Error('product_id, archetype, and rule_pack_version_id are required.');
    }

    await saveProductOptimizerSettings({
      product_id: productId,
      archetype,
      optimizer_enabled: formData.get('optimizer_enabled') === '1',
      rule_pack_version_id: rulePackVersionId,
      strategic_notes: strategicNotes,
    });

    revalidatePath('/ads/optimizer');
    redirectWithFlash(returnTo, {
      notice: `Saved optimizer product settings for ${productAsin ?? productId}.`,
    });
  } catch (error) {
    rethrowRedirectError(error);
    redirectWithFlash(returnTo, {
      error:
        error instanceof Error ? error.message : 'Failed to save optimizer product settings.',
    });
  }
}

export async function runAdsOptimizerNowAction(formData: FormData) {
  const returnTo = ensureReturnTo(
    trimToNull(formData.get('return_to')),
    '/ads/optimizer?view=history'
  );

  try {
    const asin = trimToNull(formData.get('asin'));
    const start = trimToNull(formData.get('start'));
    const end = trimToNull(formData.get('end'));

    if (!asin || !start || !end) {
      throw new Error('asin, start, and end are required.');
    }

    const result = await executeAdsOptimizerManualRun({
      asin,
      start,
      end,
    });

    revalidatePath('/ads/optimizer');
    if (result.status === 'failed') {
      redirectWithFlash(returnTo, {
        error: `Optimizer run ${result.runId} failed. Diagnostics were saved to history.`,
      });
    }

    if (result.diagnostics && result.targetSnapshotCount === 0) {
      redirectWithFlash(returnTo, {
        notice: `Optimizer run ${result.runId} completed with 0 target snapshot(s) and 0 recommendation snapshot(s). Diagnostics were saved to history.`,
      });
    }

    redirectWithFlash(returnTo, {
      notice: `Optimizer run ${result.runId} completed with ${result.targetSnapshotCount} target snapshot(s) and ${result.recommendationSnapshotCount} recommendation snapshot(s).`,
    });
  } catch (error) {
    rethrowRedirectError(error);
    redirectWithFlash(returnTo, {
      error: error instanceof Error ? error.message : 'Failed to run the optimizer snapshot.',
    });
  }
}

const formNumber = (value: FormDataEntryValue | null) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : null;
};

export async function saveAdsOptimizerRecommendationOverrideAction(formData: FormData) {
  const returnTo = ensureReturnTo(
    trimToNull(formData.get('return_to')),
    '/ads/optimizer?view=targets'
  );

  try {
    const productId = trimToNull(formData.get('product_id'));
    const asin = trimToNull(formData.get('asin'));
    const targetId = trimToNull(formData.get('target_id'));
    const runId = trimToNull(formData.get('run_id'));
    const targetSnapshotId = trimToNull(formData.get('target_snapshot_id'));
    const recommendationSnapshotId = trimToNull(formData.get('recommendation_snapshot_id'));
    const overrideScope = trimToNull(formData.get('override_scope'));
    const operatorNote = trimToNull(formData.get('operator_note'));
    const campaignId = trimToNull(formData.get('campaign_id'));
    const currentState = trimToNull(formData.get('current_state'));
    const currentBid = formNumber(formData.get('current_bid'));
    const currentPlacementCode = trimToNull(formData.get('current_placement_code'));
    const currentPlacementPercentage = formNumber(formData.get('current_placement_percentage'));

    const replacementActions: Array<Record<string, unknown>> = [];

    if (formData.get('override_bid_enabled') === '1') {
      replacementActions.push({
        action_type: 'update_target_bid',
        entity_context_json: {
          campaign_id: campaignId,
          target_id: targetId,
          current_bid: currentBid,
        },
        proposed_change_json: {
          next_bid: formNumber(formData.get('override_bid_next_bid')),
        },
      });
    }

    if (formData.get('override_state_enabled') === '1') {
      replacementActions.push({
        action_type: 'update_target_state',
        entity_context_json: {
          campaign_id: campaignId,
          target_id: targetId,
          current_state: currentState,
        },
        proposed_change_json: {
          next_state: trimToNull(formData.get('override_state_next_state')),
        },
      });
    }

    if (formData.get('override_placement_enabled') === '1') {
      replacementActions.push({
        action_type: 'update_placement_modifier',
        entity_context_json: {
          campaign_id: campaignId,
          placement_code: currentPlacementCode,
          current_percentage: currentPlacementPercentage,
        },
        proposed_change_json: {
          placement_code: currentPlacementCode,
          next_percentage: formNumber(formData.get('override_placement_next_percentage')),
        },
      });
    }

    await saveAdsOptimizerRecommendationOverride({
      product_id: productId,
      asin,
      target_id: targetId,
      run_id: runId,
      target_snapshot_id: targetSnapshotId,
      recommendation_snapshot_id: recommendationSnapshotId,
      override_scope: overrideScope,
      replacement_action_bundle_json: {
        actions: replacementActions,
      },
      operator_note: operatorNote,
    });

    revalidatePath('/ads/optimizer');
    redirectWithFlash(returnTo, {
      notice: `Saved manual override for ${targetId ?? 'the selected target'}.`,
    });
  } catch (error) {
    rethrowRedirectError(error);
    redirectWithFlash(returnTo, {
      error:
        error instanceof Error
          ? error.message
          : 'Failed to save the optimizer recommendation override.',
      overrideError: true,
    });
  }
}

export async function handoffAdsOptimizerToWorkspaceAction(formData: FormData) {
  const returnTo = ensureReturnTo(
    trimToNull(formData.get('return_to')),
    '/ads/optimizer?view=targets'
  );
  const workspaceReturnTo = ensureWorkspaceReturnTo(
    trimToNull(formData.get('workspace_return_to')),
    '/ads/performance?panel=queue&channel=sp&level=targets&view=table'
  );

  try {
    const asin = trimToNull(formData.get('asin'));
    const start = trimToNull(formData.get('start'));
    const end = trimToNull(formData.get('end'));
    const targetSnapshotIds = formData
      .getAll('target_snapshot_id')
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean);

    if (!asin || !start || !end) {
      throw new Error('asin, start, and end are required.');
    }

    const result = await executeAdsOptimizerWorkspaceHandoff({
      asin,
      start,
      end,
      targetSnapshotIds,
    });

    revalidatePath('/ads/optimizer');
    revalidatePath('/ads/performance');

    const skippedUnsupportedText =
      result.skippedUnsupportedActionTypes.length > 0
        ? ` Skipped review-only action types: ${result.skippedUnsupportedActionTypes.join(', ')}.`
        : '';
    const dedupedText =
      result.dedupedActionCount > 0
        ? ` Deduped ${result.dedupedActionCount} duplicate workspace action(s).`
        : '';

    redirectWorkspaceWithFlash(workspaceReturnTo, {
      changeSetId: result.changeSetId,
      notice:
        `Optimizer handoff created draft ${result.changeSetName} with ${result.stagedActionCount} staged workspace action(s) from ${result.selectedRowCount} optimizer row(s).` +
        skippedUnsupportedText +
        dedupedText,
    });
  } catch (error) {
    rethrowRedirectError(error);
    redirectWithFlash(returnTo, {
      error:
        error instanceof Error
          ? error.message
          : 'Failed to hand off optimizer recommendations to Ads Workspace.',
    });
  }
}
