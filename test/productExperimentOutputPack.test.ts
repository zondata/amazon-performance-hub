import { describe, expect, it } from "vitest";
import {
  parseProductExperimentOutputPack,
  PRODUCT_EXPERIMENT_OUTPUT_PACK_KIND,
} from "../apps/web/src/lib/logbook/aiPack/parseProductExperimentOutputPack";

describe("product experiment output pack parser", () => {
  it("rejects missing required experiment fields", () => {
    const result = parseProductExperimentOutputPack(
      JSON.stringify({
        kind: PRODUCT_EXPERIMENT_OUTPUT_PACK_KIND,
        product: { asin: "B0TEST12345" },
        experiment: {
          scope: { status: "planned" },
        },
      }),
      "B0TEST12345"
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/experiment\.name/i);
      expect(result.error).toMatch(/experiment\.objective/i);
    }
  });

  it("rejects ASIN mismatch", () => {
    const result = parseProductExperimentOutputPack(
      JSON.stringify({
        kind: PRODUCT_EXPERIMENT_OUTPUT_PACK_KIND,
        product: { asin: "B0OTHER0000" },
        experiment: {
          name: "Test",
          objective: "Test objective",
          scope: { status: "planned" },
        },
      }),
      "B0TEST12345"
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/must match route ASIN/i);
    }
  });

  it("rejects invalid actions shape", () => {
    const result = parseProductExperimentOutputPack(
      JSON.stringify({
        kind: PRODUCT_EXPERIMENT_OUTPUT_PACK_KIND,
        product: { asin: "B0TEST12345" },
        experiment: {
          name: "Budget test",
          objective: "Grow sales",
          scope: {
            status: "planned",
            bulkgen_plans: [
              {
                channel: "SP",
                generator: "bulkgen:sp:update",
                run_id: "exp-sp-001",
                actions: [{ type: "update_campaign_budget", new_budget: 25 }],
              },
            ],
          },
        },
      }),
      "B0TEST12345"
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/campaign_id/i);
    }
  });

  it("preserves optional parent IDs on ad-group and target actions", () => {
    const result = parseProductExperimentOutputPack(
      JSON.stringify({
        kind: PRODUCT_EXPERIMENT_OUTPUT_PACK_KIND,
        product: { asin: "B0TEST12345" },
        experiment: {
          name: "Identity chain test",
          objective: "Keep rendering stable",
          scope: {
            status: "planned",
            bulkgen_plans: [
              {
                channel: "SP",
                generator: "bulkgen:sp:update",
                run_id: "exp-sp-identity-001",
                actions: [
                  {
                    type: "update_ad_group_state",
                    campaign_id: "  C_SP_1  ",
                    ad_group_id: " AG_SP_1 ",
                    new_state: "enabled",
                  },
                  {
                    type: "update_target_bid",
                    campaign_id: " C_SP_1 ",
                    ad_group_id: " AG_SP_1 ",
                    target_id: " T_SP_1 ",
                    new_bid: 1.15,
                  },
                ],
              },
              {
                channel: "SB",
                generator: "bulkgen:sb:update",
                run_id: "exp-sb-identity-001",
                actions: [
                  {
                    type: "update_ad_group_default_bid",
                    campaign_id: " C_SB_1 ",
                    ad_group_id: " AG_SB_1 ",
                    new_default_bid: 0.85,
                  },
                  {
                    type: "update_target_state",
                    campaign_id: " C_SB_1 ",
                    ad_group_id: " AG_SB_1 ",
                    target_id: " T_SB_1 ",
                    new_state: "paused",
                  },
                ],
              },
            ],
          },
        },
      }),
      "B0TEST12345"
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      const plans = result.value.experiment.scope.bulkgen_plans ?? [];
      const spPlan = plans.find((plan) => plan.channel === "SP");
      const sbPlan = plans.find((plan) => plan.channel === "SB");
      expect(spPlan).toBeTruthy();
      expect(sbPlan).toBeTruthy();

      const spAdGroupAction = spPlan?.actions[0] as
        | { campaign_id?: string; ad_group_id?: string }
        | undefined;
      const spTargetAction = spPlan?.actions[1] as
        | { campaign_id?: string; ad_group_id?: string; target_id?: string }
        | undefined;
      const sbAdGroupAction = sbPlan?.actions[0] as
        | { campaign_id?: string; ad_group_id?: string }
        | undefined;
      const sbTargetAction = sbPlan?.actions[1] as
        | { campaign_id?: string; ad_group_id?: string; target_id?: string }
        | undefined;

      expect(spAdGroupAction?.campaign_id).toBe("C_SP_1");
      expect(spAdGroupAction?.ad_group_id).toBe("AG_SP_1");
      expect(spTargetAction?.campaign_id).toBe("C_SP_1");
      expect(spTargetAction?.ad_group_id).toBe("AG_SP_1");
      expect(spTargetAction?.target_id).toBe("T_SP_1");
      expect(sbAdGroupAction?.campaign_id).toBe("C_SB_1");
      expect(sbAdGroupAction?.ad_group_id).toBe("AG_SB_1");
      expect(sbTargetAction?.campaign_id).toBe("C_SB_1");
      expect(sbTargetAction?.ad_group_id).toBe("AG_SB_1");
      expect(sbTargetAction?.target_id).toBe("T_SB_1");
    }
  });

  it("omits optional parent IDs when empty strings are provided", () => {
    const result = parseProductExperimentOutputPack(
      JSON.stringify({
        kind: PRODUCT_EXPERIMENT_OUTPUT_PACK_KIND,
        product: { asin: "B0TEST12345" },
        experiment: {
          name: "Identity chain empty IDs",
          objective: "Keep compatibility",
          scope: {
            status: "planned",
            bulkgen_plans: [
              {
                channel: "SP",
                generator: "bulkgen:sp:update",
                run_id: "exp-sp-empty-parent-ids",
                actions: [
                  {
                    type: "update_target_state",
                    campaign_id: " ",
                    ad_group_id: "",
                    target_id: "T_SP_2",
                    new_state: "paused",
                  },
                ],
              },
            ],
          },
        },
      }),
      "B0TEST12345"
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      const action = (result.value.experiment.scope.bulkgen_plans?.[0]?.actions?.[0] ?? {}) as Record<
        string,
        unknown
      >;
      expect(action.target_id).toBe("T_SP_2");
      expect("campaign_id" in action).toBe(false);
      expect("ad_group_id" in action).toBe(false);
    }
  });

  it('accepts optional kiv_items payload', () => {
    const result = parseProductExperimentOutputPack(
      JSON.stringify({
        kind: PRODUCT_EXPERIMENT_OUTPUT_PACK_KIND,
        product: { asin: 'B0TEST12345' },
        experiment: {
          name: 'Budget test',
          objective: 'Grow sales',
          scope: { status: 'planned' },
        },
        kiv_items: [
          {
            title: 'Investigate broad match expansion',
            details: 'Needs ranking guardrails first',
            tags: ['ranking', 'sp'],
            priority: 2,
            due_date: '2026-03-01',
          },
        ],
      }),
      'B0TEST12345'
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.kiv_items).toHaveLength(1);
      expect(result.value.kiv_items[0].title).toContain('Investigate broad match');
    }
  });

  it('accepts contract metadata under experiment.scope.contract.ads_optimization_v1', () => {
    const result = parseProductExperimentOutputPack(
      JSON.stringify({
        kind: PRODUCT_EXPERIMENT_OUTPUT_PACK_KIND,
        product: { asin: 'B0TEST12345' },
        experiment: {
          name: 'Budget test',
          objective: 'Grow sales',
          scope: {
            status: 'planned',
            contract: {
              ads_optimization_v1: {
                baseline_ref: {
                  data_available_through: '2026-02-20',
                },
                forecast: {
                  window_days: 14,
                  directional_kpis: [
                    { kpi: 'spend', direction: 'up' },
                    { kpi: 'acos', direction: 'down' },
                  ],
                  assumptions: ['seasonality stable'],
                },
                ai_run_meta: {
                  model: 'gpt-test',
                },
                extra_key_for_forward_compat: true,
              },
            },
          },
        },
      }),
      'B0TEST12345'
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      const scope = result.value.experiment.scope as {
        contract?: { ads_optimization_v1?: Record<string, unknown> };
      };
      const contract = scope.contract?.ads_optimization_v1;
      expect(contract).toBeTruthy();
      expect(contract?.baseline_ref).toEqual({
        data_available_through: '2026-02-20',
      });
      expect(contract?.ai_run_meta).toMatchObject({
        workflow_mode: 'manual',
        model: 'gpt-test',
      });
      expect(contract?.extra_key_for_forward_compat).toBe(true);
    }
  });
});
