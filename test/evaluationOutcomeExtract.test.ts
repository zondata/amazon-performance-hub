import { describe, expect, it } from 'vitest';

import { extractEvaluationOutcome } from '../apps/web/src/lib/logbook/evaluationOutcomeExtract';

describe('extractEvaluationOutcome', () => {
  it('extracts score/label/summary/next_steps correctly', () => {
    const result = extractEvaluationOutcome({
      outcome: {
        score: 82,
        label: 'success',
      },
      summary: '  Sales increased with stable TACoS.  ',
      next_steps: '  Scale budgets carefully.  ',
    });

    expect(result).toEqual({
      score: 82,
      label: 'success',
      summary: 'Sales increased with stable TACoS.',
      next_steps: 'Scale budgets carefully.',
    });
  });

  it('returns nulls for invalid shapes', () => {
    expect(extractEvaluationOutcome(null)).toEqual({
      score: null,
      label: null,
      summary: null,
      next_steps: null,
    });

    expect(
      extractEvaluationOutcome({
        outcome: {
          score: 'not-a-number',
          label: 'great',
        },
        summary: 123,
        next_steps: ['scale'],
      })
    ).toEqual({
      score: null,
      label: null,
      summary: null,
      next_steps: null,
    });
  });
});
