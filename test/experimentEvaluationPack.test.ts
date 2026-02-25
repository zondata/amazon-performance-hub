import { describe, expect, it } from 'vitest';

import {
  EXPERIMENT_EVALUATION_OUTPUT_PACK_KIND,
  parseExperimentEvaluationOutputPack,
} from '../apps/web/src/lib/logbook/aiPack/parseExperimentEvaluationOutputPack';

describe('experiment evaluation output pack parser', () => {
  it('rejects missing required fields', () => {
    const result = parseExperimentEvaluationOutputPack(
      JSON.stringify({
        kind: EXPERIMENT_EVALUATION_OUTPUT_PACK_KIND,
        experiment_id: '11111111-1111-1111-1111-111111111111',
        product: { asin: 'B0TEST12345' },
        evaluation: {
          outcome: { score: 88, label: 'success', confidence: 0.7, tags: ['growth'] },
        },
      })
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/evaluation\.summary/i);
    }
  });

  it('rejects ASIN mismatch', () => {
    const result = parseExperimentEvaluationOutputPack(
      JSON.stringify({
        kind: EXPERIMENT_EVALUATION_OUTPUT_PACK_KIND,
        experiment_id: '11111111-1111-1111-1111-111111111111',
        product: { asin: 'B0OTHER0000' },
        evaluation: {
          summary: 'Good test',
          outcome: { score: 81, label: 'success', confidence: 0.82, tags: ['stable'] },
          why: ['Sales up'],
          next_steps: ['Scale winners'],
        },
      }),
      { expectedAsin: 'B0TEST12345' }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/must match expected ASIN/i);
    }
  });

  it('accepts optional kiv_updates payload', () => {
    const result = parseExperimentEvaluationOutputPack(
      JSON.stringify({
        kind: EXPERIMENT_EVALUATION_OUTPUT_PACK_KIND,
        experiment_id: '11111111-1111-1111-1111-111111111111',
        product: { asin: 'B0TEST12345' },
        evaluation: {
          summary: 'Good test',
          outcome: { score: 81, label: 'success', confidence: 0.82, tags: ['stable'] },
          why: ['Sales up'],
          next_steps: ['Scale winners'],
          kiv_updates: [
            {
              title: 'Retest hero creative',
              status: 'open',
            },
          ],
        },
      }),
      { expectedAsin: 'B0TEST12345' }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.evaluation.kiv_updates).toHaveLength(1);
      expect(result.value.evaluation.kiv_updates[0].status).toBe('open');
    }
  });
});
