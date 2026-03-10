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
          expect(payload.inputSummary.phase).toBe(6);
          expect(payload.inputSummary.snapshot_boundaries).toBeTruthy();
          expect(payload.inputSummary.snapshot_boundaries.target_profile_engine).toBe(
            'phase5_target_profile_engine'
          );
          expect(payload.inputSummary.snapshot_boundaries.state_engine).toBe('phase6_state_engine');
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
      completedAt: '2026-03-10T01:05:00Z',
    });
    expect(insertedRecommendationRows[0]?.status).toBe('pending_phase5');
    expect(insertedRecommendationRows[0]?.reasonCodes).toEqual([
      'PHASE4_BACKBONE_ONLY',
      'NO_RECOMMENDATION_ENGINE_ACTIVE',
    ]);
    expect(updateCalls[1]?.targetSnapshotCount).toBe(1);
    expect(insertedProductRows[0]?.snapshotPayload.state_engine.product_state.value).toBe(
      'profitable'
    );
    expect(insertedTargetRows[0]?.snapshotPayload.phase).toBe(6);
    expect(insertedTargetRows[0]?.snapshotPayload.state_engine.efficiency.value).toBe(
      'profitable'
    );
    expect(insertedTargetRows[0]?.snapshotPayload.state_engine.confidence.value).toBe(
      'confirmed'
    );
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
});
