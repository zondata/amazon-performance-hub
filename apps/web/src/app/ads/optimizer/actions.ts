'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect-error';

import {
  activateRulePackVersion,
  createRulePackVersionDraft,
} from '@/lib/ads-optimizer/repoConfig';
import { executeAdsOptimizerWorkspaceHandoff } from '@/lib/ads-optimizer/handoff';
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
  params: { notice?: string; error?: string; seeded?: boolean }
) => {
  const url = new URL(returnTo, 'http://localhost');
  url.searchParams.delete('notice');
  url.searchParams.delete('error');
  url.searchParams.delete('seeded');
  if (params.notice) {
    url.searchParams.set('notice', params.notice);
  }
  if (params.error) {
    url.searchParams.set('error', params.error);
  }
  if (params.seeded) {
    url.searchParams.set('seeded', '1');
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
