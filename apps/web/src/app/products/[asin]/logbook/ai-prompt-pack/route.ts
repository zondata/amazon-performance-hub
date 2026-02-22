import { PRODUCT_EXPERIMENT_OUTPUT_PACK_KIND } from "@/lib/logbook/aiPack/parseProductExperimentOutputPack";

export const dynamic = "force-dynamic";

const sanitizeFileSegment = (value: string): string =>
  value
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]+/g, "")
    .slice(0, 80);

type Ctx = { params: Promise<{ asin: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { asin: rawAsin } = await params;
  const asin = (rawAsin ?? "").trim().toUpperCase();
  if (!asin) {
    return new Response("Missing ASIN param.", { status: 400 });
  }

  const content = `# Amazon Performance Hub - Product Experiment Prompt Pack

You are preparing a product logbook experiment output pack for ASIN **${asin}**.

## Rules
1. Use IDs only from the Product Baseline Data Pack. Never invent IDs.
2. If required fields are missing from the data pack, ask clarifying questions first.
3. Return JSON only (no markdown/code fences/prose).
4. Output exactly one JSON object that matches the schema below.
5. For each ads plan, include a deterministic \`run_id\`.
6. Include SP and/or SB plans only when supported by available IDs.

## Required Top-Level Schema
\`\`\`json
{
  "kind": "${PRODUCT_EXPERIMENT_OUTPUT_PACK_KIND}",
  "product": { "asin": "${asin}" },
  "experiment": {
    "name": "string (required)",
    "objective": "string (required)",
    "hypothesis": "string (optional)",
    "evaluation_lag_days": 2,
    "evaluation_window_days": 14,
    "primary_metrics": {},
    "guardrails": {},
    "scope": {
      "status": "planned",
      "product_id": "${asin}",
      "tags": ["ads", "sp", "sb"],
      "expected_outcome": {},
      "bulkgen_plans": [
        {
          "channel": "SP",
          "generator": "bulkgen:sp:update",
          "run_id": "exp-${asin.toLowerCase()}-sp-001",
          "notes": "optional",
          "actions": []
        },
        {
          "channel": "SB",
          "generator": "bulkgen:sb:update",
          "run_id": "exp-${asin.toLowerCase()}-sb-001",
          "notes": "optional",
          "actions": []
        }
      ]
    }
  },
  "manual_changes": [
    {
      "channel": "listing",
      "change_type": "title_update",
      "summary": "string",
      "why": "optional",
      "entities": [
        { "entity_type": "product", "product_id": "${asin}" }
      ]
    }
  ]
}
\`\`\`

## Action Schema Notes
- SP plan actions must match SP update action contracts.
- SB plan actions must match SB update action contracts.
- Placement updates must include placement identity fields needed by the generator:
  - SP: \`campaign_id\`, \`placement_code\`, \`new_pct\`
  - SB: \`campaign_id\` and at least one of \`placement_raw\` or \`placement_code\`, plus \`new_pct\`

## Data Coverage Checklist
- If proposing SP/SB bulkgen plans, confirm campaign/target IDs exist in the Product Baseline Data Pack; otherwise ask clarifying questions.
- If recommending keyword/query strategy, confirm SQP/ranking sections exist; otherwise ask clarifying questions.
- If recommending pricing/coupons, confirm profits/margin/cogs fields exist; otherwise ask clarifying questions.

## Validation Checklist Before Final JSON
- \`product.asin\` exactly equals \`${asin}\`
- \`experiment.name\` and \`experiment.objective\` are present
- Every bulkgen plan has \`channel\`, \`generator\`, \`run_id\`, and non-empty \`actions\`
- IDs in actions appear in the data pack campaign/target/ad-group lists
- No unknown keys outside the documented structure
`;

  const filename = `${sanitizeFileSegment(asin)}_product_experiment_prompt_pack.md`;
  return new Response(content, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
