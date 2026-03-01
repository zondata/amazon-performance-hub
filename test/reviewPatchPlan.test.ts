import { describe, expect, it } from 'vitest';

import {
  applyReviewPatchToProposal,
  buildProposalActionRefs,
  rankAndSortProposalActions,
  selectBulkgenPlansForExecution,
  type ExecutableBulkgenPlanV1,
} from '../apps/web/src/lib/logbook/contracts/reviewPatchPlan';

const basePlans: ExecutableBulkgenPlanV1[] = [
  {
    channel: 'SP',
    generator: 'bulkgen:sp:update',
    run_id: 'exp-sp-001',
    actions: [
      {
        type: 'update_campaign_budget',
        campaign_id: 'sp-camp-1',
        new_budget: 50,
      },
      {
        type: 'update_target_bid',
        target_id: 'sp-target-1',
        new_bid: 1.25,
      },
    ],
  },
];

describe('reviewPatchPlan helpers', () => {
  it('builds deterministic stable change ids', () => {
    const first = buildProposalActionRefs(basePlans).map((row) => row.change_id);
    const second = buildProposalActionRefs(basePlans).map((row) => row.change_id);

    expect(first).toHaveLength(2);
    expect(first).toEqual(second);
    expect(first[0]).toMatch(/^chg_[0-9a-f]{8}$/);
  });

  it('applies reject + modify decisions and returns summary', () => {
    const refs = buildProposalActionRefs(basePlans);
    const result = applyReviewPatchToProposal(basePlans, {
      decisions: [
        {
          change_id: refs[0].change_id,
          decision: 'reject',
        },
        {
          change_id: refs[1].change_id,
          decision: 'modify',
          override_new_value: 1.5,
        },
      ],
    });

    expect(result.summary.actions_total).toBe(2);
    expect(result.summary.rejected_actions).toBe(1);
    expect(result.summary.modified_actions).toBe(1);
    expect(result.bulkgen_plans).toHaveLength(1);
    expect(result.bulkgen_plans[0].actions).toHaveLength(1);
    expect(result.bulkgen_plans[0].actions[0]).toMatchObject({
      type: 'update_target_bid',
      new_bid: 1.5,
    });
  });

  it('sorts review actions by objective/kpi/risk/magnitude ordering', () => {
    const ranked = rankAndSortProposalActions(buildProposalActionRefs(basePlans), {
      objective: 'Grow sales while protecting ACoS',
      forecast_kpis: ['sales', 'acos'],
    });
    expect(ranked).toHaveLength(2);
    expect(ranked[0].review_rank.objective_alignment).toBeLessThanOrEqual(
      ranked[1].review_rank.objective_alignment
    );
  });

  it('prefers final_plan bulkgen plans for execution when available', () => {
    const scope = {
      bulkgen_plans: [
        {
          channel: 'SP',
          generator: 'bulkgen:sp:update',
          run_id: 'proposal-run',
          actions: [{ type: 'update_campaign_budget', campaign_id: 'sp-camp-1', new_budget: 40 }],
        },
      ],
      contract: {
        ads_optimization_v1: {
          ai_run_meta: { workflow_mode: 'manual' },
          final_plan: {
            pack_id: 'final_abc123',
            created_at: '2026-03-01T00:00:00Z',
            source: 'review_patch_applied',
            bulkgen_plans: [
              {
                channel: 'SP',
                generator: 'bulkgen:sp:update',
                run_id: 'final-run',
                actions: [{ type: 'update_campaign_budget', campaign_id: 'sp-camp-1', new_budget: 65 }],
              },
            ],
          },
        },
      },
    };

    const selected = selectBulkgenPlansForExecution(scope);
    expect(selected.source).toBe('final_plan');
    expect(selected.final_plan_pack_id).toBe('final_abc123');
    expect(selected.plans[0].run_id).toBe('final-run');
  });

  it('falls back to proposal plans with warning when final_plan is missing', () => {
    const scope = {
      bulkgen_plans: [
        {
          channel: 'SB',
          generator: 'bulkgen:sb:update',
          run_id: 'proposal-run',
          actions: [{ type: 'update_campaign_budget', campaign_id: 'sb-camp-1', new_budget: 75 }],
        },
      ],
    };

    const selected = selectBulkgenPlansForExecution(scope);
    expect(selected.source).toBe('proposal');
    expect(selected.plans[0].run_id).toBe('proposal-run');
    expect(selected.warning).toMatch(/not finalized/i);
  });
});
