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
      throw new Error('supabaseAdmin should not be called in adsOptimizerOutcomeReviewData.test.ts');
    },
  },
}));

import {
  buildAdsOptimizerOutcomeReviewPhaseSummaries,
  buildAdsOptimizerOutcomeReviewSegments,
} from '../apps/web/src/lib/ads-optimizer/outcomeReview';

describe('ads optimizer outcome review phase summaries', () => {
  it('builds phase summaries from change sets, generated runs, linked changes, and latest validations', () => {
    const phases = buildAdsOptimizerOutcomeReviewPhaseSummaries({
      changeSets: [
        {
          id: 'cs-validated',
          name: 'Optimizer handoff validated',
          objective: 'Break Even',
          filters_json: {
            source: 'ads_optimizer_phase10_handoff',
            asin: 'B001TEST',
            optimizer_run_id: 'opt-run-1',
            target_snapshot_ids: ['ts-1', 'ts-2'],
          },
          generated_run_id: 'bulk-run-1',
          generated_artifact_json: {
            staged_action_count: 4,
            selected_row_count: 2,
          },
          created_at: '2026-03-10T10:00:00Z',
        },
        {
          id: 'cs-mixed',
          name: 'Optimizer handoff mixed',
          objective: 'Break Even',
          filters_json: {
            source: 'ads_optimizer_phase10_handoff',
            asin: 'B001TEST',
            optimizer_run_id: 'opt-run-2',
          },
          generated_run_id: 'bulk-run-2',
          generated_artifact_json: null,
          created_at: '2026-03-09T10:00:00Z',
        },
        {
          id: 'cs-pending',
          name: 'Optimizer handoff pending',
          objective: 'Break Even',
          filters_json: {
            source: 'ads_optimizer_phase10_handoff',
            asin: 'B001TEST',
            optimizer_run_id: 'opt-run-3',
          },
          generated_run_id: null,
          generated_artifact_json: {
            staged_action_count: 1,
            selected_row_count: 1,
          },
          created_at: '2026-03-08T10:00:00Z',
        },
      ],
      changeSetItems: [
        {
          id: 'item-1',
          change_set_id: 'cs-mixed',
          channel: 'sp',
          entity_level: 'target',
          target_id: 'target-1',
          target_key: null,
          entity_key: 'target-1',
          campaign_id: 'campaign-1',
          ad_group_id: 'ad-group-1',
          placement_code: null,
          action_type: 'update_target_bid',
          before_json: {},
          after_json: {},
          objective: 'Break Even',
          hypothesis: null,
          notes: null,
          ui_context_json: null,
        },
        {
          id: 'item-2',
          change_set_id: 'cs-mixed',
          channel: 'sp',
          entity_level: 'target',
          target_id: 'target-2',
          target_key: null,
          entity_key: 'target-2',
          campaign_id: 'campaign-1',
          ad_group_id: 'ad-group-1',
          placement_code: null,
          action_type: 'update_target_state',
          before_json: {},
          after_json: {},
          objective: 'Break Even',
          hypothesis: null,
          notes: null,
          ui_context_json: null,
        },
      ],
      linkedChanges: [
        {
          change_id: 'change-1',
          occurred_at: '2026-03-11T09:00:00Z',
          source: 'bulkgen',
          after_json: { run_id: 'bulk-run-1' },
        },
        {
          change_id: 'change-2',
          occurred_at: '2026-03-12T09:00:00Z',
          source: 'bulkgen',
          after_json: { run_id: 'bulk-run-1' },
        },
        {
          change_id: 'change-3',
          occurred_at: '2026-03-10T09:00:00Z',
          source: 'bulkgen',
          after_json: { run_id: 'bulk-run-2' },
        },
        {
          change_id: 'change-4',
          occurred_at: '2026-03-10T10:00:00Z',
          source: 'bulkgen',
          after_json: { run_id: 'bulk-run-2' },
        },
      ],
      validations: [
        {
          change_id: 'change-2',
          status: 'pending',
          validated_snapshot_date: null,
          checked_at: '2026-03-12T20:00:00Z',
        },
        {
          change_id: 'change-1',
          status: 'validated',
          validated_snapshot_date: '2026-03-11',
          checked_at: '2026-03-11T20:00:00Z',
        },
        {
          change_id: 'change-3',
          status: 'mismatch',
          validated_snapshot_date: null,
          checked_at: '2026-03-10T20:00:00Z',
        },
        {
          change_id: 'change-4',
          status: 'not_found',
          validated_snapshot_date: null,
          checked_at: '2026-03-10T21:00:00Z',
        },
      ],
    });

    expect(phases.map((phase) => phase.changeSetId)).toEqual([
      'cs-validated',
      'cs-mixed',
      'cs-pending',
    ]);

    expect(phases[0]).toMatchObject({
      changeSetName: 'Optimizer handoff validated',
      optimizerRunId: 'opt-run-1',
      selectedAsin: 'B001TEST',
      stagedActionCount: 4,
      targetCount: 2,
      firstValidatedDate: '2026-03-11',
      validatedEffectiveDate: '2026-03-11',
      status: 'partial',
      validationSummary: {
        validated: 1,
        pending: 1,
        mismatch: 0,
        notFound: 0,
        total: 2,
      },
    });

    expect(phases[1]).toMatchObject({
      changeSetName: 'Optimizer handoff mixed',
      optimizerRunId: 'opt-run-2',
      stagedActionCount: 2,
      targetCount: 2,
      status: 'mixed_validation',
      validationSummary: {
        validated: 0,
        pending: 0,
        mismatch: 1,
        notFound: 1,
        total: 2,
      },
    });

    expect(phases[2]).toMatchObject({
      changeSetName: 'Optimizer handoff pending',
      optimizerRunId: 'opt-run-3',
      stagedActionCount: 1,
      targetCount: 1,
      firstValidatedDate: null,
      validatedEffectiveDate: null,
      status: 'pending',
      validationSummary: {
        validated: 0,
        pending: 0,
        mismatch: 0,
        notFound: 0,
        total: 0,
      },
    });
  });

  it('builds segment summaries with score filters and caution states for the index page', () => {
    const segments = buildAdsOptimizerOutcomeReviewSegments({
      horizon: '7',
      phaseDetails: [
        {
          kind: 'ready',
          changeSetId: 'cs-1',
          changeSetName: 'Phase 1',
          asin: 'B001TEST',
          selectedEndDate: '2026-03-13',
          horizon: '7',
          phase: {
            changeSetId: 'cs-1',
            changeSetName: 'Phase 1',
            optimizerRunId: 'run-1',
            selectedAsin: 'B001TEST',
            stagedActionCount: 2,
            targetCount: 2,
            validationSummary: {
              validated: 2,
              mismatch: 0,
              pending: 0,
              notFound: 0,
              total: 2,
            },
            firstValidatedDate: '2026-03-10',
            validatedEffectiveDate: '2026-03-10',
            status: 'validated',
            createdAt: '2026-03-10T10:00:00Z',
            generatedRunId: 'bulk-run-1',
          },
          stagedChanges: [],
          reviewOnlyNotes: [],
          objectiveContext: {
            archetype: 'hybrid',
            atChange: {
              value: 'Break Even',
              reason: 'At change',
              source: 'change_set_objective',
              runId: 'run-1',
              windowStart: '2026-03-03',
              windowEnd: '2026-03-09',
            },
            latest: {
              value: 'Break Even',
              reason: 'Latest',
              source: 'current_overview',
              runId: null,
              windowStart: '2026-03-07',
              windowEnd: '2026-03-13',
            },
            changedSincePhase: false,
          },
          windows: [
            {
              key: 'before',
              label: 'Before',
              startDate: '2026-03-03',
              endDate: '2026-03-09',
              expectedDays: 7,
              observedDays: 7,
              metrics: {
                contribution_after_ads: -120,
                tacos: 0.31,
                ad_spend: 600,
                ad_sales: 1100,
                total_sales: 1900,
                orders: 18,
              },
              hasData: true,
            },
            {
              key: 'after',
              label: 'After',
              startDate: '2026-03-10',
              endDate: '2026-03-13',
              expectedDays: 4,
              observedDays: 4,
              metrics: {
                contribution_after_ads: 40,
                tacos: 0.19,
                ad_spend: 260,
                ad_sales: 850,
                total_sales: 1450,
                orders: 16,
              },
              hasData: true,
            },
            {
              key: 'latest',
              label: 'Latest',
              startDate: '2026-03-07',
              endDate: '2026-03-13',
              expectedDays: 7,
              observedDays: 7,
              metrics: {
                contribution_after_ads: 55,
                tacos: 0.18,
                ad_spend: 430,
                ad_sales: 1380,
                total_sales: 2380,
                orders: 24,
              },
              hasData: true,
            },
          ],
          score: {
            score: 81,
            label: 'confirmed_win',
            confidence: 'high',
            objectiveUsed: 'Break Even',
            explanation: 'Confirmed',
            evidenceNotes: [],
            visibilitySignal: {
              available: false,
              keyword: null,
              beforeRank: null,
              afterRank: null,
              latestRank: null,
              detail: 'No visibility signal',
            },
            components: [],
          },
          latestValidationDate: '2026-03-10',
          nextPhaseValidatedEffectiveDate: '2026-03-14',
          postWindowCappedByNextPhase: true,
          runId: 'run-1',
          returnHref: '/ads/optimizer?view=outcomes',
          detailHref: '/ads/optimizer/outcomes/cs-1?horizon=7',
        },
        {
          kind: 'ready',
          changeSetId: 'cs-2',
          changeSetName: 'Phase 2',
          asin: 'B001TEST',
          selectedEndDate: '2026-03-20',
          horizon: '7',
          phase: {
            changeSetId: 'cs-2',
            changeSetName: 'Phase 2',
            optimizerRunId: 'run-2',
            selectedAsin: 'B001TEST',
            stagedActionCount: 1,
            targetCount: 1,
            validationSummary: {
              validated: 1,
              mismatch: 0,
              pending: 1,
              notFound: 0,
              total: 2,
            },
            firstValidatedDate: '2026-03-14',
            validatedEffectiveDate: '2026-03-14',
            status: 'partial',
            createdAt: '2026-03-14T10:00:00Z',
            generatedRunId: 'bulk-run-2',
          },
          stagedChanges: [],
          reviewOnlyNotes: [],
          objectiveContext: {
            archetype: 'hybrid',
            atChange: {
              value: 'Break Even',
              reason: 'At change',
              source: 'optimizer_product_snapshot',
              runId: 'run-2',
              windowStart: '2026-03-07',
              windowEnd: '2026-03-13',
            },
            latest: {
              value: 'Scale Profit',
              reason: 'Latest',
              source: 'current_overview',
              runId: null,
              windowStart: '2026-03-14',
              windowEnd: '2026-03-20',
            },
            changedSincePhase: true,
          },
          windows: [
            {
              key: 'before',
              label: 'Before',
              startDate: '2026-03-07',
              endDate: '2026-03-13',
              expectedDays: 7,
              observedDays: 7,
              metrics: {
                contribution_after_ads: 20,
                tacos: 0.21,
                ad_spend: 380,
                ad_sales: 980,
                total_sales: 1980,
                orders: 19,
              },
              hasData: true,
            },
            {
              key: 'after',
              label: 'After',
              startDate: '2026-03-14',
              endDate: '2026-03-16',
              expectedDays: 7,
              observedDays: 3,
              metrics: {
                contribution_after_ads: 35,
                tacos: 0.2,
                ad_spend: 180,
                ad_sales: 460,
                total_sales: 910,
                orders: 8,
              },
              hasData: true,
            },
            {
              key: 'latest',
              label: 'Latest',
              startDate: '2026-03-14',
              endDate: '2026-03-20',
              expectedDays: 7,
              observedDays: 5,
              metrics: {
                contribution_after_ads: 42,
                tacos: 0.19,
                ad_spend: 290,
                ad_sales: 760,
                total_sales: 1460,
                orders: 13,
              },
              hasData: true,
            },
          ],
          score: {
            score: 58,
            label: 'too_early',
            confidence: 'low',
            objectiveUsed: 'Break Even',
            explanation: 'Too early',
            evidenceNotes: ['Thin window'],
            visibilitySignal: {
              available: false,
              keyword: null,
              beforeRank: null,
              afterRank: null,
              latestRank: null,
              detail: 'No visibility signal',
            },
            components: [],
          },
          latestValidationDate: '2026-03-14',
          nextPhaseValidatedEffectiveDate: null,
          postWindowCappedByNextPhase: false,
          runId: 'run-2',
          returnHref: '/ads/optimizer?view=outcomes',
          detailHref: '/ads/optimizer/outcomes/cs-2?horizon=7',
        },
      ],
    });

    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({
      segmentLabel: 'Baseline -> Phase 1',
      filterKey: 'confirmed_win',
      scoreLabel: 'confirmed_win',
      objectiveContextLabel: 'Break Even',
      detailHref: '/ads/optimizer/outcomes/cs-1?horizon=7',
    });

    expect(segments[1]).toMatchObject({
      segmentLabel: 'Phase 1 -> Phase 2',
      filterKey: 'pending',
      scoreLabel: 'too_early',
      objectiveContextLabel: 'Break Even -> Scale Profit',
    });
    expect(segments[1]?.cautions.map((caution) => caution.id)).toEqual([
      'objective_changed_mid_segment',
      'validation_incomplete',
      'kpi_coverage_incomplete',
      'phase_landed_too_soon',
    ]);
  });
});
