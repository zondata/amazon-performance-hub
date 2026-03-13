import { beforeEach, describe, expect, it, vi } from 'vitest';

type RulePackRow = {
  rule_pack_id: string;
  account_id: string;
  marketplace: string;
  channel: 'sp';
  scope_type: 'account' | 'product';
  scope_value: string | null;
  name: string;
  description: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

type RulePackVersionRow = {
  rule_pack_version_id: string;
  rule_pack_id: string;
  version_label: string;
  status: 'draft' | 'active' | 'archived';
  change_summary: string;
  change_payload_json: Record<string, unknown>;
  created_from_version_id: string | null;
  created_at: string;
  activated_at: string | null;
  archived_at: string | null;
};

const state = {
  rulePacks: [] as RulePackRow[],
  insertedVersions: [] as RulePackVersionRow[],
  versionListResponses: [] as RulePackVersionRow[][],
  versionListCallCount: 0,
  idCounter: 1,
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const resetState = () => {
  state.rulePacks = [];
  state.insertedVersions = [];
  state.versionListResponses = [];
  state.versionListCallCount = 0;
  state.idCounter = 1;
};

const nextId = () => `version-${state.idCounter++}`;

const resolveVersionList = () => {
  const response = state.versionListResponses[state.versionListCallCount];
  state.versionListCallCount += 1;
  if (response) {
    return clone(response);
  }
  return clone(state.insertedVersions);
};

const createQuery = (table: string) => {
  const filters: Array<{ type: 'eq' | 'is' | 'neq'; column: string; value: unknown }> = [];
  let pendingInsert: Record<string, unknown> | null = null;
  let pendingUpdate: Record<string, unknown> | null = null;
  let shouldSelectAfterMutate = false;

  const matchesFilters = (row: Record<string, unknown>) =>
    filters.every((filter) => {
      if (filter.type === 'eq') {
        return row[filter.column] === filter.value;
      }
      if (filter.type === 'is') {
        return row[filter.column] === filter.value;
      }
      return row[filter.column] !== filter.value;
    });

  const readRulePack = () => clone(state.rulePacks.find((row) => matchesFilters(row)) ?? null);

  const readRulePackVersion = () => {
    if (filters.some((filter) => filter.column === 'rule_pack_version_id')) {
      return clone(state.insertedVersions.find((row) => matchesFilters(row)) ?? null);
    }
    return resolveVersionList().filter((row) => matchesFilters(row));
  };

  const applyVersionUpdate = () => {
    const index = state.insertedVersions.findIndex((row) => matchesFilters(row));
    if (index < 0 || !pendingUpdate) {
      return null;
    }

    const updated: RulePackVersionRow = {
      ...state.insertedVersions[index]!,
      ...clone(pendingUpdate) as Partial<RulePackVersionRow>,
    };
    state.insertedVersions[index] = updated;
    return clone(updated);
  };

  const query: any = {
    select: () => {
      shouldSelectAfterMutate = true;
      return query;
    },
    eq: (column: string, value: unknown) => {
      filters.push({ type: 'eq', column, value });
      return query;
    },
    is: (column: string, value: unknown) => {
      filters.push({ type: 'is', column, value });
      return query;
    },
    neq: (column: string, value: unknown) => {
      filters.push({ type: 'neq', column, value });
      return query;
    },
    order: () => query,
    insert: (value: Record<string, unknown>) => {
      pendingInsert = value;
      return query;
    },
    update: (value: Record<string, unknown>) => {
      pendingUpdate = value;
      return query;
    },
    maybeSingle: async () => {
      if (table === 'ads_optimizer_rule_packs') {
        return { data: readRulePack(), error: null };
      }
      if (table === 'ads_optimizer_rule_pack_versions') {
        const result = readRulePackVersion();
        return {
          data: Array.isArray(result) ? result[0] ?? null : result,
          error: null,
        };
      }
      throw new Error(`Unsupported maybeSingle table in test: ${table}`);
    },
    single: async () => {
      if (pendingUpdate && shouldSelectAfterMutate && table === 'ads_optimizer_rule_pack_versions') {
        const updated = applyVersionUpdate();
        return {
          data: updated,
          error: updated ? null : { message: 'not found' },
        };
      }

      if (!pendingInsert || !shouldSelectAfterMutate) {
        throw new Error(`Unsupported single() usage in test for table: ${table}`);
      }

      if (table === 'ads_optimizer_rule_pack_versions') {
        const inserted: RulePackVersionRow = {
          rule_pack_version_id: nextId(),
          rule_pack_id: String(pendingInsert.rule_pack_id),
          version_label: String(pendingInsert.version_label),
          status: pendingInsert.status as RulePackVersionRow['status'],
          change_summary: String(pendingInsert.change_summary),
          change_payload_json: clone(
            (pendingInsert.change_payload_json ?? {}) as Record<string, unknown>
          ),
          created_from_version_id:
            (pendingInsert.created_from_version_id as string | null | undefined) ?? null,
          created_at: `2026-03-10T00:00:0${state.idCounter}Z`,
          activated_at: (pendingInsert.activated_at as string | null | undefined) ?? null,
          archived_at: (pendingInsert.archived_at as string | null | undefined) ?? null,
        };
        state.insertedVersions = [inserted, ...state.insertedVersions];
        return { data: clone(inserted), error: null };
      }

      throw new Error(`Unsupported insert table in test: ${table}`);
    },
  };

  query.then = (resolve: (value: { data: RulePackVersionRow[]; error: null }) => unknown) => {
    if (pendingUpdate && table === 'ads_optimizer_rule_pack_versions') {
      const updated = applyVersionUpdate();
      return Promise.resolve({
        data: updated ? [updated] : [],
        error: null,
      }).then(resolve);
    }

    if (table !== 'ads_optimizer_rule_pack_versions') {
      throw new Error(`Unsupported list query table in test: ${table}`);
    }
    return Promise.resolve({
      data: readRulePackVersion() as RulePackVersionRow[],
      error: null,
    }).then(resolve);
  };

  return query;
};

vi.mock('../apps/web/src/lib/env', () => ({
  env: {
    supabaseUrl: 'https://example.supabase.co',
    supabaseServiceRoleKey: 'service-role-key',
    accountId: 'acct',
    marketplace: 'US',
  },
}));

vi.mock('../apps/web/src/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: (table: string) => createQuery(table),
  },
}));

import {
  activateRulePackVersion,
  createRulePackVersionDraft,
  getAdsOptimizerConfigViewData,
  seedStarterRulePackVersionDrafts,
  updateRulePackVersionDraft,
} from '../apps/web/src/lib/ads-optimizer/repoConfig';

describe('ads optimizer config repo initialization', () => {
  beforeEach(() => {
    resetState();
    state.rulePacks = [
      {
        rule_pack_id: 'pack-1',
        account_id: 'acct',
        marketplace: 'US',
        channel: 'sp',
        scope_type: 'account',
        scope_value: null,
        name: 'SP V1 Default Rule Pack',
        description: 'Default config foundation.',
        is_archived: false,
        created_at: '2026-03-10T00:00:00Z',
        updated_at: '2026-03-10T00:00:00Z',
      },
    ];
    state.insertedVersions = [
      {
        rule_pack_version_id: 'version-active',
        rule_pack_id: 'pack-1',
        version_label: 'sp_v1_seed',
        status: 'active',
        change_summary: 'Seed version.',
        change_payload_json: {
          schema_version: 2,
          channel: 'sp',
          strategy_profile: 'hybrid',
          role_templates: {},
          guardrail_templates: {},
          scoring_weights: {},
          state_engine: {},
          action_policy: {},
        },
        created_from_version_id: null,
        created_at: '2026-03-10T00:00:00Z',
        activated_at: '2026-03-10T00:00:00Z',
        archived_at: null,
      },
    ];
  });

  it('returns the created seed version immediately when repairing a pack-only foundation', async () => {
    state.insertedVersions = [];
    state.versionListResponses = [[], []];

    const result = await getAdsOptimizerConfigViewData();

    expect(result.seeded).toBe(true);
    expect(result.seedMessage).toContain('Repaired the optimizer config foundation');
    expect(result.rulePack.rule_pack_id).toBe('pack-1');
    expect(result.versions).toHaveLength(1);
    expect(result.versions[0]?.version_label).toBe('sp_v1_seed');
    expect(result.versions[0]?.status).toBe('active');
    expect(result.activeVersion?.rule_pack_version_id).toBe(result.versions[0]?.rule_pack_version_id);
  });

  it('creates a draft from a prior version, edits the draft payload, and activates it later', async () => {
    const draft = await createRulePackVersionDraft({
      rulePackId: 'pack-1',
      sourceVersionId: 'version-active',
      versionLabel: 'sp_v1_visibility_draft',
      changeSummary: 'Clone active to visibility-led draft.',
    });

    expect(draft.status).toBe('draft');
    expect(draft.created_from_version_id).toBe('version-active');
    expect(draft.change_payload_json.strategy_profile).toBe('hybrid');

    const savedDraft = await updateRulePackVersionDraft({
      rulePackVersionId: draft.rule_pack_version_id,
      versionLabel: 'sp_v1_visibility_draft',
      changeSummary: 'Tune visibility-led protection and phased recovery.',
      changePayloadPatch: {
        strategy_profile: 'visibility_led',
        loss_maker_policy: {
          protected_ad_sales_share_min: 0.15,
        },
        phased_recovery_policy: {
          visibility_led_steps: 6,
        },
      },
    });

    expect(savedDraft.status).toBe('draft');
    expect(savedDraft.change_summary).toContain('visibility-led');
    expect(savedDraft.change_payload_json.strategy_profile).toBe('visibility_led');
    expect(savedDraft.change_payload_json.loss_maker_policy).toMatchObject({
      protected_ad_sales_share_min: 0.15,
    });
    expect(savedDraft.change_payload_json.phased_recovery_policy).toMatchObject({
      visibility_led_steps: 6,
    });

    const activated = await activateRulePackVersion(savedDraft.rule_pack_version_id);
    const archivedActive = state.insertedVersions.find(
      (row) => row.rule_pack_version_id === 'version-active'
    );

    expect(activated.status).toBe('active');
    expect(activated.rule_pack_version_id).toBe(savedDraft.rule_pack_version_id);
    expect(archivedActive?.status).toBe('archived');
  });

  it('prevents editing active versions in place', async () => {
    await expect(
      updateRulePackVersionDraft({
        rulePackVersionId: 'version-active',
        versionLabel: 'sp_v1_seed',
        changeSummary: 'Try to overwrite active version.',
        changePayloadPatch: {
          strategy_profile: 'design_led',
        },
      })
    ).rejects.toThrow(
      'Only draft optimizer rule pack versions can be edited in place. Clone a new draft to make changes.'
    );
  });

  it('seeds starter drafts for hybrid, visibility_led, and design_led when missing', async () => {
    const created = await seedStarterRulePackVersionDrafts('pack-1');
    const result = await getAdsOptimizerConfigViewData();

    expect(created).toHaveLength(3);
    expect([...created.map((version) => version.version_label)].sort()).toEqual([
      'sp_v1_design_led_starter',
      'sp_v1_hybrid_starter',
      'sp_v1_visibility_led_starter',
    ]);
    expect([...created.map((version) => version.change_payload_json.strategy_profile)].sort()).toEqual([
      'design_led',
      'hybrid',
      'visibility_led',
    ]);
    expect(created.every((version) => version.status === 'draft')).toBe(true);
    expect(created.every((version) => version.created_from_version_id === 'version-active')).toBe(
      true
    );
    expect(result.missingStarterProfiles).toEqual([]);
    const hybridStarter = created.find((version) => version.version_label === 'sp_v1_hybrid_starter');
    const visibilityStarter = created.find(
      (version) => version.version_label === 'sp_v1_visibility_led_starter'
    );
    const designStarter = created.find(
      (version) => version.version_label === 'sp_v1_design_led_starter'
    );

    expect(result.versionStrategyProfiles[hybridStarter!.rule_pack_version_id]).toBe('hybrid');
    expect(result.versionStrategyProfiles[visibilityStarter!.rule_pack_version_id]).toBe(
      'visibility_led'
    );
    expect(result.versionStrategyProfiles[designStarter!.rule_pack_version_id]).toBe('design_led');
  });
});
