'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect-error';

import {
  activateRulePackVersion,
  createRulePackVersionDraft,
  seedStarterRulePackVersionDrafts,
  saveProductOptimizerSettings,
  updateRulePackVersionDraft,
} from '@/lib/ads-optimizer/repoConfig';
import {
  ADS_OPTIMIZER_EDITOR_GUARDRAIL_FIELDS,
  ADS_OPTIMIZER_EDITOR_RECOMMENDATION_FIELDS,
  ADS_OPTIMIZER_EDITOR_ROLE_BIAS_FIELDS,
  ADS_OPTIMIZER_EDITOR_STATE_ENGINE_FIELDS,
  adsOptimizerDraftFieldName,
} from '@/lib/ads-optimizer/ruleEditor';
import { ADS_OPTIMIZER_TARGET_ROLES } from '@/lib/ads-optimizer/role';
import { executeAdsOptimizerWorkspaceHandoff } from '@/lib/ads-optimizer/handoff';
import { saveAdsOptimizerRecommendationOverride } from '@/lib/ads-optimizer/repoOverrides';
import { executeAdsOptimizerManualRun } from '@/lib/ads-optimizer/runtime';
import { buildAdsOptimizerHref } from '@/lib/ads-optimizer/shell';
import {
  resetAdsOptimizerHeroQueryManualOverride,
  saveAdsOptimizerHeroQueryManualOverride,
} from '@/lib/ads-optimizer/heroQueryOverride';
import {
  INITIAL_ADS_OPTIMIZER_RECOMMENDATION_OVERRIDE_INLINE_ACTION_STATE,
  type AdsOptimizerRecommendationOverrideInlineActionState,
} from '@/lib/ads-optimizer/recommendationOverrideInlineState';

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

const appendQueryParam = (href: string, name: string, value: string | null) => {
  if (!value) return href;
  const url = new URL(href, 'http://localhost');
  url.searchParams.set(name, value);
  return `${url.pathname}?${url.searchParams.toString()}`;
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

export async function seedAdsOptimizerStarterVersionsAction(formData: FormData) {
  const returnTo = ensureReturnTo(trimToNull(formData.get('return_to')));

  try {
    const rulePackId = trimToNull(formData.get('rule_pack_id'));
    if (!rulePackId) {
      throw new Error('rule_pack_id is required.');
    }

    const created = await seedStarterRulePackVersionDrafts(rulePackId);
    revalidatePath('/ads/optimizer');
    if (created.length === 0) {
      redirectWithFlash(returnTo, {
        notice: 'Starter drafts already exist for hybrid, visibility_led, and design_led.',
      });
    }

    redirectWithFlash(returnTo, {
      notice: `Seeded ${created.length} starter draft version(s) for the strategy library.`,
    });
  } catch (error) {
    rethrowRedirectError(error);
    redirectWithFlash(returnTo, {
      error:
        error instanceof Error ? error.message : 'Failed to seed starter optimizer versions.',
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

export async function saveAdsOptimizerHeroQueryAction(formData: FormData) {
  const returnTo = ensureReturnTo(
    trimToNull(formData.get('return_to')),
    '/ads/optimizer?view=overview'
  );

  try {
    const productId = trimToNull(formData.get('product_id'));
    const productAsin = trimToNull(formData.get('product_asin'));
    const heroQuery = trimToNull(formData.get('hero_query'));

    if (!productId || !productAsin || !heroQuery) {
      throw new Error('product_id, product_asin, and hero_query are required.');
    }

    await saveAdsOptimizerHeroQueryManualOverride({
      productId,
      query: heroQuery,
    });

    revalidatePath('/ads/optimizer');
    redirectWithFlash(returnTo, {
      notice: `Saved manual hero query for ${productAsin}.`,
    });
  } catch (error) {
    rethrowRedirectError(error);
    redirectWithFlash(returnTo, {
      error: error instanceof Error ? error.message : 'Failed to save hero query override.',
    });
  }
}

export async function resetAdsOptimizerHeroQueryAction(formData: FormData) {
  const returnTo = ensureReturnTo(
    trimToNull(formData.get('return_to')),
    '/ads/optimizer?view=overview'
  );

  try {
    const productId = trimToNull(formData.get('product_id'));
    const productAsin = trimToNull(formData.get('product_asin'));

    if (!productId || !productAsin) {
      throw new Error('product_id and product_asin are required.');
    }

    await resetAdsOptimizerHeroQueryManualOverride(productId);

    revalidatePath('/ads/optimizer');
    redirectWithFlash(returnTo, {
      notice: `Reset hero query for ${productAsin} back to auto.`,
    });
  } catch (error) {
    rethrowRedirectError(error);
    redirectWithFlash(returnTo, {
      error: error instanceof Error ? error.message : 'Failed to reset hero query override.',
    });
  }
}

export async function runAdsOptimizerNowAction(formData: FormData) {
  const returnTo = ensureReturnTo(
    trimToNull(formData.get('return_to')),
    '/ads/optimizer?view=overview'
  );

  try {
    const asin = trimToNull(formData.get('asin'));
    const start = trimToNull(formData.get('start'));
    const end = trimToNull(formData.get('end'));
    const successView = trimToNull(formData.get('success_view'));
    const successTrend = trimToNull(formData.get('success_trend'));

    if (!asin || !start || !end) {
      throw new Error('asin, start, and end are required.');
    }

    const result = await executeAdsOptimizerManualRun({
      asin,
      start,
      end,
    });
    const successReturnTo =
      successView === 'targets'
        ? appendQueryParam(
            buildAdsOptimizerHref({
              asin,
              start,
              end,
              view: 'targets',
              runId: result.runId,
            }),
            'trend',
            successTrend
          )
        : returnTo;

    revalidatePath('/ads/optimizer');
    if (result.status === 'failed') {
      redirectWithFlash(returnTo, {
        error: `Optimizer run ${result.runId} failed. Diagnostics were saved to history.`,
      });
    }

    if (result.diagnostics && result.targetSnapshotCount === 0) {
      redirectWithFlash(successReturnTo, {
        notice: `Optimizer run ${result.runId} completed with 0 target snapshot(s) and 0 recommendation snapshot(s). Diagnostics were saved to history.`,
      });
    }

    redirectWithFlash(successReturnTo, {
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

const CANONICAL_PLACEMENT_CODES = [
  'PLACEMENT_TOP',
  'PLACEMENT_REST_OF_SEARCH',
  'PLACEMENT_PRODUCT_PAGE',
] as const;

const requiredFormNumber = (formData: FormData, name: string, label: string) => {
  const value = formNumber(formData.get(name));
  if (value === null) {
    throw new Error(`${label} is required.`);
  }
  return value;
};

const isChecked = (formData: FormData, name: string) => formData.get(name) === '1';

const buildPlacementOverrideActions = (
  formData: FormData,
  campaignId: string | null
) =>
  CANONICAL_PLACEMENT_CODES.flatMap((placementCode) => {
    if (!isChecked(formData, `override_placement_enabled__${placementCode}`)) {
      return [];
    }

    const currentPlacementCode =
      trimToNull(formData.get(`current_placement_code__${placementCode}`)) ?? placementCode;

    return [
      {
        action_type: 'update_placement_modifier',
        entity_context_json: {
          campaign_id: campaignId,
          placement_code: currentPlacementCode,
          current_percentage: formNumber(
            formData.get(`current_placement_percentage__${placementCode}`)
          ),
        },
        proposed_change_json: {
          placement_code: currentPlacementCode,
          next_percentage: formNumber(
            formData.get(`override_placement_next_percentage__${placementCode}`)
          ),
        },
      },
    ];
  });

const buildAdsOptimizerRecommendationOverridePayload = (formData: FormData) => {
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
  const currentCampaignBiddingStrategy = trimToNull(
    formData.get('current_campaign_bidding_strategy')
  );

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

  if (formData.get('override_campaign_bidding_strategy_enabled') === '1') {
    replacementActions.push({
      action_type: 'update_campaign_bidding_strategy',
      entity_context_json: {
        campaign_id: campaignId,
        current_bidding_strategy: currentCampaignBiddingStrategy,
      },
      proposed_change_json: {
        new_strategy: trimToNull(
          formData.get('override_campaign_bidding_strategy_new_strategy')
        ),
      },
    });
  }

  replacementActions.push(...buildPlacementOverrideActions(formData, campaignId));

  return {
    productId,
    asin,
    targetId,
    runId,
    targetSnapshotId,
    recommendationSnapshotId,
    overrideScope,
    operatorNote,
    payload: {
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
    },
  };
};

export async function saveAdsOptimizerRecommendationOverrideAction(formData: FormData) {
  const returnTo = ensureReturnTo(
    trimToNull(formData.get('return_to')),
    '/ads/optimizer?view=targets'
  );

  try {
    const { payload, targetId } = buildAdsOptimizerRecommendationOverridePayload(formData);

    await saveAdsOptimizerRecommendationOverride(payload);

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

export async function saveAdsOptimizerRecommendationOverrideInlineAction(
  _prevState: AdsOptimizerRecommendationOverrideInlineActionState,
  formData: FormData
): Promise<AdsOptimizerRecommendationOverrideInlineActionState> {
  const { payload, targetId, targetSnapshotId } =
    buildAdsOptimizerRecommendationOverridePayload(formData);

  try {
    const override = await saveAdsOptimizerRecommendationOverride(payload);

    return {
      ok: true,
      notice: `Saved manual override for ${override.target_id}.`,
      error: null,
      targetSnapshotId: override.target_snapshot_id,
      targetId: override.target_id,
      override,
    };
  } catch (error) {
    rethrowRedirectError(error);
    return {
      ...INITIAL_ADS_OPTIMIZER_RECOMMENDATION_OVERRIDE_INLINE_ACTION_STATE,
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to save the optimizer recommendation override.',
      targetSnapshotId,
      targetId,
      override: null,
    };
  }
}

export async function saveAdsOptimizerDraftVersionAction(formData: FormData) {
  const returnTo = ensureReturnTo(trimToNull(formData.get('return_to')));

  try {
    const rulePackVersionId = trimToNull(formData.get('rule_pack_version_id'));
    const versionLabel = trimToNull(formData.get('version_label'));
    const changeSummary = trimToNull(formData.get('change_summary'));
    const strategyProfile = trimToNull(formData.get('strategy_profile'));
    const manualApprovalThreshold = trimToNull(
      formData.get(adsOptimizerDraftFieldName('guardrails', 'manual_approval_threshold'))
    );

    if (!rulePackVersionId || !versionLabel || !changeSummary || !strategyProfile) {
      throw new Error(
        'rule_pack_version_id, version_label, change_summary, and strategy_profile are required.'
      );
    }

    if (!manualApprovalThreshold) {
      throw new Error('Manual approval threshold is required.');
    }

    const stateThresholds = Object.fromEntries(
      ADS_OPTIMIZER_EDITOR_STATE_ENGINE_FIELDS.map((field) => [
        field.key,
        requiredFormNumber(
          formData,
          adsOptimizerDraftFieldName('state', field.key),
          field.label
        ),
      ])
    );
    const recommendationThresholds = Object.fromEntries(
      ADS_OPTIMIZER_EDITOR_RECOMMENDATION_FIELDS.map((field) => [
        field.key,
        requiredFormNumber(
          formData,
          adsOptimizerDraftFieldName('recommendation', field.key),
          field.label
        ),
      ])
    );
    const guardrailThresholds = Object.fromEntries(
      ADS_OPTIMIZER_EDITOR_GUARDRAIL_FIELDS.filter((field) => 'step' in field).map((field) => [
        field.key,
        requiredFormNumber(
          formData,
          adsOptimizerDraftFieldName('guardrails', field.key),
          field.label
        ),
      ])
    );
    const lossMakerPolicy = {
      protected_ad_sales_share_min: requiredFormNumber(
        formData,
        adsOptimizerDraftFieldName('loss_maker', 'protected_ad_sales_share_min'),
        'Protected ad sales share minimum'
      ),
      protected_order_share_min: requiredFormNumber(
        formData,
        adsOptimizerDraftFieldName('loss_maker', 'protected_order_share_min'),
        'Protected order share minimum'
      ),
      protected_total_sales_share_min: requiredFormNumber(
        formData,
        adsOptimizerDraftFieldName('loss_maker', 'protected_total_sales_share_min'),
        'Protected total sales share minimum'
      ),
      shallow_loss_ratio_max: requiredFormNumber(
        formData,
        adsOptimizerDraftFieldName('loss_maker', 'shallow_loss_ratio_max'),
        'Shallow loss ratio maximum'
      ),
      moderate_loss_ratio_max: requiredFormNumber(
        formData,
        adsOptimizerDraftFieldName('loss_maker', 'moderate_loss_ratio_max'),
        'Moderate loss ratio maximum'
      ),
      severe_loss_ratio_min: requiredFormNumber(
        formData,
        adsOptimizerDraftFieldName('loss_maker', 'severe_loss_ratio_min'),
        'Severe loss ratio minimum'
      ),
      pause_protected_contributors: isChecked(
        formData,
        adsOptimizerDraftFieldName('loss_maker', 'pause_protected_contributors')
      ),
    };
    const phasedRecoveryPolicy = {
      default_steps: requiredFormNumber(
        formData,
        adsOptimizerDraftFieldName('phased_recovery', 'default_steps'),
        'Default phased recovery steps'
      ),
      important_target_steps: requiredFormNumber(
        formData,
        adsOptimizerDraftFieldName('phased_recovery', 'important_target_steps'),
        'Important target phased recovery steps'
      ),
      visibility_led_steps: requiredFormNumber(
        formData,
        adsOptimizerDraftFieldName('phased_recovery', 'visibility_led_steps'),
        'Visibility-led phased recovery steps'
      ),
      design_led_steps: requiredFormNumber(
        formData,
        adsOptimizerDraftFieldName('phased_recovery', 'design_led_steps'),
        'Design-led phased recovery steps'
      ),
      max_step_bid_decrease_pct: requiredFormNumber(
        formData,
        adsOptimizerDraftFieldName('phased_recovery', 'max_step_bid_decrease_pct'),
        'Max step bid decrease %'
      ),
      continue_until_break_even: isChecked(
        formData,
        adsOptimizerDraftFieldName('phased_recovery', 'continue_until_break_even')
      ),
    };
    const roleBiasPolicy = Object.fromEntries(
      ADS_OPTIMIZER_EDITOR_ROLE_BIAS_FIELDS.map((field) => [
        field.key,
        isChecked(formData, adsOptimizerDraftFieldName('role_bias', field.key)),
      ])
    );
    const roleTemplates = Object.fromEntries(
      ADS_OPTIMIZER_TARGET_ROLES.map((role) => [
        role,
        {
          enabled: isChecked(formData, adsOptimizerDraftFieldName('role_template', role)),
        },
      ])
    );

    const saved = await updateRulePackVersionDraft({
      rulePackVersionId,
      versionLabel,
      changeSummary,
      changePayloadPatch: {
        strategy_profile: strategyProfile,
        state_engine: {
          thresholds: stateThresholds,
        },
        guardrail_templates: {
          default: {
            thresholds: {
              ...guardrailThresholds,
              manual_approval_threshold: manualApprovalThreshold,
            },
          },
        },
        action_policy: {
          recommendation_thresholds: recommendationThresholds,
        },
        loss_maker_policy: lossMakerPolicy,
        phased_recovery_policy: phasedRecoveryPolicy,
        role_bias_policy: roleBiasPolicy,
        role_templates: roleTemplates,
      },
    });

    revalidatePath('/ads/optimizer');
    redirectWithFlash(returnTo, {
      notice: `Saved draft version ${saved.version_label}.`,
    });
  } catch (error) {
    rethrowRedirectError(error);
    redirectWithFlash(returnTo, {
      error: error instanceof Error ? error.message : 'Failed to save optimizer draft version.',
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
