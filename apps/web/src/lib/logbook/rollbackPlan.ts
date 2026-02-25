import type { SbUpdateAction } from '../../../../../src/bulksheet_gen_sb/types';
import type { SpUpdateAction } from '../../../../../src/bulksheet_gen_sp/types';

type JsonRecord = Record<string, unknown>;
type RollbackGenerator = 'bulkgen:sp:update' | 'bulkgen:sb:update';
type RollbackEntityKind = 'campaign' | 'ad_group' | 'target' | 'placement' | 'unknown';

type RollbackManualChange = {
  run_id: string;
  source_change_id: string;
  source_run_id: string | null;
  channel: string;
  change_type: 'rollback';
  summary: string;
  why: string;
  before_json: unknown;
  after_json: unknown;
};

type SpRollbackPlan = {
  channel: 'SP';
  generator: 'bulkgen:sp:update';
  run_id: string;
  actions: SpUpdateAction[];
  source_change_ids: string[];
};

type SbRollbackPlan = {
  channel: 'SB';
  generator: 'bulkgen:sb:update';
  run_id: string;
  actions: SbUpdateAction[];
  source_change_ids: string[];
};

export type OutputPackJson = {
  kind: 'experiment_output_pack';
  generated_at: string;
  experiment: {
    experiment_id: string;
    asin: string;
    marketplace: string;
  };
  rollback: {
    rollback_run_id: string;
    target_run_id: string | null;
    source_change_count: number;
    rollback_change_count: number;
    rollback_action_count: number;
  };
  bulkgen_plans: Array<SpRollbackPlan | SbRollbackPlan>;
  manual_changes: RollbackManualChange[];
  warnings: string[];
};

type RollbackChangeInput = {
  change_id: string;
  run_id: string | null;
  before_json: unknown;
  after_json: unknown;
  channel: string;
  summary: string | null;
};

type DedupeIdentity = {
  sourceRunId: string | null;
  generator: string | null;
  entity: string;
  campaignId: string | null;
  adGroupId: string | null;
  targetId: string | null;
};

type ResolveRollbackResult =
  | {
      ok: true;
      channel: 'SP';
      generator: 'bulkgen:sp:update';
      actions: SpUpdateAction[];
      sourceRunId: string | null;
      warnings: string[];
    }
  | {
      ok: true;
      channel: 'SB';
      generator: 'bulkgen:sb:update';
      actions: SbUpdateAction[];
      sourceRunId: string | null;
      warnings: string[];
    }
  | {
      ok: false;
      warnings: string[];
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

const asFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const normalizeGenerator = (value: string | null): RollbackGenerator | null => {
  if (!value) return null;
  if (value === 'bulkgen:sp:update') return value;
  if (value === 'bulkgen:sb:update') return value;
  return null;
};

const parseDedupeIdentity = (value: string | null): DedupeIdentity | null => {
  if (!value) return null;
  const parts = value.split('::');
  if (parts.length < 7) return null;
  return {
    sourceRunId: asString(parts[0]),
    generator: asString(parts[1]),
    entity: parts[2] ?? '',
    campaignId: asString(parts[3]),
    adGroupId: asString(parts[4]),
    targetId: asString(parts[5]),
  };
};

const classifyEntity = (entity: string): RollbackEntityKind => {
  const normalized = entity.trim().toLowerCase();
  if (!normalized) return 'unknown';
  if (normalized.includes('campaign')) return 'campaign';
  if (normalized.includes('ad group')) return 'ad_group';
  if (
    normalized.includes('keyword') ||
    normalized.includes('targeting') ||
    normalized.includes('target')
  ) {
    return 'target';
  }
  if (normalized.includes('bidding adjustment') || normalized.includes('placement')) return 'placement';
  return 'unknown';
};

const inferEntityKind = (before: JsonRecord, identity: DedupeIdentity | null): RollbackEntityKind => {
  const byEntity = classifyEntity(identity?.entity ?? '');
  if (byEntity !== 'unknown') return byEntity;

  if (before.percentage !== undefined) return 'placement';
  if (identity?.targetId) return 'target';
  if (identity?.adGroupId) return 'ad_group';
  if (identity?.campaignId) return 'campaign';
  return 'unknown';
};

const buildSpActions = (params: {
  before: JsonRecord;
  after: JsonRecord;
  kind: RollbackEntityKind;
  identity: DedupeIdentity | null;
}): { actions: SpUpdateAction[]; warnings: string[] } => {
  const warnings: string[] = [];
  const actions: SpUpdateAction[] = [];
  const campaignId = params.identity?.campaignId;
  const adGroupId = params.identity?.adGroupId;
  const targetId = params.identity?.targetId;

  if (params.kind === 'campaign') {
    const budget = asFiniteNumber(params.before.daily_budget);
    const state = asString(params.before.state);
    const strategy = asString(params.before.bidding_strategy);
    if (!campaignId) warnings.push('campaign_id missing in dedupe metadata.');
    if (campaignId && budget !== null) actions.push({ type: 'update_campaign_budget', campaign_id: campaignId, new_budget: budget });
    if (campaignId && state) actions.push({ type: 'update_campaign_state', campaign_id: campaignId, new_state: state });
    if (campaignId && strategy) {
      actions.push({
        type: 'update_campaign_bidding_strategy',
        campaign_id: campaignId,
        new_strategy: strategy,
      });
    }
    return { actions, warnings };
  }

  if (params.kind === 'ad_group') {
    const state = asString(params.before.state);
    const defaultBid = asFiniteNumber(params.before.default_bid);
    if (!adGroupId) warnings.push('ad_group_id missing in dedupe metadata.');
    if (adGroupId && state) actions.push({ type: 'update_ad_group_state', ad_group_id: adGroupId, new_state: state });
    if (adGroupId && defaultBid !== null) {
      actions.push({ type: 'update_ad_group_default_bid', ad_group_id: adGroupId, new_bid: defaultBid });
    }
    return { actions, warnings };
  }

  if (params.kind === 'target') {
    const state = asString(params.before.state);
    const bid = asFiniteNumber(params.before.bid);
    if (!targetId) warnings.push('target_id missing in dedupe metadata.');
    if (targetId && state) actions.push({ type: 'update_target_state', target_id: targetId, new_state: state });
    if (targetId && bid !== null) actions.push({ type: 'update_target_bid', target_id: targetId, new_bid: bid });
    return { actions, warnings };
  }

  if (params.kind === 'placement') {
    const percentage = asFiniteNumber(params.before.percentage);
    const placementCode =
      asString(params.before.placement_code)?.toUpperCase() ??
      asString(params.after.placement_code)?.toUpperCase();
    if (!campaignId) warnings.push('campaign_id missing in dedupe metadata.');
    if (percentage === null) warnings.push('before_json.percentage missing for placement rollback.');
    if (!placementCode) warnings.push('placement_code missing for SP placement rollback.');
    if (campaignId && placementCode && percentage !== null) {
      actions.push({
        type: 'update_placement_modifier',
        campaign_id: campaignId,
        placement_code: placementCode,
        new_pct: percentage,
      });
    }
    return { actions, warnings };
  }

  warnings.push('Could not classify rollback entity type for SP change.');
  return { actions, warnings };
};

const buildSbActions = (params: {
  before: JsonRecord;
  after: JsonRecord;
  kind: RollbackEntityKind;
  identity: DedupeIdentity | null;
}): { actions: SbUpdateAction[]; warnings: string[] } => {
  const warnings: string[] = [];
  const actions: SbUpdateAction[] = [];
  const campaignId = params.identity?.campaignId;
  const adGroupId = params.identity?.adGroupId;
  const targetId = params.identity?.targetId;

  if (params.kind === 'campaign') {
    const budget = asFiniteNumber(params.before.daily_budget);
    const state = asString(params.before.state);
    const strategy = asString(params.before.bidding_strategy);
    if (!campaignId) warnings.push('campaign_id missing in dedupe metadata.');
    if (campaignId && budget !== null) actions.push({ type: 'update_campaign_budget', campaign_id: campaignId, new_budget: budget });
    if (campaignId && state) actions.push({ type: 'update_campaign_state', campaign_id: campaignId, new_state: state });
    if (campaignId && strategy) {
      actions.push({
        type: 'update_campaign_bidding_strategy',
        campaign_id: campaignId,
        new_strategy: strategy,
      });
    }
    return { actions, warnings };
  }

  if (params.kind === 'ad_group') {
    const state = asString(params.before.state);
    const defaultBid = asFiniteNumber(params.before.default_bid);
    if (!adGroupId) warnings.push('ad_group_id missing in dedupe metadata.');
    if (adGroupId && state) actions.push({ type: 'update_ad_group_state', ad_group_id: adGroupId, new_state: state });
    if (adGroupId && defaultBid !== null) {
      actions.push({
        type: 'update_ad_group_default_bid',
        ad_group_id: adGroupId,
        new_default_bid: defaultBid,
      });
    }
    return { actions, warnings };
  }

  if (params.kind === 'target') {
    const state = asString(params.before.state);
    const bid = asFiniteNumber(params.before.bid);
    if (!targetId) warnings.push('target_id missing in dedupe metadata.');
    if (targetId && state) actions.push({ type: 'update_target_state', target_id: targetId, new_state: state });
    if (targetId && bid !== null) actions.push({ type: 'update_target_bid', target_id: targetId, new_bid: bid });
    return { actions, warnings };
  }

  if (params.kind === 'placement') {
    const percentage = asFiniteNumber(params.before.percentage);
    const placementCode =
      asString(params.before.placement_code)?.toUpperCase() ??
      asString(params.after.placement_code)?.toUpperCase() ??
      undefined;
    const placementRaw =
      asString(params.after.placement_raw) ??
      asString(params.before.placement_raw) ??
      undefined;
    if (!campaignId) warnings.push('campaign_id missing in dedupe metadata.');
    if (percentage === null) warnings.push('before_json.percentage missing for placement rollback.');
    if (campaignId && percentage !== null) {
      actions.push({
        type: 'update_placement_modifier',
        campaign_id: campaignId,
        placement_code: placementCode,
        placement_raw: placementRaw,
        new_pct: percentage,
      });
    }
    return { actions, warnings };
  }

  warnings.push('Could not classify rollback entity type for SB change.');
  return { actions, warnings };
};

const resolveRollbackActions = (change: RollbackChangeInput): ResolveRollbackResult => {
  const before = asRecord(change.before_json);
  if (!before) {
    return { ok: false, warnings: ['before_json is missing or not an object.'] };
  }

  const after = asRecord(change.after_json);
  if (!after) {
    return { ok: false, warnings: ['after_json is missing or not an object.'] };
  }

  const identity = parseDedupeIdentity(asString(after.dedupe_key));
  const generator = normalizeGenerator(asString(after.generator) ?? normalizeGenerator(identity?.generator ?? null));
  if (!generator) {
    return { ok: false, warnings: ['after_json.generator is missing or unsupported for deterministic rollback.'] };
  }

  const kind = inferEntityKind(before, identity);
  if (kind === 'unknown') {
    return { ok: false, warnings: ['Could not infer rollback entity from metadata and before_json.'] };
  }

  if (generator === 'bulkgen:sp:update') {
    const built = buildSpActions({ before, after, kind, identity });
    if (built.actions.length === 0) {
      return {
        ok: false,
        warnings: built.warnings.length > 0 ? built.warnings : ['No SP rollback actions were produced.'],
      };
    }
    return {
      ok: true,
      channel: 'SP',
      generator,
      actions: built.actions,
      sourceRunId: identity?.sourceRunId ?? null,
      warnings: built.warnings,
    };
  }

  const built = buildSbActions({ before, after, kind, identity });
  if (built.actions.length === 0) {
    return {
      ok: false,
      warnings: built.warnings.length > 0 ? built.warnings : ['No SB rollback actions were produced.'],
    };
  }
  return {
    ok: true,
    channel: 'SB',
    generator,
    actions: built.actions,
    sourceRunId: identity?.sourceRunId ?? null,
    warnings: built.warnings,
  };
};

const toRollbackTimestamp = (value: Date): string =>
  value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

const compareByChangeId = (left: RollbackChangeInput, right: RollbackChangeInput) =>
  left.change_id.localeCompare(right.change_id);

const warningForChange = (changeId: string, reason: string) => `change_id=${changeId}: ${reason}`;

export const buildRollbackOutputPack = (args: {
  experiment: { experiment_id: string; asin: string; marketplace: string };
  changes: Array<{
    change_id: string;
    run_id: string | null;
    before_json: unknown;
    after_json: unknown;
    channel: string;
    summary: string | null;
  }>;
  targetRunId?: string | null;
}): OutputPackJson => {
  const now = new Date();
  const rollbackRunId = `rollback:${toRollbackTimestamp(now)}`;
  const warnings: string[] = [];
  const warningSet = new Set<string>();
  const pushWarning = (message: string) => {
    if (warningSet.has(message)) return;
    warningSet.add(message);
    warnings.push(message);
  };

  const filteredChanges = args.changes
    .filter((change) => !args.targetRunId || (change.run_id ?? null) === args.targetRunId)
    .sort(compareByChangeId);

  if (args.targetRunId && filteredChanges.length === 0) {
    pushWarning(`No changes found for target run_id=${args.targetRunId}.`);
  }

  const spPlan: SpRollbackPlan = {
    channel: 'SP',
    generator: 'bulkgen:sp:update',
    run_id: rollbackRunId,
    actions: [],
    source_change_ids: [],
  };

  const sbPlan: SbRollbackPlan = {
    channel: 'SB',
    generator: 'bulkgen:sb:update',
    run_id: rollbackRunId,
    actions: [],
    source_change_ids: [],
  };

  const manualChanges: RollbackManualChange[] = [];

  for (const change of filteredChanges) {
    const resolved = resolveRollbackActions(change);
    if (!resolved.ok) {
      for (const warning of resolved.warnings) {
        pushWarning(warningForChange(change.change_id, warning));
      }
      continue;
    }

    for (const warning of resolved.warnings) {
      pushWarning(warningForChange(change.change_id, warning));
    }

    const sourceRunId = change.run_id ?? resolved.sourceRunId ?? null;
    if (resolved.channel === 'SP') {
      spPlan.actions.push(...resolved.actions);
      spPlan.source_change_ids.push(change.change_id);
    } else {
      sbPlan.actions.push(...resolved.actions);
      sbPlan.source_change_ids.push(change.change_id);
    }

    manualChanges.push({
      run_id: rollbackRunId,
      source_change_id: change.change_id,
      source_run_id: sourceRunId,
      channel: change.channel,
      change_type: 'rollback',
      summary: `Rollback ${change.change_id}: ${change.summary ?? 'revert to before_json'}`,
      why: `Deterministic rollback generated from before_json for change ${change.change_id}.`,
      before_json: change.after_json,
      after_json: {
        run_id: rollbackRunId,
        generator: resolved.generator,
        actions: resolved.actions,
        rollback_of_change_id: change.change_id,
        rollback_of_run_id: sourceRunId,
      },
    });
  }

  const bulkgenPlans: Array<SpRollbackPlan | SbRollbackPlan> = [];
  if (spPlan.actions.length > 0) bulkgenPlans.push(spPlan);
  if (sbPlan.actions.length > 0) bulkgenPlans.push(sbPlan);

  if (bulkgenPlans.length === 0) {
    pushWarning('No deterministic rollback actions were generated.');
  }

  return {
    kind: 'experiment_output_pack',
    generated_at: now.toISOString(),
    experiment: {
      experiment_id: args.experiment.experiment_id,
      asin: args.experiment.asin,
      marketplace: args.experiment.marketplace,
    },
    rollback: {
      rollback_run_id: rollbackRunId,
      target_run_id: args.targetRunId ?? null,
      source_change_count: filteredChanges.length,
      rollback_change_count: manualChanges.length,
      rollback_action_count: spPlan.actions.length + sbPlan.actions.length,
    },
    bulkgen_plans: bulkgenPlans,
    manual_changes: manualChanges,
    warnings,
  };
};
