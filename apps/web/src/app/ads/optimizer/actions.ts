'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect-error';

import {
  activateRulePackVersion,
  createRulePackVersionDraft,
} from '@/lib/ads-optimizer/repoConfig';

const trimToNull = (value: FormDataEntryValue | null): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const ensureReturnTo = (value: string | null) => {
  if (!value || !value.startsWith('/ads/optimizer')) {
    return '/ads/optimizer?view=config';
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
