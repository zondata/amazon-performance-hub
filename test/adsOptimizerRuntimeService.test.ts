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
      throw new Error('supabaseAdmin should not be called in adsOptimizerRuntimeService.test.ts');
    },
  },
}));

import { executeAdsOptimizerManualRun } from '../apps/web/src/lib/ads-optimizer/runtime';

const makeActiveVersion = () => ({
  rule_pack_version_id: 'version-1',
  rule_pack_id: 'pack-1',
  version_label: 'sp_v1_seed',
  status: 'active' as const,
  change_summary: 'Seed version.',
  change_payload_json: {
    schema_version: 1,
    channel: 'sp' as const,
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
});

const makeRun = () => ({
  run_id: 'run-1',
  account_id: 'acct',
  marketplace: 'US',
  channel: 'sp' as const,
  scope_type: 'product' as const,
  selected_asin: 'B001TEST',
  run_kind: 'manual' as const,
  date_start: '2026-03-01',
  date_end: '2026-03-10',
  rule_pack_version_id: 'version-1',
  rule_pack_version_label: 'sp_v1_seed',
  status: 'pending' as const,
  input_summary_json: {},
  diagnostics_json: null,
  product_snapshot_count: 0,
  target_snapshot_count: 0,
  recommendation_snapshot_count: 0,
  role_transition_count: 0,
  created_at: '2026-03-10T00:00:00Z',
  started_at: null,
  completed_at: null,
});

describe('ads optimizer phase 4 manual run service', () => {
  it('creates a completed run with product, target, and recommendation snapshots', async () => {
    const updateCalls: Array<Record<string, unknown>> = [];
    let insertedRecommendationRows: Array<Record<string, unknown>> = [];
    let insertedProductRows: Array<Record<string, unknown>> = [];
    let insertedTargetRows: Array<Record<string, unknown>> = [];
    let insertedRoleTransitionRows: Array<Record<string, unknown>> = [];

    const result = await executeAdsOptimizerManualRun(
      {
        asin: 'B001TEST',
        start: '2026-03-01',
        end: '2026-03-10',
      },
      {
        now: vi
          .fn()
          .mockReturnValueOnce('2026-03-10T01:00:00Z')
          .mockReturnValueOnce('2026-03-10T01:05:00Z'),
        getRuntimeContext: async () => ({
          activeVersion: makeActiveVersion(),
        }),
        createRun: async (payload) => {
          expect(payload.selectedAsin).toBe('B001TEST');
          expect(payload.rulePackVersionLabel).toBe('sp_v1_seed');
          expect(payload.inputSummary.phase).toBe(11);
          expect(payload.inputSummary.snapshot_boundaries).toBeTruthy();
          expect(payload.inputSummary.snapshot_boundaries.target_profile_engine).toBe(
            'phase5_target_profile_engine'
          );
          expect(payload.inputSummary.snapshot_boundaries.state_engine).toBe('phase6_state_engine');
          expect(payload.inputSummary.snapshot_boundaries.role_engine).toBe(
            'phase7_role_guardrail_engine'
          );
          expect(payload.inputSummary.snapshot_boundaries.recommendation_snapshot_behavior).toContain(
            'Phase 11 persists deterministic recommendation sets with portfolio caps'
          );
          return makeRun();
        },
        updateRun: async (_runId, payload) => {
          updateCalls.push(payload as unknown as Record<string, unknown>);
          return {
            ...makeRun(),
            status: payload.status,
            diagnostics_json: payload.diagnostics ?? null,
            started_at: payload.startedAt ?? null,
            completed_at: payload.completedAt ?? null,
            product_snapshot_count: payload.productSnapshotCount ?? 0,
            target_snapshot_count: payload.targetSnapshotCount ?? 0,
            recommendation_snapshot_count: payload.recommendationSnapshotCount ?? 0,
            role_transition_count: payload.roleTransitionCount ?? 0,
          };
        },
        getProductSettings: async () => ({
          product_id: 'product-1',
          account_id: 'acct',
          marketplace: 'US',
          archetype: 'hybrid',
          optimizer_enabled: true,
          default_objective_mode: null,
          rule_pack_version_id: 'version-1',
          strategic_notes: null,
          guardrail_overrides_json: {
            max_bid_increase_per_cycle_pct: 9,
          },
          created_at: '2026-03-10T00:00:00Z',
          updated_at: '2026-03-10T00:00:00Z',
        }),
        loadPreviousRoleMap: async () => new Map([['target-1', 'Harvest']]),
        loadProductSnapshotInput: async () => ({
          productId: 'product-1',
          asin: 'B001TEST',
          overview: {
            product: {
              asin: 'B001TEST',
              title: 'Test product',
              shortName: 'Test',
              displayName: 'Test',
            },
            economics: {
              sales: 1800,
              orders: 30,
              units: 32,
              adSpend: 420,
              adSales: 950,
              tacos: 0.23,
              averagePrice: 56.25,
              costCoverage: 0.62,
              breakEvenAcos: 0.34,
              contributionBeforeAdsPerUnit: 18,
              contributionAfterAds: 226,
            },
            visibility: {
              rankingCoverage: {
                status: 'ready' as const,
                trackedKeywords: 5,
                detail: 'ready',
              },
              heroQueryTrend: {
                status: 'ready' as const,
                keyword: 'blue widget',
                searchVolume: 2200,
                latestOrganicRank: 9,
                baselineOrganicRank: 13,
                rankDelta: 4,
                detail: 'ready',
              },
              sqpCoverage: {
                status: 'ready' as const,
                selectedWeekEnd: '2026-03-08',
                trackedQueries: 4,
                totalSearchVolume: 4200,
                topQuery: 'blue widget',
                detail: 'ready',
              },
            },
            state: {
              value: 'profitable' as const,
              label: 'Profitable',
              reason: 'ready',
            },
            objective: {
              value: 'Scale Profit' as const,
              reason: 'ready',
            },
            warnings: [],
          },
          snapshotPayload: {
            phase: 4,
            capture_type: 'product_snapshot',
            overview: {
              state: {
                value: 'profitable',
                label: 'Profitable',
                reason: 'ready',
              },
              objective: {
                value: 'Scale Profit',
                reason: 'ready',
              },
            },
          },
        }),
        loadTargetSnapshotInputs: async () => ({
          rows: [
            {
              asin: 'B001TEST',
              campaignId: 'campaign-1',
              adGroupId: 'ad-group-1',
              targetId: 'target-1',
              sourceScope: 'asin_via_sp_advertised_product_membership',
              coverageNote: 'Coverage note.',
              snapshotPayload: {
                phase: 5,
                capture_type: 'target_snapshot',
                totals: {
                  impressions: 80,
                  clicks: 8,
                  spend: 20,
                  orders: 2,
                  sales: 90,
                  cpc: 2.5,
                  ctr: 0.1,
                  cvr: 0.25,
                  acos: 0.22,
                  roas: 4.5,
                },
                non_additive_diagnostics: {
                  top_of_search_impression_share_latest: 0.34,
                  representative_stis_latest: 0.22,
                  representative_stir_latest: 7,
                },
                derived_metrics: {
                  contribution_after_ads: 10.6,
                  break_even_gap: 0.12,
                  max_cpc_support_gap: 1.82,
                  loss_dollars: null,
                  profit_dollars: 10.6,
                  click_velocity: 8,
                  impression_velocity: 80,
                  organic_leverage_proxy: 0.031,
                },
                demand_proxies: {
                  search_term_count: 1,
                  same_text_search_term_count: 1,
                  total_search_term_impressions: 50,
                  total_search_term_clicks: 6,
                  representative_click_share: 0.75,
                },
                asin_scope_membership: {
                  product_ad_spend: 120,
                  product_ad_sales: 360,
                  product_orders: 10,
                  product_units: 10,
                },
                product_context: {
                  break_even_acos: 0.34,
                  average_price: 56.25,
                  product_state: 'profitable',
                  product_objective: 'Scale Profit',
                },
                execution_context: {
                  snapshot_date: '2026-03-10',
                  target: {
                    id: 'target-1',
                    text: 'blue widget',
                    match_type: 'exact',
                    is_negative: false,
                    current_state: 'enabled',
                    current_bid: 1.4,
                  },
                  ad_group: {
                    id: 'ad-group-1',
                    name: 'Ad Group 1',
                    current_state: 'enabled',
                    current_default_bid: 1.6,
                  },
                  campaign: {
                    id: 'campaign-1',
                    name: 'Campaign 1',
                    current_state: 'enabled',
                    current_budget: 50,
                    current_bidding_strategy: 'dynamic down only',
                  },
                  placement: {
                    placement_code: 'PLACEMENT_TOP',
                    label: 'Top of search',
                    current_percentage: 20,
                  },
                },
                coverage: {
                  days_observed: 5,
                  statuses: {
                    tos_is: 'ready',
                    stis: 'ready',
                    stir: 'ready',
                    placement_context: 'ready',
                    search_terms: 'ready',
                    break_even_inputs: 'ready',
                  },
                  notes: ['Coverage note.'],
                },
              },
            },
          ],
          zeroTargetDiagnostics: null,
        }),
        insertProductSnapshots: async (rows) => {
          insertedProductRows = rows as unknown as Array<Record<string, unknown>>;
          return rows.map((row, index) => ({
            product_snapshot_id: `product-snapshot-${index + 1}`,
            run_id: row.runId,
            account_id: 'acct',
            marketplace: 'US',
            product_id: row.productId,
            asin: row.asin,
            snapshot_payload_json: row.snapshotPayload,
            created_at: '2026-03-10T01:01:00Z',
          }));
        },
        insertTargetSnapshots: async (rows) => {
          insertedTargetRows = rows as unknown as Array<Record<string, unknown>>;
          return rows.map((row, index) => ({
            target_snapshot_id: `target-snapshot-${index + 1}`,
            run_id: row.runId,
            account_id: 'acct',
            marketplace: 'US',
            asin: row.asin,
            campaign_id: row.campaignId,
            ad_group_id: row.adGroupId,
            target_id: row.targetId,
            source_scope: row.sourceScope,
            coverage_note: row.coverageNote,
            snapshot_payload_json: row.snapshotPayload,
            created_at: '2026-03-10T01:02:00Z',
          }));
        },
        insertRecommendationSnapshots: async (rows) => {
          insertedRecommendationRows = rows as unknown as Array<Record<string, unknown>>;
          return rows.map((row, index) => ({
            recommendation_snapshot_id: `recommendation-snapshot-${index + 1}`,
            run_id: row.runId,
            target_snapshot_id: row.targetSnapshotId,
            account_id: 'acct',
            marketplace: 'US',
            asin: row.asin,
            status: row.status,
            action_type: row.actionType,
            reason_codes_json: row.reasonCodes,
            snapshot_payload_json: row.snapshotPayload,
            created_at: '2026-03-10T01:03:00Z',
          }));
        },
        insertRoleTransitionLogs: async (rows) => {
          insertedRoleTransitionRows = rows as unknown as Array<Record<string, unknown>>;
          return rows.map((row, index) => ({
            role_transition_log_id: `transition-${index + 1}`,
            run_id: row.runId,
            target_snapshot_id: row.targetSnapshotId,
            account_id: 'acct',
            marketplace: 'US',
            asin: row.asin,
            target_id: row.targetId,
            from_role: row.fromRole,
            to_role: row.toRole,
            transition_reason_json: row.transitionReason,
            created_at: '2026-03-10T01:03:30Z',
          }));
        },
      }
    );

    expect(result).toMatchObject({
      runId: 'run-1',
      status: 'completed',
      productSnapshotCount: 1,
      targetSnapshotCount: 1,
      recommendationSnapshotCount: 1,
      diagnostics: null,
    });
    expect(updateCalls[0]).toMatchObject({
      status: 'running',
      startedAt: '2026-03-10T01:00:00Z',
    });
    expect(updateCalls[1]).toMatchObject({
      status: 'completed',
      productSnapshotCount: 1,
      targetSnapshotCount: 1,
      recommendationSnapshotCount: 1,
      roleTransitionCount: 1,
      completedAt: '2026-03-10T01:05:00Z',
    });
    expect(insertedRecommendationRows[0]?.status).toBe('generated');
    expect(insertedRecommendationRows[0]?.actionType).toBe('update_target_bid');
    expect(insertedRecommendationRows[0]?.reasonCodes).toContain(
      'SPEND_DIRECTION_INCREASE_SCALE_HEADROOM'
    );
    expect(insertedRecommendationRows[0]?.reasonCodes).toContain('ACTION_UPDATE_TARGET_BID_INCREASE');
    expect(insertedRecommendationRows[0]?.snapshotPayload.execution_boundary).toBe(
      'read_only_recommendation_only'
    );
    expect(insertedRecommendationRows[0]?.snapshotPayload.writes_execution_tables).toBe(false);
    expect(insertedRecommendationRows[0]?.snapshotPayload.phase).toBe(11);
    expect(insertedRecommendationRows[0]?.snapshotPayload.portfolio_controls).toBeTruthy();
    expect(insertedRecommendationRows[0]?.snapshotPayload.query_diagnostics).toBeTruthy();
    expect(insertedRecommendationRows[0]?.snapshotPayload.placement_diagnostics).toBeTruthy();
    expect(insertedRecommendationRows[0]?.snapshotPayload.exception_signals).toBeTruthy();
    expect(insertedRecommendationRows[0]?.snapshotPayload.actions).toHaveLength(2);
    expect(insertedRecommendationRows[0]?.snapshotPayload.actions[0]?.action_type).toBe(
      'update_target_bid'
    );
    expect(updateCalls[1]?.targetSnapshotCount).toBe(1);
    expect(insertedProductRows[0]?.snapshotPayload.state_engine.product_state.value).toBe(
      'profitable'
    );
    expect(insertedTargetRows[0]?.snapshotPayload.phase).toBe(7);
    expect(insertedTargetRows[0]?.snapshotPayload.state_engine.efficiency.value).toBe(
      'profitable'
    );
    expect(insertedTargetRows[0]?.snapshotPayload.state_engine.confidence.value).toBe(
      'confirmed'
    );
    expect(insertedTargetRows[0]?.snapshotPayload.role_engine.desired_role.value).toBe('Scale');
    expect(insertedTargetRows[0]?.snapshotPayload.role_engine.current_role.value).toBe('Scale');
    expect(insertedTargetRows[0]?.snapshotPayload.role_engine.guardrails.categories.max_bid_increase_per_cycle_pct).toBe(9);
    expect(insertedRoleTransitionRows[0]?.fromRole).toBe('Harvest');
    expect(insertedRoleTransitionRows[0]?.toRole).toBe('Scale');
  });

  it('marks the run as failed and stores diagnostics when snapshot loading fails', async () => {
    const updateCalls: Array<Record<string, unknown>> = [];

    const result = await executeAdsOptimizerManualRun(
      {
        asin: 'B001TEST',
        start: '2026-03-01',
        end: '2026-03-10',
      },
      {
        now: vi
          .fn()
          .mockReturnValueOnce('2026-03-10T02:00:00Z')
          .mockReturnValueOnce('2026-03-10T02:05:00Z'),
        getRuntimeContext: async () => ({
          activeVersion: makeActiveVersion(),
        }),
        createRun: async () => makeRun(),
        updateRun: async (_runId, payload) => {
          updateCalls.push(payload as unknown as Record<string, unknown>);
          return {
            ...makeRun(),
            status: payload.status,
            diagnostics_json: payload.diagnostics ?? null,
            started_at: payload.startedAt ?? '2026-03-10T02:00:00Z',
            completed_at: payload.completedAt ?? null,
            product_snapshot_count: payload.productSnapshotCount ?? 0,
            target_snapshot_count: payload.targetSnapshotCount ?? 0,
            recommendation_snapshot_count: payload.recommendationSnapshotCount ?? 0,
            role_transition_count: payload.roleTransitionCount ?? 0,
          };
        },
        getProductSettings: async () => null,
        loadPreviousRoleMap: async () => new Map(),
        loadProductSnapshotInput: async () => ({
          productId: 'product-1',
          asin: 'B001TEST',
          overview: {
            product: {
              asin: 'B001TEST',
              title: 'Test product',
              shortName: 'Test',
              displayName: 'Test',
            },
            economics: {
              sales: 1800,
              orders: 30,
              units: 32,
              adSpend: 420,
              adSales: 950,
              tacos: 0.23,
              averagePrice: 56.25,
              costCoverage: 0.62,
              breakEvenAcos: 0.34,
              contributionBeforeAdsPerUnit: 18,
              contributionAfterAds: 226,
            },
            visibility: {
              rankingCoverage: {
                status: 'ready' as const,
                trackedKeywords: 5,
                detail: 'ready',
              },
              heroQueryTrend: {
                status: 'ready' as const,
                keyword: 'blue widget',
                searchVolume: 2200,
                latestOrganicRank: 9,
                baselineOrganicRank: 13,
                rankDelta: 4,
                detail: 'ready',
              },
              sqpCoverage: {
                status: 'ready' as const,
                selectedWeekEnd: '2026-03-08',
                trackedQueries: 4,
                totalSearchVolume: 4200,
                topQuery: 'blue widget',
                detail: 'ready',
              },
            },
            state: {
              value: 'profitable' as const,
              label: 'Profitable',
              reason: 'ready',
            },
            objective: {
              value: 'Scale Profit' as const,
              reason: 'ready',
            },
            warnings: [],
          },
          snapshotPayload: {
            phase: 4,
          },
        }),
        loadTargetSnapshotInputs: async () => {
          throw new Error('target loader exploded');
        },
        insertProductSnapshots: async () => {
          throw new Error('insertProductSnapshots should not be called on failure');
        },
        insertTargetSnapshots: async () => {
          throw new Error('insertTargetSnapshots should not be called on failure');
        },
        insertRecommendationSnapshots: async () => {
          throw new Error('insertRecommendationSnapshots should not be called on failure');
        },
        insertRoleTransitionLogs: async () => {
          throw new Error('insertRoleTransitionLogs should not be called on failure');
        },
      }
    );

    expect(result.status).toBe('failed');
    expect(result.diagnostics?.error_message).toBe('target loader exploded');
    expect(updateCalls[0]).toMatchObject({
      status: 'running',
      startedAt: '2026-03-10T02:00:00Z',
    });
    expect(updateCalls[1]).toMatchObject({
      status: 'failed',
      completedAt: '2026-03-10T02:05:00Z',
    });
    expect(updateCalls[1]?.diagnostics).toMatchObject({
      stage: 'manual_run',
      error_message: 'target loader exploded',
    });
  });

  it('keeps zero-target completed runs explicit via structured diagnostics', async () => {
    const updateCalls: Array<Record<string, unknown>> = [];

    const result = await executeAdsOptimizerManualRun(
      {
        asin: 'B001TEST',
        start: '2026-03-01',
        end: '2026-03-10',
      },
      {
        now: vi
          .fn()
          .mockReturnValueOnce('2026-03-10T03:00:00Z')
          .mockReturnValueOnce('2026-03-10T03:05:00Z'),
        getRuntimeContext: async () => ({
          activeVersion: makeActiveVersion(),
        }),
        createRun: async () => makeRun(),
        updateRun: async (_runId, payload) => {
          updateCalls.push(payload as unknown as Record<string, unknown>);
          return {
            ...makeRun(),
            status: payload.status,
            diagnostics_json: payload.diagnostics ?? null,
            started_at: payload.startedAt ?? '2026-03-10T03:00:00Z',
            completed_at: payload.completedAt ?? null,
            product_snapshot_count: payload.productSnapshotCount ?? 0,
            target_snapshot_count: payload.targetSnapshotCount ?? 0,
            recommendation_snapshot_count: payload.recommendationSnapshotCount ?? 0,
            role_transition_count: payload.roleTransitionCount ?? 0,
          };
        },
        getProductSettings: async () => null,
        loadPreviousRoleMap: async () => new Map(),
        loadProductSnapshotInput: async () => ({
          productId: 'product-1',
          asin: 'B001TEST',
          overview: {
            product: {
              asin: 'B001TEST',
              title: 'Test product',
              shortName: 'Test',
              displayName: 'Test',
            },
            economics: {
              sales: 1800,
              orders: 30,
              units: 32,
              adSpend: 420,
              adSales: 950,
              tacos: 0.23,
              averagePrice: 56.25,
              costCoverage: 0.62,
              breakEvenAcos: 0.34,
              contributionBeforeAdsPerUnit: 18,
              contributionAfterAds: 226,
            },
            visibility: {
              rankingCoverage: {
                status: 'ready' as const,
                trackedKeywords: 5,
                detail: 'ready',
              },
              heroQueryTrend: {
                status: 'ready' as const,
                keyword: 'blue widget',
                searchVolume: 2200,
                latestOrganicRank: 9,
                baselineOrganicRank: 13,
                rankDelta: 4,
                detail: 'ready',
              },
              sqpCoverage: {
                status: 'ready' as const,
                selectedWeekEnd: '2026-03-08',
                trackedQueries: 4,
                totalSearchVolume: 4200,
                topQuery: 'blue widget',
                detail: 'ready',
              },
            },
            state: {
              value: 'profitable' as const,
              label: 'Profitable',
              reason: 'ready',
            },
            objective: {
              value: 'Scale Profit' as const,
              reason: 'ready',
            },
            warnings: [],
          },
          snapshotPayload: {
            phase: 4,
          },
        }),
        loadTargetSnapshotInputs: async () => ({
          rows: [],
          zeroTargetDiagnostics: {
            code: 'NO_TARGET_ROWS_FOUND',
            message: 'No target rows matched the ASIN scope.',
          },
        }),
        insertProductSnapshots: async (rows) =>
          rows.map((row, index) => ({
            product_snapshot_id: `product-snapshot-${index + 1}`,
            run_id: row.runId,
            account_id: 'acct',
            marketplace: 'US',
            product_id: row.productId,
            asin: row.asin,
            snapshot_payload_json: row.snapshotPayload,
            created_at: '2026-03-10T03:01:00Z',
          })),
        insertTargetSnapshots: async () => [],
        insertRoleTransitionLogs: async () => [],
        insertRecommendationSnapshots: async () => [],
      }
    );

    expect(result).toMatchObject({
      status: 'completed',
      productSnapshotCount: 1,
      targetSnapshotCount: 0,
      recommendationSnapshotCount: 0,
      diagnostics: {
        code: 'NO_TARGET_ROWS_FOUND',
        message: 'No target rows matched the ASIN scope.',
      },
    });
    expect(updateCalls[1]).toMatchObject({
      status: 'completed',
      targetSnapshotCount: 0,
      recommendationSnapshotCount: 0,
      completedAt: '2026-03-10T03:05:00Z',
      diagnostics: {
        code: 'NO_TARGET_ROWS_FOUND',
        message: 'No target rows matched the ASIN scope.',
      },
    });
  });

  it('fails the run when persisted recommendation rows are still Phase 4 placeholders', async () => {
    const updateCalls: Array<Record<string, unknown>> = [];

    const result = await executeAdsOptimizerManualRun(
      {
        asin: 'B001TEST',
        start: '2026-03-01',
        end: '2026-03-10',
      },
      {
        now: vi
          .fn()
          .mockReturnValueOnce('2026-03-10T04:00:00Z')
          .mockReturnValueOnce('2026-03-10T04:05:00Z'),
        getRuntimeContext: async () => ({
          activeVersion: makeActiveVersion(),
        }),
        createRun: async () => makeRun(),
        updateRun: async (_runId, payload) => {
          updateCalls.push(payload as unknown as Record<string, unknown>);
          return {
            ...makeRun(),
            status: payload.status,
            diagnostics_json: payload.diagnostics ?? null,
            started_at: payload.startedAt ?? null,
            completed_at: payload.completedAt ?? null,
            product_snapshot_count: payload.productSnapshotCount ?? 0,
            target_snapshot_count: payload.targetSnapshotCount ?? 0,
            recommendation_snapshot_count: payload.recommendationSnapshotCount ?? 0,
            role_transition_count: payload.roleTransitionCount ?? 0,
          };
        },
        getProductSettings: async () => null,
        loadPreviousRoleMap: async () => new Map(),
        loadProductSnapshotInput: async () => ({
          productId: 'product-1',
          asin: 'B001TEST',
          overview: {
            product: { asin: 'B001TEST', title: 'Test', shortName: 'Test', displayName: 'Test' },
            economics: {
              sales: 100,
              orders: 2,
              units: 2,
              adSpend: 20,
              adSales: 50,
              tacos: 0.2,
              averagePrice: 50,
              costCoverage: 0.5,
              breakEvenAcos: 0.35,
              contributionBeforeAdsPerUnit: 10,
              contributionAfterAds: 15,
            },
            visibility: {
              rankingCoverage: { status: 'ready' as const, trackedKeywords: 1, detail: 'ready' },
              heroQueryTrend: {
                status: 'ready' as const,
                keyword: 'blue widget',
                searchVolume: 1000,
                latestOrganicRank: 8,
                baselineOrganicRank: 10,
                rankDelta: 2,
                detail: 'ready',
              },
              sqpCoverage: {
                status: 'ready' as const,
                selectedWeekEnd: '2026-03-08',
                trackedQueries: 1,
                totalSearchVolume: 1000,
                topQuery: 'blue widget',
                detail: 'ready',
              },
            },
            state: { value: 'profitable' as const, label: 'Profitable', reason: 'ready' },
            objective: { value: 'Scale Profit' as const, reason: 'ready' },
            warnings: [],
          },
          snapshotPayload: { phase: 4 },
        }),
        loadTargetSnapshotInputs: async () => ({
          rows: [
            {
              asin: 'B001TEST',
              campaignId: 'campaign-1',
              adGroupId: 'ad-group-1',
              targetId: 'target-1',
              sourceScope: 'asin_via_sp_advertised_product_membership',
              coverageNote: 'Coverage note.',
              snapshotPayload: {
                phase: 5,
                totals: { impressions: 10, clicks: 2, spend: 5, orders: 1, sales: 20 },
                derived_metrics: { profit_dollars: 2, loss_dollars: null, break_even_gap: 0.1 },
                coverage: {
                  statuses: {
                    tos_is: 'ready',
                    stis: 'ready',
                    stir: 'ready',
                    placement_context: 'ready',
                    search_terms: 'ready',
                    break_even_inputs: 'ready',
                  },
                  notes: [],
                },
                state_engine: {
                  engine_version: 'phase6_v1',
                  coverage_status: 'ready',
                  efficiency: {
                    value: 'profitable',
                    label: 'Profitable',
                    detail: 'ok',
                    coverage_status: 'ready',
                    reason_codes: ['EFFICIENCY_POSITIVE_CONTRIBUTION_AFTER_ADS'],
                  },
                  confidence: {
                    value: 'confirmed',
                    label: 'Confirmed',
                    detail: 'ok',
                    coverage_status: 'ready',
                    reason_codes: ['CONFIDENCE_ORDER_THRESHOLD_MET'],
                  },
                  importance: {
                    value: 'tier_1_dominant',
                    label: 'Tier 1 dominant',
                    detail: 'ok',
                    coverage_status: 'ready',
                    reason_codes: ['IMPORTANCE_SCORE_DOMINANT'],
                  },
                  scores: {
                    opportunity: 80,
                    risk: 10,
                    opportunity_reason_codes: ['OPPORTUNITY_PROFITABLE_BASELINE'],
                    risk_reason_codes: ['RISK_PARTIAL_COVERAGE'],
                  },
                  reason_codes: ['EFFICIENCY_POSITIVE_CONTRIBUTION_AFTER_ADS'],
                },
                role_engine: {
                  engine_version: 'phase7_v1',
                  coverage_status: 'ready',
                  previous_role: null,
                  desired_role: {
                    value: 'Scale',
                    label: 'Scale',
                    detail: 'scale',
                    coverage_status: 'ready',
                    reason_codes: ['ROLE_DESIRED_PROFIT_SCALE'],
                  },
                  current_role: {
                    value: 'Scale',
                    label: 'Scale',
                    detail: 'scale',
                    coverage_status: 'ready',
                    reason_codes: ['CURRENT_ROLE_TRANSITION_APPLIED'],
                  },
                  transition: {
                    rule: 'bootstrap_from_desired',
                    reason_codes: ['CURRENT_ROLE_BOOTSTRAP_FROM_DESIRED'],
                  },
                  guardrails: {
                    coverage_status: 'ready',
                    categories: {
                      no_sale_spend_cap: 20,
                      no_sale_click_cap: 12,
                      max_loss_per_cycle: 25,
                      max_bid_increase_per_cycle_pct: 12,
                      max_bid_decrease_per_cycle_pct: 18,
                      max_placement_bias_increase_per_cycle_pct: 8,
                      rank_push_time_limit_days: 14,
                      manual_approval_threshold: 'medium',
                      auto_pause_threshold: 40,
                      min_bid_floor: 0.2,
                      max_bid_ceiling: 3,
                    },
                    flags: {
                      requires_manual_approval: true,
                      auto_pause_eligible: false,
                      bid_changes_allowed: true,
                      placement_changes_allowed: true,
                      transition_locked: false,
                    },
                    reason_codes: ['GUARDRAIL_ROLE_SCALE'],
                    notes: [],
                  },
                  reason_codes: ['ROLE_DESIRED_PROFIT_SCALE'],
                },
                execution_context: {
                  snapshot_date: '2026-03-10',
                  target: {
                    id: 'target-1',
                    text: 'blue widget',
                    match_type: 'exact',
                    is_negative: false,
                    current_state: 'enabled',
                    current_bid: 1.25,
                  },
                  campaign: { id: 'campaign-1', name: 'Campaign 1', current_state: 'enabled' },
                  placement: {
                    placement_code: 'PLACEMENT_TOP',
                    label: 'Top of search',
                    current_percentage: 15,
                  },
                },
              },
            },
          ],
          zeroTargetDiagnostics: null,
        }),
        insertProductSnapshots: async (rows) =>
          rows.map((row, index) => ({
            product_snapshot_id: `product-${index + 1}`,
            run_id: row.runId,
            account_id: 'acct',
            marketplace: 'US',
            product_id: row.productId,
            asin: row.asin,
            snapshot_payload_json: row.snapshotPayload,
            created_at: '2026-03-10T04:01:00Z',
          })),
        insertTargetSnapshots: async (rows) =>
          rows.map((row, index) => ({
            target_snapshot_id: `target-${index + 1}`,
            run_id: row.runId,
            account_id: 'acct',
            marketplace: 'US',
            asin: row.asin,
            campaign_id: row.campaignId,
            ad_group_id: row.adGroupId,
            target_id: row.targetId,
            source_scope: row.sourceScope,
            coverage_note: row.coverageNote,
            snapshot_payload_json: row.snapshotPayload,
            created_at: '2026-03-10T04:02:00Z',
          })),
        insertRoleTransitionLogs: async () => [],
        insertRecommendationSnapshots: async (rows) =>
          rows.map((row, index) => ({
            recommendation_snapshot_id: `rec-${index + 1}`,
            run_id: row.runId,
            target_snapshot_id: row.targetSnapshotId,
            account_id: 'acct',
            marketplace: 'US',
            asin: row.asin,
            status: 'pending_phase5' as const,
            action_type: null,
            reason_codes_json: ['PHASE4_BACKBONE_ONLY', 'NO_RECOMMENDATION_ENGINE_ACTIVE'],
            snapshot_payload_json: {
              phase: 4,
              execution_boundary: 'snapshot_only',
            },
            created_at: '2026-03-10T04:03:00Z',
          })),
      }
    );

    expect(result.status).toBe('failed');
    expect(result.diagnostics?.error_message).toContain('pending_phase5');
    expect(updateCalls[1]?.status).toBe('failed');
  });

  it('fails the run when persisted recommendation row count does not match target snapshots', async () => {
    const updateCalls: Array<Record<string, unknown>> = [];

    const result = await executeAdsOptimizerManualRun(
      {
        asin: 'B001TEST',
        start: '2026-03-01',
        end: '2026-03-10',
      },
      {
        now: vi
          .fn()
          .mockReturnValueOnce('2026-03-10T05:00:00Z')
          .mockReturnValueOnce('2026-03-10T05:05:00Z'),
        getRuntimeContext: async () => ({
          activeVersion: makeActiveVersion(),
        }),
        createRun: async () => makeRun(),
        updateRun: async (_runId, payload) => {
          updateCalls.push(payload as unknown as Record<string, unknown>);
          return {
            ...makeRun(),
            status: payload.status,
            diagnostics_json: payload.diagnostics ?? null,
            started_at: payload.startedAt ?? null,
            completed_at: payload.completedAt ?? null,
            product_snapshot_count: payload.productSnapshotCount ?? 0,
            target_snapshot_count: payload.targetSnapshotCount ?? 0,
            recommendation_snapshot_count: payload.recommendationSnapshotCount ?? 0,
            role_transition_count: payload.roleTransitionCount ?? 0,
          };
        },
        getProductSettings: async () => null,
        loadPreviousRoleMap: async () => new Map(),
        loadProductSnapshotInput: async () => ({
          productId: 'product-1',
          asin: 'B001TEST',
          overview: {
            product: { asin: 'B001TEST', title: 'Test', shortName: 'Test', displayName: 'Test' },
            economics: {
              sales: 100,
              orders: 2,
              units: 2,
              adSpend: 20,
              adSales: 50,
              tacos: 0.2,
              averagePrice: 50,
              costCoverage: 0.5,
              breakEvenAcos: 0.35,
              contributionBeforeAdsPerUnit: 10,
              contributionAfterAds: 15,
            },
            visibility: {
              rankingCoverage: { status: 'ready' as const, trackedKeywords: 1, detail: 'ready' },
              heroQueryTrend: {
                status: 'ready' as const,
                keyword: 'blue widget',
                searchVolume: 1000,
                latestOrganicRank: 8,
                baselineOrganicRank: 10,
                rankDelta: 2,
                detail: 'ready',
              },
              sqpCoverage: {
                status: 'ready' as const,
                selectedWeekEnd: '2026-03-08',
                trackedQueries: 1,
                totalSearchVolume: 1000,
                topQuery: 'blue widget',
                detail: 'ready',
              },
            },
            state: { value: 'profitable' as const, label: 'Profitable', reason: 'ready' },
            objective: { value: 'Scale Profit' as const, reason: 'ready' },
            warnings: [],
          },
          snapshotPayload: { phase: 4 },
        }),
        loadTargetSnapshotInputs: async () => ({
          rows: [
            {
              asin: 'B001TEST',
              campaignId: 'campaign-1',
              adGroupId: 'ad-group-1',
              targetId: 'target-1',
              sourceScope: 'asin_via_sp_advertised_product_membership',
              coverageNote: 'Coverage note.',
              snapshotPayload: {
                phase: 5,
                totals: { impressions: 10, clicks: 2, spend: 5, orders: 1, sales: 20 },
                coverage: {
                  statuses: {
                    tos_is: 'ready',
                    stis: 'ready',
                    stir: 'ready',
                    placement_context: 'ready',
                    search_terms: 'ready',
                    break_even_inputs: 'ready',
                  },
                  notes: [],
                },
                state_engine: {
                  engine_version: 'phase6_v1',
                  coverage_status: 'ready',
                  efficiency: {
                    value: 'profitable',
                    label: 'Profitable',
                    detail: 'ok',
                    coverage_status: 'ready',
                    reason_codes: ['EFFICIENCY_POSITIVE_CONTRIBUTION_AFTER_ADS'],
                  },
                  confidence: {
                    value: 'confirmed',
                    label: 'Confirmed',
                    detail: 'ok',
                    coverage_status: 'ready',
                    reason_codes: ['CONFIDENCE_ORDER_THRESHOLD_MET'],
                  },
                  importance: {
                    value: 'tier_1_dominant',
                    label: 'Tier 1 dominant',
                    detail: 'ok',
                    coverage_status: 'ready',
                    reason_codes: ['IMPORTANCE_SCORE_DOMINANT'],
                  },
                  scores: {
                    opportunity: 80,
                    risk: 10,
                    opportunity_reason_codes: ['OPPORTUNITY_PROFITABLE_BASELINE'],
                    risk_reason_codes: ['RISK_PARTIAL_COVERAGE'],
                  },
                  reason_codes: ['EFFICIENCY_POSITIVE_CONTRIBUTION_AFTER_ADS'],
                },
                role_engine: {
                  engine_version: 'phase7_v1',
                  coverage_status: 'ready',
                  previous_role: null,
                  desired_role: {
                    value: 'Scale',
                    label: 'Scale',
                    detail: 'scale',
                    coverage_status: 'ready',
                    reason_codes: ['ROLE_DESIRED_PROFIT_SCALE'],
                  },
                  current_role: {
                    value: 'Scale',
                    label: 'Scale',
                    detail: 'scale',
                    coverage_status: 'ready',
                    reason_codes: ['CURRENT_ROLE_TRANSITION_APPLIED'],
                  },
                  transition: {
                    rule: 'bootstrap_from_desired',
                    reason_codes: ['CURRENT_ROLE_BOOTSTRAP_FROM_DESIRED'],
                  },
                  guardrails: {
                    coverage_status: 'ready',
                    categories: {
                      no_sale_spend_cap: 20,
                      no_sale_click_cap: 12,
                      max_loss_per_cycle: 25,
                      max_bid_increase_per_cycle_pct: 12,
                      max_bid_decrease_per_cycle_pct: 18,
                      max_placement_bias_increase_per_cycle_pct: 8,
                      rank_push_time_limit_days: 14,
                      manual_approval_threshold: 'medium',
                      auto_pause_threshold: 40,
                      min_bid_floor: 0.2,
                      max_bid_ceiling: 3,
                    },
                    flags: {
                      requires_manual_approval: true,
                      auto_pause_eligible: false,
                      bid_changes_allowed: true,
                      placement_changes_allowed: true,
                      transition_locked: false,
                    },
                    reason_codes: ['GUARDRAIL_ROLE_SCALE'],
                    notes: [],
                  },
                  reason_codes: ['ROLE_DESIRED_PROFIT_SCALE'],
                },
                execution_context: {
                  snapshot_date: '2026-03-10',
                  target: {
                    id: 'target-1',
                    text: 'blue widget',
                    match_type: 'exact',
                    is_negative: false,
                    current_state: 'enabled',
                    current_bid: 1.25,
                  },
                  campaign: { id: 'campaign-1', name: 'Campaign 1', current_state: 'enabled' },
                  placement: {
                    placement_code: 'PLACEMENT_TOP',
                    label: 'Top of search',
                    current_percentage: 15,
                  },
                },
              },
            },
          ],
          zeroTargetDiagnostics: null,
        }),
        insertProductSnapshots: async (rows) =>
          rows.map((row, index) => ({
            product_snapshot_id: `product-${index + 1}`,
            run_id: row.runId,
            account_id: 'acct',
            marketplace: 'US',
            product_id: row.productId,
            asin: row.asin,
            snapshot_payload_json: row.snapshotPayload,
            created_at: '2026-03-10T05:01:00Z',
          })),
        insertTargetSnapshots: async (rows) =>
          rows.map((row, index) => ({
            target_snapshot_id: `target-${index + 1}`,
            run_id: row.runId,
            account_id: 'acct',
            marketplace: 'US',
            asin: row.asin,
            campaign_id: row.campaignId,
            ad_group_id: row.adGroupId,
            target_id: row.targetId,
            source_scope: row.sourceScope,
            coverage_note: row.coverageNote,
            snapshot_payload_json: row.snapshotPayload,
            created_at: '2026-03-10T05:02:00Z',
          })),
        insertRoleTransitionLogs: async () => [],
        insertRecommendationSnapshots: async () => [],
      }
    );

    expect(result.status).toBe('failed');
    expect(result.diagnostics?.error_message).toContain('count mismatch');
    expect(updateCalls[1]?.status).toBe('failed');
  });
});
