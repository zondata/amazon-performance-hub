import { PRODUCT_EXPERIMENT_OUTPUT_PACK_KIND } from './aiPack/parseProductExperimentOutputPack';

type RenderProductExperimentPromptPackInput = {
  asin: string;
  template: {
    id: string;
    name: string;
    instructions_md: string;
  };
};

export const renderProductExperimentPromptPackMarkdown = ({
  asin: rawAsin,
  template,
}: RenderProductExperimentPromptPackInput): string => {
  const asin = rawAsin.trim().toUpperCase();
  const lines: string[] = [];

  lines.push('# Amazon Performance Hub - Product Experiment Prompt Pack');
  lines.push('');
  lines.push(`You are preparing a product logbook experiment output pack for ASIN **${asin}**.`);
  lines.push('');

  lines.push('## Template');
  lines.push(`- ID: ${template.id}`);
  lines.push(`- Name: ${template.name}`);
  lines.push('');

  lines.push('## Assistant Instructions');
  if (template.instructions_md.trim().length > 0) {
    lines.push(template.instructions_md);
  } else {
    lines.push('- (none)');
  }
  lines.push('');

  lines.push('## Rules');
  lines.push('1. Use IDs only from the Product Baseline Data Pack. Never invent IDs.');
  lines.push('2. If required fields are missing from the data pack, ask clarifying questions first.');
  lines.push('3. The final answer must be JSON only (no markdown/code fences/prose).');
  lines.push('4. Output exactly one JSON object that matches the schema below.');
  lines.push('5. For each ads plan, include a deterministic `run_id`.');
  lines.push('6. Include SP and/or SB plans only when supported by available IDs.');
  lines.push('');

  lines.push('## Required Top-Level Schema');
  lines.push('```json');
  lines.push('{');
  lines.push(`  "kind": "${PRODUCT_EXPERIMENT_OUTPUT_PACK_KIND}",`);
  lines.push(`  "product": { "asin": "${asin}" },`);
  lines.push('  "experiment": {');
  lines.push('    "name": "string (required)",');
  lines.push('    "objective": "string (required)",');
  lines.push('    "hypothesis": "string (optional)",');
  lines.push('    "evaluation_lag_days": 2,');
  lines.push('    "evaluation_window_days": 14,');
  lines.push('    "primary_metrics": {},');
  lines.push('    "guardrails": {},');
  lines.push('    "scope": {');
  lines.push('      "status": "planned",');
  lines.push(`      "product_id": "${asin}",`);
  lines.push('      "tags": ["ads", "sp", "sb"],');
  lines.push('      "expected_outcome": "string (optional)",');
  lines.push('      "contract": {');
  lines.push('        "ads_optimization_v1": {');
  lines.push('          "baseline_ref": { "data_available_through": "YYYY-MM-DD" },');
  lines.push('          "forecast": {');
  lines.push('            "directional_kpis": [{ "kpi": "spend", "direction": "up" }],');
  lines.push('            "window_days": 14,');
  lines.push('            "lag_days": 2,');
  lines.push('            "assumptions": ["optional"],');
  lines.push('            "confidence": 0.6');
  lines.push('          },');
  lines.push('          "ai_run_meta": {');
  lines.push('            "workflow_mode": "manual",');
  lines.push('            "prompt_template_id": "string",');
  lines.push('            "model": "unknown",');
  lines.push('            "run_at": null');
  lines.push('          }');
  lines.push('        }');
  lines.push('      },');
  lines.push('      "bulkgen_plans": [');
  lines.push('        {');
  lines.push('          "channel": "SP",');
  lines.push('          "generator": "bulkgen:sp:update",');
  lines.push(`          "run_id": "exp-${asin.toLowerCase()}-sp-001",`);
  lines.push('          "notes": "optional",');
  lines.push('          "actions": [');
  lines.push('            {');
  lines.push('              "type": "update_target_bid",');
  lines.push('              "campaign_id": "1234567890",');
  lines.push('              "ad_group_id": "2233445566",');
  lines.push('              "target_id": "9876543210",');
  lines.push('              "new_bid": 1.15');
  lines.push('            }');
  lines.push('          ]');
  lines.push('        },');
  lines.push('        {');
  lines.push('          "channel": "SB",');
  lines.push('          "generator": "bulkgen:sb:update",');
  lines.push(`          "run_id": "exp-${asin.toLowerCase()}-sb-001",`);
  lines.push('          "notes": "optional",');
  lines.push('          "actions": [');
  lines.push('            {');
  lines.push('              "type": "update_campaign_budget",');
  lines.push('              "campaign_id": "1234567890",');
  lines.push('              "new_budget": 25');
  lines.push('            }');
  lines.push('          ]');
  lines.push('        }');
  lines.push('      ]');
  lines.push('    }');
  lines.push('  },');
  lines.push('  "manual_changes": [');
  lines.push('    {');
  lines.push('      "channel": "listing",');
  lines.push('      "change_type": "title_update",');
  lines.push('      "summary": "string",');
  lines.push('      "why": "optional",');
  lines.push('      "entities": [');
  lines.push(`        { "entity_type": "product", "product_id": "${asin}" }`);
  lines.push('      ]');
  lines.push('    }');
  lines.push('  ],');
  lines.push('  "kiv_items": [');
  lines.push('    {');
  lines.push('      "title": "string (required)",');
  lines.push('      "details": "optional string",');
  lines.push('      "tags": ["optional", "tags"],');
  lines.push('      "priority": 1,');
  lines.push('      "due_date": "YYYY-MM-DD"');
  lines.push('    }');
  lines.push('  ]');
  lines.push('}');
  lines.push('```');
  lines.push('');

  lines.push('## Action Schema Notes');
  lines.push('- SP plan actions must match SP update action contracts.');
  lines.push('- SB plan actions must match SB update action contracts.');
  lines.push('- Identity chain requirements (for review rendering):');
  lines.push('  - Campaign actions: `campaign_id`');
  lines.push('  - Ad group actions: `campaign_id` + `ad_group_id`');
  lines.push('  - Target actions: `campaign_id` + `ad_group_id` + `target_id` (if ad_group_id exists for that channel; otherwise `campaign_id` + `target_id`)');
  lines.push('- When generating bulkgen actions, include the full parent identity chain required for rendering.');
  lines.push('- Placement updates must include placement identity fields needed by the generator:');
  lines.push('  - SP: `campaign_id`, `placement_code`, `new_pct`');
  lines.push('  - SB: `campaign_id` and at least one of `placement_raw` or `placement_code`, plus `new_pct`');
  lines.push('');

  lines.push('## Data Coverage Checklist');
  lines.push('- If proposing SP/SB bulkgen plans, confirm campaign/target IDs exist in the Product Baseline Data Pack; otherwise ask clarifying questions.');
  lines.push('- If recommending keyword/query strategy, confirm SQP/ranking sections exist; otherwise ask clarifying questions.');
  lines.push('- If recommending pricing/coupons, confirm profits/margin/cogs fields exist; otherwise ask clarifying questions.');
  lines.push('- Respect `product.driver_campaign_intents` and skill constraints in the data pack when proposing campaign actions.');
  lines.push('- Keep execution set small and place remaining ideas into `kiv_items`.');
  lines.push('- Re-rank and revisit the top 3 existing `product.kiv_backlog` items before adding net-new KIV entries.');
  lines.push('');

  lines.push('## Validation Checklist Before Final JSON');
  lines.push(`- \`product.asin\` exactly equals \`${asin}\``);
  lines.push('- `experiment.name` and `experiment.objective` are present');
  lines.push('- Every bulkgen plan has `channel`, `generator`, `run_id`, and non-empty `actions`');
  lines.push('- IDs in actions appear in the data pack campaign/target/ad-group lists');
  lines.push('- No unknown keys outside the documented structure');

  return lines.join('\n');
};
