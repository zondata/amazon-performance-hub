import { getExperimentContext } from '@/lib/logbook/getExperimentContext';
import { EXPERIMENT_EVALUATION_OUTPUT_PACK_KIND } from '@/lib/logbook/aiPack/parseExperimentEvaluationOutputPack';

export const dynamic = 'force-dynamic';

const sanitizeFileSegment = (value: string): string => {
  const cleaned = value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]+/g, '');
  return cleaned.length > 0 ? cleaned.slice(0, 80) : 'experiment';
};

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const experimentId = id?.trim();

  if (!experimentId) {
    return new Response('Missing experiment id.', { status: 400 });
  }

  let context;
  try {
    context = await getExperimentContext(experimentId);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Failed to load experiment.', {
      status: 500,
    });
  }

  const asin = context.product_asin ?? 'UNKNOWN_ASIN';

  const content = `# Experiment Evaluation Prompt Pack

You are evaluating an Amazon experiment outcome.

## Experiment Inputs
- experiment_id: ${context.experiment.experiment_id}
- product.asin: ${asin}
- objective: ${context.experiment.objective}
- expected_outcome: ${context.expected_outcome ?? 'not provided'}
- guardrails: ${JSON.stringify(context.experiment.guardrails ?? {}, null, 0)}

## Task
1. Evaluate actual KPI deltas against expected outcome and guardrails.
2. Produce a concise, evidence-based summary.
3. Score the result 0-100 with confidence 0-1.
4. Propose next steps that are executable and ID-safe.
5. Respect resolved skills, driver campaign intents, and current KIV backlog context from the evaluation data pack.
6. Keep immediate execution small and express deferred work in \`evaluation.kiv_updates\`.

## Hard Rules
- Do not invent IDs or dates.
- Return strict JSON only. No markdown, no prose, no code fences.
- If required data is missing, return JSON with \`ok=false\` and \`questions\`.

## Required Success Schema
\`\`\`json
{
  "kind": "${EXPERIMENT_EVALUATION_OUTPUT_PACK_KIND}",
  "experiment_id": "${context.experiment.experiment_id}",
  "product": { "asin": "${asin}" },
  "evaluation": {
    "summary": "string",
    "outcome": {
      "score": 0,
      "label": "success",
      "confidence": 0,
      "tags": ["string"]
    },
    "why": ["string"],
    "next_steps": ["string"],
    "notes": "optional string",
    "kiv_updates": [
      {
        "kiv_id": "optional uuid",
        "title": "optional string (required when kiv_id is missing)",
        "status": "open | done | dismissed",
        "resolution_notes": "optional string"
      }
    ]
  }
}
\`\`\`

## Missing-Data Schema
\`\`\`json
{
  "kind": "${EXPERIMENT_EVALUATION_OUTPUT_PACK_KIND}",
  "experiment_id": "${context.experiment.experiment_id}",
  "product": { "asin": "${asin}" },
  "ok": false,
  "questions": ["what is missing and why"]
}
\`\`\`
`;

  const filename = `${sanitizeFileSegment(context.experiment.name)}_${context.experiment.experiment_id}_ai_eval_prompt.md`;

  return new Response(content, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
}
