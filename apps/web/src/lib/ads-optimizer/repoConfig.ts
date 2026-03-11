import 'server-only';

import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  ADS_OPTIMIZER_DEFAULT_CHANGE_SUMMARY,
  ADS_OPTIMIZER_DEFAULT_RULE_PACK_DESCRIPTION,
  ADS_OPTIMIZER_DEFAULT_RULE_PACK_NAME,
  ADS_OPTIMIZER_DEFAULT_VERSION_LABEL,
  buildDefaultAdsOptimizerRulePackPayload,
} from './defaults';
import type {
  AdsOptimizerManualOverride,
  AdsOptimizerManualOverrideRow,
  AdsOptimizerProductSettings,
  AdsOptimizerProductSettingsRow,
  AdsOptimizerRulePack,
  AdsOptimizerRulePackRow,
  AdsOptimizerRulePackVersion,
  AdsOptimizerRulePackVersionRow,
  AdsOptimizerScopeType,
  CreateAdsOptimizerRulePackPayload,
  CreateAdsOptimizerRulePackVersionPayload,
  SaveAdsOptimizerManualOverridePayload,
  SaveAdsOptimizerProductSettingsPayload,
} from './types';
import {
  mapAdsOptimizerManualOverrideRow,
  mapAdsOptimizerProductSettingsRow,
  mapAdsOptimizerRulePackRow,
  mapAdsOptimizerRulePackVersionRow,
} from './types';
import {
  validateCreateAdsOptimizerRulePackPayload,
  validateCreateAdsOptimizerRulePackVersionPayload,
  validateSaveAdsOptimizerManualOverridePayload,
  validateSaveAdsOptimizerProductSettingsPayload,
} from './validation';

const RULE_PACK_SELECT = [
  'rule_pack_id',
  'account_id',
  'marketplace',
  'channel',
  'scope_type',
  'scope_value',
  'name',
  'description',
  'is_archived',
  'created_at',
  'updated_at',
].join(',');

const RULE_PACK_VERSION_SELECT = [
  'rule_pack_version_id',
  'rule_pack_id',
  'version_label',
  'status',
  'change_summary',
  'change_payload_json',
  'created_from_version_id',
  'created_at',
  'activated_at',
  'archived_at',
].join(',');

const PRODUCT_SETTINGS_SELECT = [
  'product_id',
  'account_id',
  'marketplace',
  'archetype',
  'optimizer_enabled',
  'default_objective_mode',
  'rule_pack_version_id',
  'strategic_notes',
  'guardrail_overrides_json',
  'created_at',
  'updated_at',
].join(',');

const MANUAL_OVERRIDE_SELECT = [
  'manual_override_id',
  'account_id',
  'marketplace',
  'product_id',
  'override_key',
  'override_value_json',
  'notes',
  'is_archived',
  'created_at',
  'updated_at',
  'archived_at',
].join(',');

const assertProductExists = async (productId: string) => {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('product_id')
    .eq('product_id', productId)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to validate product: ${error.message}`);
  }
  if (!data) {
    throw new Error('Product was not found in this account/marketplace.');
  }
};

const assertRulePackVersionInScope = async (rulePackVersionId: string) => {
  const version = await getRulePackVersion(rulePackVersionId);
  if (!version) {
    throw new Error('Optimizer rule pack version not found.');
  }

  const { data, error } = await supabaseAdmin
    .from('ads_optimizer_rule_packs')
    .select('rule_pack_id')
    .eq('rule_pack_id', version.rule_pack_id)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to validate optimizer rule pack scope: ${error.message}`);
  }
  if (!data) {
    throw new Error('Optimizer rule pack version was not found in this account/marketplace.');
  }

  return version;
};

export const getRulePackVersion = async (
  rulePackVersionId: string
): Promise<AdsOptimizerRulePackVersion | null> => {
  const { data, error } = await supabaseAdmin
    .from('ads_optimizer_rule_pack_versions')
    .select(RULE_PACK_VERSION_SELECT)
    .eq('rule_pack_version_id', rulePackVersionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load optimizer rule pack version: ${error.message}`);
  }
  return data
    ? mapAdsOptimizerRulePackVersionRow(data as unknown as AdsOptimizerRulePackVersionRow)
    : null;
};

export const getRulePackByScope = async (args: {
  channel: 'sp';
  scopeType?: AdsOptimizerScopeType;
  scopeValue?: string | null;
  includeArchived?: boolean;
}): Promise<AdsOptimizerRulePack | null> => {
  const scopeType = args.scopeType ?? 'account';
  let query = supabaseAdmin
    .from('ads_optimizer_rule_packs')
    .select(RULE_PACK_SELECT)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .eq('channel', args.channel)
    .eq('scope_type', scopeType);

  query =
    scopeType === 'account'
      ? query.is('scope_value', null)
      : query.eq('scope_value', args.scopeValue ?? '');

  if (!args.includeArchived) {
    query = query.eq('is_archived', false);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(`Failed to load optimizer rule pack: ${error.message}`);
  }

  return data ? mapAdsOptimizerRulePackRow(data as unknown as AdsOptimizerRulePackRow) : null;
};

export const listRulePacks = async (options: {
  channel?: 'sp';
  includeArchived?: boolean;
} = {}): Promise<AdsOptimizerRulePack[]> => {
  let query = supabaseAdmin
    .from('ads_optimizer_rule_packs')
    .select(RULE_PACK_SELECT)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .order('updated_at', { ascending: false });

  if (options.channel) {
    query = query.eq('channel', options.channel);
  }
  if (!options.includeArchived) {
    query = query.eq('is_archived', false);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list optimizer rule packs: ${error.message}`);
  }

  return ((data ?? []) as unknown as AdsOptimizerRulePackRow[]).map(mapAdsOptimizerRulePackRow);
};

export const createRulePack = async (
  payload: CreateAdsOptimizerRulePackPayload
): Promise<AdsOptimizerRulePack> => {
  const value = validateCreateAdsOptimizerRulePackPayload(payload);
  const { data, error } = await supabaseAdmin
    .from('ads_optimizer_rule_packs')
    .insert({
      account_id: env.accountId,
      marketplace: env.marketplace,
      ...value,
    })
    .select(RULE_PACK_SELECT)
    .single();

  if (error || !data) {
    throw new Error(`Failed to create optimizer rule pack: ${error?.message ?? 'unknown error'}`);
  }

  return mapAdsOptimizerRulePackRow(data as unknown as AdsOptimizerRulePackRow);
};

export const archiveRulePack = async (rulePackId: string): Promise<AdsOptimizerRulePack> => {
  const { data, error } = await supabaseAdmin
    .from('ads_optimizer_rule_packs')
    .update({
      is_archived: true,
      updated_at: new Date().toISOString(),
    })
    .eq('rule_pack_id', rulePackId)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .select(RULE_PACK_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to archive optimizer rule pack: ${error.message}`);
  }
  if (!data) {
    throw new Error('Optimizer rule pack not found.');
  }

  return mapAdsOptimizerRulePackRow(data as unknown as AdsOptimizerRulePackRow);
};

export const listRulePackVersions = async (
  rulePackId: string,
  options: { includeArchived?: boolean } = {}
): Promise<AdsOptimizerRulePackVersion[]> => {
  let query = supabaseAdmin
    .from('ads_optimizer_rule_pack_versions')
    .select(RULE_PACK_VERSION_SELECT)
    .eq('rule_pack_id', rulePackId)
    .order('created_at', { ascending: false });

  if (!options.includeArchived) {
    query = query.neq('status', 'archived');
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list optimizer rule pack versions: ${error.message}`);
  }

  return ((data ?? []) as unknown as AdsOptimizerRulePackVersionRow[]).map(
    mapAdsOptimizerRulePackVersionRow
  );
};

export const createRulePackVersion = async (
  payload: CreateAdsOptimizerRulePackVersionPayload
): Promise<AdsOptimizerRulePackVersion> => {
  const value = validateCreateAdsOptimizerRulePackVersionPayload(payload);
  const rulePack = await supabaseAdmin
    .from('ads_optimizer_rule_packs')
    .select('rule_pack_id')
    .eq('rule_pack_id', value.rule_pack_id)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .maybeSingle();

  if (rulePack.error) {
    throw new Error(`Failed to validate optimizer rule pack: ${rulePack.error.message}`);
  }
  if (!rulePack.data) {
    throw new Error('Optimizer rule pack not found.');
  }

  if (value.created_from_version_id) {
    const parentVersion = await getRulePackVersion(value.created_from_version_id);
    if (!parentVersion || parentVersion.rule_pack_id !== value.rule_pack_id) {
      throw new Error('created_from_version_id must belong to the same rule pack.');
    }
  }

  if (value.status === 'active') {
    const activeVersions = await listRulePackVersions(value.rule_pack_id, { includeArchived: true });
    if (activeVersions.some((version) => version.status === 'active')) {
      throw new Error('An active version already exists for this rule pack.');
    }
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('ads_optimizer_rule_pack_versions')
    .insert({
      rule_pack_id: value.rule_pack_id,
      version_label: value.version_label,
      status: value.status,
      change_summary: value.change_summary,
      change_payload_json: value.change_payload_json,
      created_from_version_id: value.created_from_version_id,
      activated_at: value.status === 'active' ? now : null,
      archived_at: value.status === 'archived' ? now : null,
    })
    .select(RULE_PACK_VERSION_SELECT)
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create optimizer rule pack version: ${error?.message ?? 'unknown error'}`
    );
  }

  return mapAdsOptimizerRulePackVersionRow(data as unknown as AdsOptimizerRulePackVersionRow);
};

export const createRulePackVersionDraft = async (args: {
  rulePackId: string;
  sourceVersionId: string;
  versionLabel: string;
  changeSummary: string;
}): Promise<AdsOptimizerRulePackVersion> => {
  const sourceVersion = await getRulePackVersion(args.sourceVersionId);
  if (!sourceVersion || sourceVersion.rule_pack_id !== args.rulePackId) {
    throw new Error('Source version was not found for this rule pack.');
  }

  return createRulePackVersion({
    rule_pack_id: args.rulePackId,
    version_label: args.versionLabel,
    change_summary: args.changeSummary,
    change_payload_json: sourceVersion.change_payload_json,
    created_from_version_id: sourceVersion.rule_pack_version_id,
    status: 'draft',
  });
};

export const activateRulePackVersion = async (
  rulePackVersionId: string
): Promise<AdsOptimizerRulePackVersion> => {
  const target = await getRulePackVersion(rulePackVersionId);
  if (!target) {
    throw new Error('Optimizer rule pack version not found.');
  }

  const pack = await supabaseAdmin
    .from('ads_optimizer_rule_packs')
    .select('rule_pack_id')
    .eq('rule_pack_id', target.rule_pack_id)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .maybeSingle();

  if (pack.error) {
    throw new Error(`Failed to validate optimizer rule pack scope: ${pack.error.message}`);
  }
  if (!pack.data) {
    throw new Error('Optimizer rule pack was not found in this account/marketplace.');
  }

  const now = new Date().toISOString();
  const existingActive = await listRulePackVersions(target.rule_pack_id, { includeArchived: true });
  const currentActive = existingActive.find(
    (version) => version.status === 'active' && version.rule_pack_version_id !== rulePackVersionId
  );

  if (currentActive) {
    const archiveActive = await supabaseAdmin
      .from('ads_optimizer_rule_pack_versions')
      .update({
        status: 'archived',
        archived_at: now,
      })
      .eq('rule_pack_version_id', currentActive.rule_pack_version_id);

    if (archiveActive.error) {
      throw new Error(`Failed to archive existing active version: ${archiveActive.error.message}`);
    }
  }

  const { data, error } = await supabaseAdmin
    .from('ads_optimizer_rule_pack_versions')
    .update({
      status: 'active',
      activated_at: now,
      archived_at: null,
    })
    .eq('rule_pack_version_id', rulePackVersionId)
    .select(RULE_PACK_VERSION_SELECT)
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to activate optimizer rule pack version: ${error?.message ?? 'unknown error'}`
    );
  }

  return mapAdsOptimizerRulePackVersionRow(data as unknown as AdsOptimizerRulePackVersionRow);
};

export const archiveRulePackVersion = async (
  rulePackVersionId: string
): Promise<AdsOptimizerRulePackVersion> => {
  const existing = await assertRulePackVersionInScope(rulePackVersionId);
  if (existing.status === 'active') {
    throw new Error('Active optimizer rule pack versions cannot be archived directly.');
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('ads_optimizer_rule_pack_versions')
    .update({
      status: 'archived',
      archived_at: existing.archived_at ?? now,
    })
    .eq('rule_pack_version_id', rulePackVersionId)
    .select(RULE_PACK_VERSION_SELECT)
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to archive optimizer rule pack version: ${error?.message ?? 'unknown error'}`
    );
  }

  return mapAdsOptimizerRulePackVersionRow(data as unknown as AdsOptimizerRulePackVersionRow);
};

const hasUsableRulePackVersion = (versions: AdsOptimizerRulePackVersion[]) =>
  versions.some((version) => version.status !== 'archived');

const buildSeedVersionLabel = (versions: AdsOptimizerRulePackVersion[]) => {
  const existingLabels = new Set(versions.map((version) => version.version_label));
  if (!existingLabels.has(ADS_OPTIMIZER_DEFAULT_VERSION_LABEL)) {
    return ADS_OPTIMIZER_DEFAULT_VERSION_LABEL;
  }

  let suffix = 2;
  while (existingLabels.has(`${ADS_OPTIMIZER_DEFAULT_VERSION_LABEL}_${suffix}`)) {
    suffix += 1;
  }
  return `${ADS_OPTIMIZER_DEFAULT_VERSION_LABEL}_${suffix}`;
};

export const saveProductOptimizerSettings = async (
  payload: SaveAdsOptimizerProductSettingsPayload
): Promise<AdsOptimizerProductSettings> => {
  const value = validateSaveAdsOptimizerProductSettingsPayload(payload);
  await assertProductExists(value.product_id);

  await assertRulePackVersionInScope(value.rule_pack_version_id);

  const { data, error } = await supabaseAdmin
    .from('ads_optimizer_product_settings')
    .upsert(
      {
        product_id: value.product_id,
        account_id: env.accountId,
        marketplace: env.marketplace,
        archetype: value.archetype,
        optimizer_enabled: value.optimizer_enabled,
        default_objective_mode: value.default_objective_mode,
        rule_pack_version_id: value.rule_pack_version_id,
        strategic_notes: value.strategic_notes,
        guardrail_overrides_json: value.guardrail_overrides_json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'product_id' }
    )
    .select(PRODUCT_SETTINGS_SELECT)
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to save optimizer product settings: ${error?.message ?? 'unknown error'}`
    );
  }

  return mapAdsOptimizerProductSettingsRow(data as unknown as AdsOptimizerProductSettingsRow);
};

export const getProductOptimizerSettingsByProductId = async (
  productId: string
): Promise<AdsOptimizerProductSettings | null> => {
  const { data, error } = await supabaseAdmin
    .from('ads_optimizer_product_settings')
    .select(PRODUCT_SETTINGS_SELECT)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .eq('product_id', productId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load optimizer product settings: ${error.message}`);
  }

  return data ? mapAdsOptimizerProductSettingsRow(data as unknown as AdsOptimizerProductSettingsRow) : null;
};

export const assignRulePackVersionToProduct = async (args: {
  productId: string;
  rulePackVersionId: string;
}): Promise<AdsOptimizerProductSettings> =>
  saveProductOptimizerSettings({
    product_id: args.productId,
    archetype: 'hybrid',
    optimizer_enabled: true,
    rule_pack_version_id: args.rulePackVersionId,
  });

export const saveManualStrategicOverride = async (
  payload: SaveAdsOptimizerManualOverridePayload
): Promise<AdsOptimizerManualOverride> => {
  const value = validateSaveAdsOptimizerManualOverridePayload(payload);
  await assertProductExists(value.product_id);

  const now = new Date().toISOString();
  const archiveExisting = await supabaseAdmin
    .from('ads_optimizer_manual_overrides')
    .update({
      is_archived: true,
      archived_at: now,
      updated_at: now,
    })
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .eq('product_id', value.product_id)
    .eq('override_key', value.override_key)
    .eq('is_archived', false);

  if (archiveExisting.error) {
    throw new Error(
      `Failed to archive existing optimizer manual overrides: ${archiveExisting.error.message}`
    );
  }

  const { data, error } = await supabaseAdmin
    .from('ads_optimizer_manual_overrides')
    .insert({
      account_id: env.accountId,
      marketplace: env.marketplace,
      product_id: value.product_id,
      override_key: value.override_key,
      override_value_json: value.override_value_json,
      notes: value.notes,
    })
    .select(MANUAL_OVERRIDE_SELECT)
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to save optimizer manual override: ${error?.message ?? 'unknown error'}`
    );
  }

  return mapAdsOptimizerManualOverrideRow(data as unknown as AdsOptimizerManualOverrideRow);
};

export const ensureDefaultRulePackVersion = async (): Promise<{
  rulePack: AdsOptimizerRulePack;
  seeded: boolean;
  seedMessage: string | null;
  versions: AdsOptimizerRulePackVersion[];
  activeVersion: AdsOptimizerRulePackVersion | null;
}> => {
  let seeded = false;
  let seedMessage: string | null = null;
  let createdRulePack = false;
  let rulePack = await getRulePackByScope({
    channel: 'sp',
    scopeType: 'account',
    includeArchived: true,
  });

  if (!rulePack) {
    rulePack = await createRulePack({
      channel: 'sp',
      scope_type: 'account',
      name: ADS_OPTIMIZER_DEFAULT_RULE_PACK_NAME,
      description: ADS_OPTIMIZER_DEFAULT_RULE_PACK_DESCRIPTION,
    });
    createdRulePack = true;
  }

  let versions = await listRulePackVersions(rulePack.rule_pack_id, { includeArchived: true });
  if (!hasUsableRulePackVersion(versions)) {
    const createdVersion = await createRulePackVersion({
      rule_pack_id: rulePack.rule_pack_id,
      version_label: buildSeedVersionLabel(versions),
      change_summary: ADS_OPTIMIZER_DEFAULT_CHANGE_SUMMARY,
      change_payload_json: buildDefaultAdsOptimizerRulePackPayload(),
      status: 'active',
    });
    versions = [createdVersion, ...versions];
    seeded = true;
    seedMessage = createdRulePack
      ? 'Initialized the default SP V1 optimizer config foundation for this account/marketplace.'
      : 'Repaired the optimizer config foundation by creating the missing initial saved version.';
  }

  const activeVersion = versions.find((version) => version.status === 'active') ?? null;

  return { rulePack, seeded, seedMessage, versions, activeVersion };
};

export const getAdsOptimizerConfigViewData = async () => {
  return ensureDefaultRulePackVersion();
};
