import { describe, expect, it, vi } from 'vitest';

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
    from: () => {
      throw new Error('supabaseAdmin should not be called in adsOptimizerWorkspaceHandoff.test.ts');
    },
  },
}));

import {
  buildAdsOptimizerWorkspaceHandoffPlan,
  executeAdsOptimizerWorkspaceHandoff,
} from '../apps/web/src/lib/ads-optimizer/handoff';
import type { AdsOptimizerTargetReviewRow } from '../apps/web/src/lib/ads-optimizer/runtime';

const makeRow = (overrides: Partial<AdsOptimizerTargetReviewRow> = {}) =>
  ({
    targetSnapshotId: 'target-snapshot-1',
    runId: 'run-1',
    createdAt: '2026-03-11T00:00:00Z',
    asin: 'B001TEST',
    campaignId: 'campaign-1',
    campaignName: 'Campaign One',
    adGroupId: 'ad-group-1',
    adGroupName: 'Ad Group One',
    targetId: 'target-1',
    persistedTargetKey: 'target-1',
    targetText: 'blue widget',
    matchType: 'EXACT',
    typeLabel: 'Keyword',
    raw: {
      impressions: 100,
      clicks: 10,
      spend: 20,
      orders: 2,
      sales: 100,
      cpc: 2,
      ctr: 0.1,
      cvr: 0.2,
      acos: 0.2,
      roas: 5,
      tosIs: 0.3,
      stis: 0.2,
      stir: 9,
    },
    derived: {
      contributionAfterAds: 15,
      breakEvenGap: 0.12,
      maxCpcSupportGap: 0.5,
      lossDollars: null,
      profitDollars: 15,
      clickVelocity: 10,
      impressionVelocity: 100,
      organicLeverageProxy: 0.25,
      organicContextSignal: 'same_text_visibility_context',
    },
    nonAdditiveDiagnostics: {
      note: 'Non-additive diagnostics stay point-in-time only.',
      representativeSearchTerm: 'blue widget',
      tosIs: {
        latestValue: 0.3,
        previousValue: 0.27,
        delta: 0.03,
        direction: 'up',
        observedDays: 2,
        latestObservedDate: '2026-03-10',
      },
      stis: {
        latestValue: 0.2,
        previousValue: 0.18,
        delta: 0.02,
        direction: 'up',
        observedDays: 2,
        latestObservedDate: '2026-03-10',
      },
      stir: {
        latestValue: 9,
        previousValue: 11,
        delta: -2,
        direction: 'down',
        observedDays: 2,
        latestObservedDate: '2026-03-10',
      },
    },
    demandProxies: {
      searchTermCount: 2,
      sameTextSearchTermCount: 1,
      totalSearchTermImpressions: 80,
      totalSearchTermClicks: 8,
      representativeSearchTerm: 'blue widget',
      representativeClickShare: 0.75,
    },
    placementContext: {
      topOfSearchModifierPct: 25,
      impressions: 50,
      clicks: 5,
      orders: 1,
      units: 1,
      sales: 45,
      spend: 10,
      note: 'Campaign-level placement context.',
    },
    searchTermDiagnostics: {
      representativeSearchTerm: 'blue widget',
      representativeSameText: true,
      note: 'Representative query only.',
      topTerms: [],
    },
    coverage: {
      observedStart: '2026-03-01',
      observedEnd: '2026-03-10',
      daysObserved: 10,
      statuses: {
        tosIs: 'ready',
        stis: 'ready',
        stir: 'ready',
        placementContext: 'ready',
        searchTerms: 'partial',
        breakEvenInputs: 'ready',
      },
      notes: ['Coverage note.'],
      criticalWarnings: [],
    },
    state: {
      efficiency: {
        value: 'profitable',
        label: 'Profitable',
        detail: 'detail',
        coverageStatus: 'ready',
        reasonCodes: ['STATE_OK'],
      },
      confidence: {
        value: 'confirmed',
        label: 'Confirmed',
        detail: 'detail',
        coverageStatus: 'ready',
        reasonCodes: ['CONFIRMED'],
      },
      importance: {
        value: 'tier_1_dominant',
        label: 'Tier 1 dominant',
        detail: 'detail',
        coverageStatus: 'ready',
        reasonCodes: ['TIER_1'],
      },
      opportunityScore: 82,
      riskScore: 22,
      opportunityReasonCodes: ['OPPORTUNITY'],
      riskReasonCodes: ['RISK_LOW'],
      summaryReasonCodes: ['STATE_SUMMARY'],
    },
    role: {
      desiredRole: {
        value: 'Scale',
        label: 'Scale',
        detail: 'detail',
        coverageStatus: 'ready',
        reasonCodes: ['ROLE_DESIRED_SCALE'],
      },
      currentRole: {
        value: 'Scale',
        label: 'Scale',
        detail: 'detail',
        coverageStatus: 'ready',
        reasonCodes: ['ROLE_CURRENT_SCALE'],
      },
      previousRole: 'Harvest',
      transitionRule: 'scale_up',
      transitionReasonCodes: ['ROLE_TRANSITION'],
      summaryReasonCodes: ['ROLE_SUMMARY'],
      guardrails: {
        coverageStatus: 'ready',
        categories: {
          noSaleSpendCap: 20,
          noSaleClickCap: 12,
          maxLossPerCycle: 25,
          maxBidIncreasePerCyclePct: 10,
          maxBidDecreasePerCyclePct: 15,
          maxPlacementBiasIncreasePerCyclePct: 8,
          rankPushTimeLimitDays: 14,
          manualApprovalThreshold: 'medium',
          autoPauseThreshold: 40,
          minBidFloor: 0.2,
          maxBidCeiling: 3,
        },
        flags: {
          requiresManualApproval: false,
          autoPauseEligible: false,
          bidChangesAllowed: true,
          placementChangesAllowed: true,
          transitionLocked: false,
        },
        reasonCodes: ['GUARDRAIL_OK'],
        notes: [],
      },
    },
    recommendation: {
      recommendationSnapshotId: 'recommendation-1',
      targetSnapshotId: 'target-snapshot-1',
      createdAt: '2026-03-11T00:00:00Z',
      status: 'generated',
      actionType: 'update_target_bid',
      spendDirection: 'increase',
      primaryActionType: 'update_target_bid',
      actionCount: 3,
      reasonCodes: ['REC_SCALE'],
      coverageFlags: [],
      confidenceNotes: ['Confirmed signal.'],
      unsupportedActionBlocks: [],
      executionBoundary: 'read_only_recommendation_only',
      workspaceHandoff: 'not_started',
      writesExecutionTables: false,
      manualReviewRequired: true,
      outputState: 'generated',
      supportingMetrics: null,
      actions: [
        {
          actionType: 'update_target_bid',
          priority: 20,
          entityContext: {
            target_id: 'target-1',
            campaign_id: 'campaign-1',
            current_bid: 1.2,
          },
          proposedChange: {
            next_bid: 1.34,
          },
          reasonCodes: ['ACTION_UPDATE_TARGET_BID_INCREASE'],
          supportingMetrics: null,
        },
        {
          actionType: 'negative_candidate',
          priority: 50,
          entityContext: null,
          proposedChange: null,
          reasonCodes: ['ACTION_NEGATIVE_CANDIDATE'],
          supportingMetrics: null,
        },
        {
          actionType: 'change_review_cadence',
          priority: 60,
          entityContext: null,
          proposedChange: {
            recommended_cadence: 'every_14_days',
          },
          reasonCodes: ['ACTION_CHANGE_REVIEW_CADENCE'],
          supportingMetrics: null,
        },
      ],
    },
    queue: {
      priority: 20,
      recommendationCount: 3,
      primaryActionType: 'update_target_bid',
      spendDirection: 'increase',
      reasonCodeBadges: ['REC_SCALE'],
      readOnlyBoundary: 'read_only_recommendation_only',
      hasCoverageGaps: false,
    },
    roleHistory: [],
    ...overrides,
  }) as AdsOptimizerTargetReviewRow;

describe('ads optimizer workspace handoff', () => {
  it('maps exact-run persisted recommendations into Ads Workspace draft payloads', () => {
    const row = makeRow();

    const plan = buildAdsOptimizerWorkspaceHandoffPlan({
      asin: 'B001TEST',
      start: '2026-03-01',
      end: '2026-03-10',
      runId: 'run-1',
      objective: 'Scale Profit',
      rows: [row],
      createdAt: '2026-03-11T10:00:00Z',
    });

    expect(plan.itemPayloads).toHaveLength(1);
    expect(plan.itemPayloads[0]).toMatchObject({
      channel: 'sp',
      entity_level: 'target',
      entity_key: 'target-1',
      campaign_id: 'campaign-1',
      ad_group_id: 'ad-group-1',
      target_id: 'target-1',
      action_type: 'update_target_bid',
      before_json: { bid: 1.2 },
      after_json: { bid: 1.34 },
      objective: 'Scale Profit',
      review_after_days: 14,
    });
    expect(plan.itemPayloads[0]?.ui_context_json).toMatchObject({
      surface: 'ads_optimizer_handoff',
      campaign_name: 'Campaign One',
      ad_group_name: 'Ad Group One',
      target_text: 'blue widget',
      optimizer_handoff: {
        run_id: 'run-1',
        target_snapshot_id: 'target-snapshot-1',
        recommendation_snapshot_id: 'recommendation-1',
        source_execution_boundary: 'read_only_recommendation_only',
      },
    });
    expect(plan.changeSetPayload.filters_json).toMatchObject({
      source: 'ads_optimizer_phase10_handoff',
      optimizer_run_id: 'run-1',
      asin: 'B001TEST',
      start: '2026-03-01',
      end: '2026-03-10',
    });
    expect(plan.skippedUnsupportedActionTypes).toEqual([
      'negative_candidate',
      'change_review_cadence',
    ]);
    expect(plan.skippedUnsupportedActionCount).toBe(2);
  });

  it('dedupes identical placement handoffs across selected rows but blocks conflicting ones', () => {
    const rowA = makeRow({
      targetSnapshotId: 'target-snapshot-a',
      recommendation: {
        ...makeRow().recommendation!,
        recommendationSnapshotId: 'recommendation-a',
        primaryActionType: 'update_placement_modifier',
        actionType: 'update_placement_modifier',
        actions: [
          {
            actionType: 'update_placement_modifier',
            priority: 30,
            entityContext: {
              campaign_id: 'campaign-1',
              placement_code: 'PLACEMENT_TOP',
              current_percentage: 25,
            },
            proposedChange: {
              next_percentage: 35,
            },
            reasonCodes: ['ACTION_UPDATE_PLACEMENT_MODIFIER_INCREASE'],
            supportingMetrics: null,
          },
        ],
      },
    });
    const rowB = makeRow({
      targetSnapshotId: 'target-snapshot-b',
      targetId: 'target-2',
      persistedTargetKey: 'target-2',
      recommendation: {
        ...makeRow().recommendation!,
        recommendationSnapshotId: 'recommendation-b',
        primaryActionType: 'update_placement_modifier',
        actionType: 'update_placement_modifier',
        actions: [
          {
            actionType: 'update_placement_modifier',
            priority: 30,
            entityContext: {
              campaign_id: 'campaign-1',
              placement_code: 'PLACEMENT_TOP',
              current_percentage: 25,
            },
            proposedChange: {
              next_percentage: 35,
            },
            reasonCodes: ['ACTION_UPDATE_PLACEMENT_MODIFIER_INCREASE'],
            supportingMetrics: null,
          },
        ],
      },
    });

    const dedupedPlan = buildAdsOptimizerWorkspaceHandoffPlan({
      asin: 'B001TEST',
      start: '2026-03-01',
      end: '2026-03-10',
      runId: 'run-1',
      objective: 'Scale Profit',
      rows: [rowA, rowB],
      createdAt: '2026-03-11T10:00:00Z',
    });

    expect(dedupedPlan.itemPayloads).toHaveLength(1);
    expect(dedupedPlan.dedupedActionCount).toBe(1);

    expect(() =>
      buildAdsOptimizerWorkspaceHandoffPlan({
        asin: 'B001TEST',
        start: '2026-03-01',
        end: '2026-03-10',
        runId: 'run-1',
        objective: 'Scale Profit',
        rows: [
          rowA,
          makeRow({
            targetSnapshotId: 'target-snapshot-c',
            targetId: 'target-3',
            persistedTargetKey: 'target-3',
            recommendation: {
              ...rowB.recommendation!,
              recommendationSnapshotId: 'recommendation-c',
              actions: [
                {
                  actionType: 'update_placement_modifier',
                  priority: 30,
                  entityContext: {
                    campaign_id: 'campaign-1',
                    placement_code: 'PLACEMENT_TOP',
                    current_percentage: 25,
                  },
                  proposedChange: {
                    next_percentage: 40,
                  },
                  reasonCodes: ['ACTION_UPDATE_PLACEMENT_MODIFIER_INCREASE'],
                  supportingMetrics: null,
                },
              ],
            },
          }),
        ],
        createdAt: '2026-03-11T10:00:00Z',
      })
    ).toThrow('Selected optimizer recommendations conflict');
  });

  it('creates a normal Ads Workspace change set and items during handoff', async () => {
    const createChangeSet = vi.fn(async (payload) => ({
      id: 'change-set-1',
      account_id: 'acct',
      marketplace: 'US',
      experiment_id: null,
      name: String(payload.name),
      status: 'draft' as const,
      objective: payload.objective ?? null,
      hypothesis: payload.hypothesis ?? null,
      forecast_window_days: payload.forecast_window_days ?? null,
      review_after_days: payload.review_after_days ?? null,
      notes: payload.notes ?? null,
      filters_json: (payload.filters_json ?? {}) as Record<string, unknown>,
      generated_run_id: null,
      generated_artifact_json: (payload.generated_artifact_json ?? null) as Record<string, unknown> | null,
      created_at: '2026-03-11T10:00:00Z',
      updated_at: '2026-03-11T10:00:00Z',
    }));
    const createChangeSetItems = vi.fn(async () => []);
    const listChangeSetItems = vi.fn(async () => [{ id: 'item-1' }]);

    const result = await executeAdsOptimizerWorkspaceHandoff(
      {
        asin: 'B001TEST',
        start: '2026-03-01',
        end: '2026-03-10',
        targetSnapshotIds: ['target-snapshot-1'],
      },
      {
        now: () => '2026-03-11T10:00:00Z',
        loadTargetsViewData: async () => ({
          run: {
            run_id: 'run-1',
            account_id: 'acct',
            marketplace: 'US',
            channel: 'sp',
            scope_type: 'product',
            selected_asin: 'B001TEST',
            run_kind: 'manual',
            date_start: '2026-03-01',
            date_end: '2026-03-10',
            rule_pack_version_id: 'version-1',
            rule_pack_version_label: 'sp_v1_seed',
            status: 'completed',
            input_summary_json: {},
            diagnostics_json: null,
            product_snapshot_count: 1,
            target_snapshot_count: 1,
            recommendation_snapshot_count: 1,
            role_transition_count: 0,
            created_at: '2026-03-11T00:00:00Z',
            started_at: '2026-03-11T00:00:00Z',
            completed_at: '2026-03-11T00:10:00Z',
          },
          latestCompletedRun: null,
          productState: {
            value: 'profitable',
            label: 'Profitable',
            reason: 'Ready',
            objective: 'Scale Profit',
            objectiveReason: 'Objective ready',
          },
          rows: [makeRow()],
        }),
        createChangeSet,
        createChangeSetItems,
        listChangeSetItems,
      }
    );

    expect(createChangeSet).toHaveBeenCalledTimes(1);
    expect(createChangeSetItems).toHaveBeenCalledTimes(1);
    expect(createChangeSetItems.mock.calls[0]?.[0]).toBe('change-set-1');
    expect(createChangeSetItems.mock.calls[0]?.[1]?.[0]).toMatchObject({
      action_type: 'update_target_bid',
      campaign_id: 'campaign-1',
      target_id: 'target-1',
    });
    expect(result).toMatchObject({
      changeSetId: 'change-set-1',
      stagedActionCount: 1,
      selectedRowCount: 1,
      queueCount: 1,
    });
  });
});
