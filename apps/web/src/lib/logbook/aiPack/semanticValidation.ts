import 'server-only';

import { supabaseAdmin } from '../../supabaseAdmin';
import {
  loadSbCampaignIdsForAsin,
  loadSpCampaignIdsForAsin,
} from './findAsinCampaignIds';

import type { ParsedExperimentEvaluationOutputPack } from './parseExperimentEvaluationOutputPack';
import type { ParsedProductExperimentOutputPack } from './parseProductExperimentOutputPack';
import type { PatchDecisionV1 } from '../contracts/adsOptimizationContractV1';
import { buildProposalActionRefs, type ExecutableBulkgenPlanV1 } from '../contracts/reviewPatchPlan';

export type SemanticValidationIssue = {
  code:
    | 'entity_not_found'
    | 'entity_scope_mismatch'
    | 'product_not_found'
    | 'patch_change_id_not_found'
    | 'patch_change_id_duplicate'
    | 'kiv_id_not_found'
    | 'kiv_id_scope_mismatch';
  field: string;
  id: string;
  message: string;
  recommendation: string;
  channel?: 'SP' | 'SB' | 'SD';
  context?: Record<string, unknown>;
};

export type SemanticValidationResult = {
  issues: SemanticValidationIssue[];
  warnings: string[];
};

type Channel = 'SP' | 'SB' | 'SD';

type LookupResult = {
  issue: SemanticValidationIssue | null;
  campaign_id: string | null;
};

type AsinScopeContext = {
  asin: string;
  accountId: string;
  startDate?: string | null;
  endDate?: string | null;
};

type AsinCampaignScopeCache = {
  SP?: Set<string>;
  SB?: Set<string>;
  SD?: Set<string>;
};

type ValidateBelongsResult = {
  issue: SemanticValidationIssue | null;
  warning?: string;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeAsin = (value: string) => value.trim().toUpperCase();

const parseChannel = (value: unknown): Channel | null => {
  const normalized = asString(value)?.toUpperCase();
  if (normalized === 'SP' || normalized === 'SB' || normalized === 'SD') {
    return normalized;
  }
  return null;
};

const issue = (value: SemanticValidationIssue): SemanticValidationIssue => value;

const firstLine = (value: string) => value.split('\n')[0] ?? value;

const selectCampaignTable = (channel: Channel) => {
  if (channel === 'SP') return 'sp_campaign_hourly_fact_latest';
  if (channel === 'SB') return 'sb_campaign_daily_fact_latest';
  return 'sd_campaign_daily_fact_latest';
};

const selectAdGroupTable = (channel: Channel) => {
  if (channel === 'SP') return 'sp_targeting_daily_fact_latest';
  if (channel === 'SB') return 'sb_keyword_daily_fact_latest';
  return 'sd_targeting_daily_fact_latest';
};

const selectTargetTable = (channel: Channel) => {
  if (channel === 'SP') return 'sp_targeting_daily_fact_latest';
  if (channel === 'SB') return 'sb_keyword_daily_fact_latest';
  return 'sd_targeting_daily_fact_latest';
};

const loadSdCampaignIdsForAsin = async (params: {
  asin: string;
  accountId: string;
  startDate?: string | null;
  endDate?: string | null;
}): Promise<string[]> => {
  let query = supabaseAdmin
    .from('sd_advertised_product_daily_fact_latest')
    .select('campaign_id')
    .eq('account_id', params.accountId)
    .eq('advertised_asin_norm', params.asin.trim().toLowerCase())
    .limit(5000);
  if (params.startDate) query = query.gte('date', params.startDate);
  if (params.endDate) query = query.lte('date', params.endDate);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed loading SD campaign IDs for ASIN scope: ${error.message}`);
  }
  const ids = new Set<string>();
  for (const row of data ?? []) {
    const id = asString((row as { campaign_id?: unknown }).campaign_id);
    if (!id) continue;
    ids.add(id);
  }
  return [...ids];
};

const loadAsinCampaignScope = async (params: {
  channel: Channel;
  context: AsinScopeContext;
  cache: AsinCampaignScopeCache;
}): Promise<Set<string>> => {
  const cached = params.cache[params.channel];
  if (cached) return cached;

  const { asin, accountId, startDate, endDate } = params.context;
  let ids: string[] = [];
  if (params.channel === 'SP') {
    ids = await loadSpCampaignIdsForAsin({
      asin,
      accountId,
      snapshotDate: null,
      namePattern: '',
      startDate: startDate ?? undefined,
      endDate: endDate ?? undefined,
    });
  } else if (params.channel === 'SB') {
    ids = await loadSbCampaignIdsForAsin({
      asin,
      accountId,
      snapshotDate: null,
      namePattern: '',
      startDate: startDate ?? undefined,
      endDate: endDate ?? undefined,
    });
  } else {
    ids = await loadSdCampaignIdsForAsin({
      asin,
      accountId,
      startDate,
      endDate,
    });
  }

  const set = new Set(ids);
  params.cache[params.channel] = set;
  return set;
};

export const validateCampaignExists = async (params: {
  channel: Channel;
  campaignId: string;
  accountId: string;
  field: string;
}): Promise<LookupResult> => {
  const campaignId = params.campaignId.trim();
  if (!campaignId) {
    return {
      issue: issue({
        code: 'entity_not_found',
        field: params.field,
        id: '',
        channel: params.channel,
        message: `Missing ${params.field}.`,
        recommendation: 'Regenerate the AI pack so each action has required IDs.',
      }),
      campaign_id: null,
    };
  }

  const { data, error } = await supabaseAdmin
    .from(selectCampaignTable(params.channel))
    .select('campaign_id')
    .eq('account_id', params.accountId)
    .eq('campaign_id', campaignId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed validating campaign_id (${campaignId}): ${error.message}`);
  }

  if (!data) {
    return {
      issue: issue({
        code: 'entity_not_found',
        field: params.field,
        id: campaignId,
        channel: params.channel,
        message: `${params.channel} campaign_id ${campaignId} was not found for this account.`,
        recommendation:
          'Regenerate the pack from the latest baseline data, or switch to the correct account/marketplace.',
      }),
      campaign_id: null,
    };
  }

  return { issue: null, campaign_id: campaignId };
};

export const validateAdGroupExists = async (params: {
  channel: Channel;
  adGroupId: string;
  accountId: string;
  field: string;
}): Promise<LookupResult> => {
  const adGroupId = params.adGroupId.trim();
  if (!adGroupId) {
    return {
      issue: issue({
        code: 'entity_not_found',
        field: params.field,
        id: '',
        channel: params.channel,
        message: `Missing ${params.field}.`,
        recommendation: 'Regenerate the AI pack so each action has required IDs.',
      }),
      campaign_id: null,
    };
  }

  const { data, error } = await supabaseAdmin
    .from(selectAdGroupTable(params.channel))
    .select('campaign_id,ad_group_id')
    .eq('account_id', params.accountId)
    .eq('ad_group_id', adGroupId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed validating ad_group_id (${adGroupId}): ${error.message}`);
  }

  if (!data) {
    return {
      issue: issue({
        code: 'entity_not_found',
        field: params.field,
        id: adGroupId,
        channel: params.channel,
        message: `${params.channel} ad_group_id ${adGroupId} was not found for this account.`,
        recommendation:
          'Regenerate the pack from the latest baseline data, or switch to the correct account/marketplace.',
      }),
      campaign_id: null,
    };
  }

  return {
    issue: null,
    campaign_id: asString((data as { campaign_id?: unknown }).campaign_id),
  };
};

export const validateKeywordOrTargetExists = async (params: {
  channel: Channel;
  targetId: string;
  accountId: string;
  field: string;
}): Promise<LookupResult> => {
  const targetId = params.targetId.trim();
  if (!targetId) {
    return {
      issue: issue({
        code: 'entity_not_found',
        field: params.field,
        id: '',
        channel: params.channel,
        message: `Missing ${params.field}.`,
        recommendation: 'Regenerate the AI pack so each action has required IDs.',
      }),
      campaign_id: null,
    };
  }

  const { data, error } = await supabaseAdmin
    .from(selectTargetTable(params.channel))
    .select('campaign_id,target_id')
    .eq('account_id', params.accountId)
    .eq('target_id', targetId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed validating target_id (${targetId}): ${error.message}`);
  }

  if (!data) {
    return {
      issue: issue({
        code: 'entity_not_found',
        field: params.field,
        id: targetId,
        channel: params.channel,
        message: `${params.channel} target_id ${targetId} was not found for this account.`,
        recommendation:
          'Regenerate the pack from the latest baseline data, or switch to the correct account/marketplace.',
      }),
      campaign_id: null,
    };
  }

  return {
    issue: null,
    campaign_id: asString((data as { campaign_id?: unknown }).campaign_id),
  };
};

export const validateBelongsToAsinScope = async (params: {
  channel: Channel;
  campaignId: string;
  asinScope: AsinScopeContext;
  cache: AsinCampaignScopeCache;
  field: string;
}): Promise<ValidateBelongsResult> => {
  const campaignId = params.campaignId.trim();
  if (!campaignId) {
    return {
      issue: issue({
        code: 'entity_scope_mismatch',
        field: params.field,
        id: '',
        channel: params.channel,
        message: `Cannot verify ASIN scope because ${params.field} is missing.`,
        recommendation: 'Regenerate the pack to include complete campaign references.',
      }),
    };
  }

  const campaigns = await loadAsinCampaignScope({
    channel: params.channel,
    context: params.asinScope,
    cache: params.cache,
  });

  if (campaigns.size === 0) {
    return {
      issue: null,
      warning: `Skipped strict ASIN scope check for ${params.channel}; no campaign candidates found for ASIN ${params.asinScope.asin}.`,
    };
  }

  if (!campaigns.has(campaignId)) {
    return {
      issue: issue({
        code: 'entity_scope_mismatch',
        field: params.field,
        id: campaignId,
        channel: params.channel,
        message: `${params.channel} campaign_id ${campaignId} does not belong to ASIN scope ${params.asinScope.asin}.`,
        recommendation:
          'Regenerate the pack for this ASIN, or remove cross-product actions and use the correct experiment scope.',
      }),
    };
  }

  return { issue: null };
};

export const formatSemanticIssuesForError = (
  issues: SemanticValidationIssue[],
  prefix = 'Semantic validation failed.'
): string => {
  if (issues.length === 0) return prefix;
  const lines = issues.slice(0, 6).map((entry) => {
    const idPart = entry.id ? ` (${entry.id})` : '';
    return `${entry.field}${idPart}: ${entry.message}`;
  });
  const suffix = issues.length > 6 ? `\n- ...and ${issues.length - 6} more issue(s).` : '';
  return `${prefix}\n- ${lines.join('\n- ')}${suffix}`;
};

export const validateReviewPatchDecisionIds = (params: {
  decisions: PatchDecisionV1[];
  proposalPlans: ExecutableBulkgenPlanV1[];
}): SemanticValidationIssue[] => {
  const refs = buildProposalActionRefs(params.proposalPlans);
  const validChangeIds = new Set(refs.map((ref) => ref.change_id));
  const seen = new Set<string>();
  const issues: SemanticValidationIssue[] = [];

  params.decisions.forEach((decision, index) => {
    const changeId = asString(decision.change_id) ?? '';
    const field = `patch.decisions[${index}].change_id`;
    if (!changeId) {
      issues.push(
        issue({
          code: 'patch_change_id_not_found',
          field,
          id: '',
          message: 'Missing change_id in review patch decision.',
          recommendation: 'Download a fresh Review Patch Pack and apply edits to its existing change_id values.',
        })
      );
      return;
    }

    if (seen.has(changeId)) {
      issues.push(
        issue({
          code: 'patch_change_id_duplicate',
          field,
          id: changeId,
          message: `Duplicate change_id ${changeId} in review patch decisions.`,
          recommendation: 'Keep one decision per change_id and re-upload the patch pack.',
        })
      );
      return;
    }
    seen.add(changeId);

    if (!validChangeIds.has(changeId)) {
      issues.push(
        issue({
          code: 'patch_change_id_not_found',
          field,
          id: changeId,
          message: `change_id ${changeId} is not present in the experiment proposal plan.`,
          recommendation: 'Regenerate or re-download the patch pack for this exact experiment before editing.',
        })
      );
    }
  });

  return issues;
};

export const validateExperimentPackSemanticBoundaries = async (params: {
  parsed: ParsedProductExperimentOutputPack;
  accountId: string;
  marketplace: string;
  currentAsin: string;
}): Promise<SemanticValidationResult> => {
  const issues: SemanticValidationIssue[] = [];
  const warnings: string[] = [];
  const asin = normalizeAsin(params.parsed.product_asin);
  const routeAsin = normalizeAsin(params.currentAsin);
  if (routeAsin !== asin) {
    issues.push(
      issue({
        code: 'entity_scope_mismatch',
        field: 'product.asin',
        id: asin,
        message: `Pack ASIN ${asin} does not match selected product ASIN ${routeAsin}.`,
        recommendation: 'Import the pack on the matching product page, or regenerate the pack for this ASIN.',
      })
    );
  }
  const startDate = asString((params.parsed.experiment.scope as { start_date?: unknown }).start_date);
  const endDate = asString((params.parsed.experiment.scope as { end_date?: unknown }).end_date);
  const asinScope: AsinScopeContext = {
    asin,
    accountId: params.accountId,
    startDate,
    endDate,
  };
  const scopeCache: AsinCampaignScopeCache = {};

  const { data: productRow, error: productError } = await supabaseAdmin
    .from('products')
    .select('product_id')
    .eq('account_id', params.accountId)
    .eq('marketplace', params.marketplace)
    .eq('asin', asin)
    .maybeSingle();
  if (productError) {
    throw new Error(`Failed validating product ASIN scope: ${productError.message}`);
  }
  if (!productRow?.product_id) {
    issues.push(
      issue({
        code: 'product_not_found',
        field: 'product.asin',
        id: asin,
        message: `ASIN ${asin} was not found in products for this account/marketplace.`,
        recommendation:
          'Seed or sync the product first, then regenerate the pack from the same account/marketplace.',
      })
    );
  }

  const plans = Array.isArray((params.parsed.experiment.scope as { bulkgen_plans?: unknown }).bulkgen_plans)
    ? ((params.parsed.experiment.scope as { bulkgen_plans?: unknown }).bulkgen_plans as Array<{
        channel: 'SP' | 'SB';
        actions: Array<Record<string, unknown>>;
      }>)
    : [];

  for (let planIndex = 0; planIndex < plans.length; planIndex += 1) {
    const plan = plans[planIndex];
    const channel = parseChannel(plan.channel);
    if (!channel || channel === 'SD') continue;

    for (let actionIndex = 0; actionIndex < plan.actions.length; actionIndex += 1) {
      const action = plan.actions[actionIndex];
      const actionType = asString(action.type) ?? '';
      const baseField = `experiment.scope.bulkgen_plans[${planIndex}].actions[${actionIndex}]`;

      const validateCampaignAndScope = async (field: string, campaignId: string) => {
        const campaignResult = await validateCampaignExists({
          channel,
          campaignId,
          accountId: params.accountId,
          field,
        });
        if (campaignResult.issue) {
          issues.push(campaignResult.issue);
          return;
        }
        const scopeResult = await validateBelongsToAsinScope({
          channel,
          campaignId,
          asinScope,
          cache: scopeCache,
          field,
        });
        if (scopeResult.issue) issues.push(scopeResult.issue);
        if (scopeResult.warning) warnings.push(scopeResult.warning);
      };

      if (
        actionType === 'update_campaign_budget' ||
        actionType === 'update_campaign_state' ||
        actionType === 'update_campaign_bidding_strategy' ||
        actionType === 'update_placement_modifier'
      ) {
        await validateCampaignAndScope(`${baseField}.campaign_id`, asString(action.campaign_id) ?? '');
        continue;
      }

      if (actionType === 'update_ad_group_state' || actionType === 'update_ad_group_default_bid') {
        const adGroupResult = await validateAdGroupExists({
          channel,
          adGroupId: asString(action.ad_group_id) ?? '',
          accountId: params.accountId,
          field: `${baseField}.ad_group_id`,
        });
        if (adGroupResult.issue) {
          issues.push(adGroupResult.issue);
          continue;
        }
        if (adGroupResult.campaign_id) {
          const scopeResult = await validateBelongsToAsinScope({
            channel,
            campaignId: adGroupResult.campaign_id,
            asinScope,
            cache: scopeCache,
            field: `${baseField}.ad_group_id`,
          });
          if (scopeResult.issue) issues.push(scopeResult.issue);
          if (scopeResult.warning) warnings.push(scopeResult.warning);
        }
        continue;
      }

      if (actionType === 'update_target_bid' || actionType === 'update_target_state') {
        const targetResult = await validateKeywordOrTargetExists({
          channel,
          targetId: asString(action.target_id) ?? '',
          accountId: params.accountId,
          field: `${baseField}.target_id`,
        });
        if (targetResult.issue) {
          issues.push(targetResult.issue);
          continue;
        }
        if (targetResult.campaign_id) {
          const scopeResult = await validateBelongsToAsinScope({
            channel,
            campaignId: targetResult.campaign_id,
            asinScope,
            cache: scopeCache,
            field: `${baseField}.target_id`,
          });
          if (scopeResult.issue) issues.push(scopeResult.issue);
          if (scopeResult.warning) warnings.push(scopeResult.warning);
        }
      }
    }
  }

  for (let changeIndex = 0; changeIndex < params.parsed.manual_changes.length; changeIndex += 1) {
    const change = params.parsed.manual_changes[changeIndex];
    const channel = parseChannel(change.channel);
    for (let entityIndex = 0; entityIndex < change.entities.length; entityIndex += 1) {
      const entity = change.entities[entityIndex];
      const baseField = `manual_changes[${changeIndex}].entities[${entityIndex}]`;
      const entityAsin = asString(entity.product_id)?.toUpperCase();
      if (entityAsin && entityAsin !== asin) {
        issues.push(
          issue({
            code: 'entity_scope_mismatch',
            field: `${baseField}.product_id`,
            id: entityAsin,
            message: `Entity product_id ${entityAsin} does not match experiment ASIN ${asin}.`,
            recommendation:
              'Update the entity scope to this ASIN, or move this change to an experiment for the other ASIN.',
          })
        );
      }

      if (!channel) {
        const hasEntityIds = Boolean(entity.campaign_id || entity.ad_group_id || entity.target_id || entity.keyword_id);
        if (hasEntityIds) {
          warnings.push(
            `Skipped strict semantic validation for ${baseField} because channel ${change.channel} is not SP/SB/SD.`
          );
        }
        continue;
      }

      if (entity.campaign_id) {
        const campaignResult = await validateCampaignExists({
          channel,
          campaignId: entity.campaign_id,
          accountId: params.accountId,
          field: `${baseField}.campaign_id`,
        });
        if (campaignResult.issue) {
          issues.push(campaignResult.issue);
        } else {
          const scopeResult = await validateBelongsToAsinScope({
            channel,
            campaignId: entity.campaign_id,
            asinScope,
            cache: scopeCache,
            field: `${baseField}.campaign_id`,
          });
          if (scopeResult.issue) issues.push(scopeResult.issue);
          if (scopeResult.warning) warnings.push(scopeResult.warning);
        }
      }

      if (entity.ad_group_id) {
        const adGroupResult = await validateAdGroupExists({
          channel,
          adGroupId: entity.ad_group_id,
          accountId: params.accountId,
          field: `${baseField}.ad_group_id`,
        });
        if (adGroupResult.issue) {
          issues.push(adGroupResult.issue);
        }
      }

      const targetId = asString(entity.target_id) ?? asString(entity.keyword_id);
      if (targetId) {
        const targetResult = await validateKeywordOrTargetExists({
          channel,
          targetId,
          accountId: params.accountId,
          field: entity.target_id ? `${baseField}.target_id` : `${baseField}.keyword_id`,
        });
        if (targetResult.issue) {
          issues.push(targetResult.issue);
        }
      }
    }
  }

  return { issues, warnings };
};

export const validateEvaluationPackSemanticBoundaries = async (params: {
  parsed: ParsedExperimentEvaluationOutputPack;
  accountId: string;
  marketplace: string;
  asinNorm: string;
}): Promise<SemanticValidationResult> => {
  const issues: SemanticValidationIssue[] = [];
  const warnings: string[] = [];
  const asinNorm = normalizeAsin(params.asinNorm);
  const updates = params.parsed.evaluation.kiv_updates;
  const kivIds = [...new Set(updates.map((update) => asString(update.kiv_id)).filter((id): id is string => Boolean(id)))];
  if (kivIds.length === 0) {
    return { issues, warnings };
  }

  const { data: rows, error } = await supabaseAdmin
    .from('log_product_kiv_items')
    .select('kiv_id,asin_norm')
    .eq('account_id', params.accountId)
    .eq('marketplace', params.marketplace)
    .in('kiv_id', kivIds);

  if (error) {
    throw new Error(`Failed validating KIV IDs: ${error.message}`);
  }

  const rowByKivId = new Map<string, { kiv_id: string; asin_norm: string | null }>();
  for (const row of rows ?? []) {
    const kivId = asString((row as { kiv_id?: unknown }).kiv_id);
    if (!kivId) continue;
    rowByKivId.set(kivId, {
      kiv_id: kivId,
      asin_norm: asString((row as { asin_norm?: unknown }).asin_norm) ?? null,
    });
  }

  updates.forEach((update, index) => {
    const kivId = asString(update.kiv_id);
    if (!kivId) return;
    const field = `evaluation.kiv_updates[${index}].kiv_id`;
    const row = rowByKivId.get(kivId);
    if (!row) {
      issues.push(
        issue({
          code: 'kiv_id_not_found',
          field,
          id: kivId,
          message: `kiv_id ${kivId} was not found for this account/marketplace.`,
          recommendation:
            'Regenerate the evaluation output pack from current logbook context, or remove stale KIV IDs.',
        })
      );
      return;
    }
    const rowAsin = normalizeAsin(row.asin_norm ?? '');
    if (rowAsin && rowAsin !== asinNorm) {
      issues.push(
        issue({
          code: 'kiv_id_scope_mismatch',
          field,
          id: kivId,
          message: `kiv_id ${kivId} belongs to ASIN ${rowAsin}, not ${asinNorm}.`,
          recommendation: 'Pick KIV items for the correct ASIN, then regenerate and re-upload evaluation output.',
        })
      );
    }
  });

  return { issues, warnings };
};

export const toSemanticErrorDetails = (result: SemanticValidationResult) => ({
  semantic_issues: result.issues,
  semantic_warnings: result.warnings,
});

export const summarizeSemanticFailure = (result: SemanticValidationResult, prefix?: string) =>
  formatSemanticIssuesForError(result.issues, prefix ?? 'Semantic validation failed.');

export const semanticValidationFailed = (result: SemanticValidationResult) =>
  result.issues.length > 0;

export const semanticValidationErrorToIssue = (params: {
  field: string;
  id: string;
  message: string;
  recommendation: string;
  channel?: Channel;
}): SemanticValidationIssue =>
  issue({
    code: 'entity_not_found',
    field: params.field,
    id: params.id,
    message: firstLine(params.message),
    recommendation: params.recommendation,
    channel: params.channel,
  });
