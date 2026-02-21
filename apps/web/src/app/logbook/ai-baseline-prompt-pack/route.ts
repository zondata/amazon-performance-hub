import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

const sanitizeFileSegment = (value: string): string =>
  value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]+/g, '')
    .slice(0, 80);

export async function GET() {
  const generatedAt = new Date().toISOString();

  const content = `# Amazon Performance Hub - Account Baseline Prompt Pack

## Objective
Analyze the current account state and produce a prioritized experiment backlog.
Focus on the largest wins/losses visible in the baseline data pack and propose pragmatic tests.

Account: ${env.accountId}
Marketplace: ${env.marketplace}
Generated at: ${generatedAt}

## Required Output Format
Return a single markdown document with these sections:

1. Account Snapshot
- 5-10 bullet summary of current sales and ads posture.

2. Biggest Wins
- Top positive movers with evidence (metrics + why it likely happened).

3. Biggest Losses / Risks
- Top negative movers or instability risks with evidence.

4. Experiment Backlog (Prioritized)
- Provide 5-12 experiments with:
  - title
  - objective
  - hypothesis
  - channel (SP/SB/SD/non_ads)
  - target scope (ASIN/campaign/keyword)
  - expected impact
  - execution complexity (low/med/high)
  - confidence (0-1)
  - guardrails

5. 30-Day Execution Plan
- What to run first, in what order, and why.

## Missing Info Checklist (Required)
If data is insufficient for confident recommendations, include a section named:
"Missing Info Checklist"
List each missing field/data source and why it blocks decisions.

## JSON Appendix (Required)
Append a JSON code block with this shape:
\`\`\`json
{
  "summary": {
    "wins": [],
    "losses": [],
    "key_risks": []
  },
  "experiments": [
    {
      "priority": 1,
      "title": "",
      "objective": "",
      "hypothesis": "",
      "channel": "sp",
      "scope": {
        "product_id": null,
        "campaign_ids": [],
        "target_ids": []
      },
      "expected_impact": "",
      "complexity": "low",
      "confidence": 0.0,
      "guardrails": [],
      "missing_data_dependencies": []
    }
  ]
}
\`\`\`

## Constraints
- Do not invent IDs or facts.
- Reference only evidence present in the baseline data pack.
- Call out assumptions explicitly when needed.
- Keep recommendations deterministic and implementation-ready.
`;

  const filename = `${sanitizeFileSegment(env.accountId)}_${sanitizeFileSegment(env.marketplace)}_ai_baseline_prompt_pack.md`;
  return new Response(content, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
}
