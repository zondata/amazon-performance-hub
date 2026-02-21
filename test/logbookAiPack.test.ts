import { describe, expect, it } from 'vitest';

import {
  LOGBOOK_AI_PACK_VERSION,
  extractOutcomeScore,
  parseLogbookAiPack,
} from '../apps/web/src/lib/logbook/aiPack/parseLogbookAiPack';

describe('logbook AI pack parser', () => {
  it('rejects invalid JSON, missing pack_version, and missing kind', () => {
    const invalidJson = parseLogbookAiPack('{', 'B0TEST1234');
    expect(invalidJson.ok).toBe(false);

    const missingPackVersion = parseLogbookAiPack(
      JSON.stringify({
        kind: 'experiment',
        product: { asin: 'B0TEST1234' },
        experiment: {
          name: 'n',
          objective: 'o',
          scope: { status: 'active', start_date: '2026-02-01', end_date: '2026-02-07' },
        },
      }),
      'B0TEST1234'
    );
    expect(missingPackVersion.ok).toBe(false);

    const missingKind = parseLogbookAiPack(
      JSON.stringify({
        pack_version: LOGBOOK_AI_PACK_VERSION,
        product: { asin: 'B0TEST1234' },
      }),
      'B0TEST1234'
    );
    expect(missingKind.ok).toBe(false);
  });

  it('rejects mismatched product asin', () => {
    const result = parseLogbookAiPack(
      JSON.stringify({
        pack_version: LOGBOOK_AI_PACK_VERSION,
        kind: 'experiment',
        product: { asin: 'B0OTHER0000' },
        experiment: {
          name: 'Budget Test',
          objective: 'Grow sales',
          scope: { status: 'active', start_date: '2026-02-01', end_date: '2026-02-07' },
        },
      }),
      'B0TEST1234'
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/must match page ASIN/i);
    }
  });

  it('normalizes asin to uppercase', () => {
    const result = parseLogbookAiPack(
      JSON.stringify({
        pack_version: LOGBOOK_AI_PACK_VERSION,
        kind: 'experiment',
        product: { asin: 'b0test1234' },
        experiment: {
          name: 'Budget Test',
          objective: 'Grow sales',
          scope: { status: 'active', start_date: '2026-02-01', end_date: '2026-02-07' },
        },
      }),
      'B0TEST1234'
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.product_asin).toBe('B0TEST1234');
      expect(result.value.kind).toBe('experiment');
      if (result.value.kind === 'experiment') {
        const scope = result.value.experiment.scope as { product_id?: string };
        expect(scope.product_id).toBe('B0TEST1234');
      }
    }
  });

  it('validates required fields by kind', () => {
    const badExperiment = parseLogbookAiPack(
      JSON.stringify({
        pack_version: LOGBOOK_AI_PACK_VERSION,
        kind: 'experiment',
        product: { asin: 'B0TEST1234' },
        experiment: {
          objective: 'Grow sales',
          scope: { status: 'active', start_date: '2026-02-01', end_date: '2026-02-07' },
        },
      }),
      'B0TEST1234'
    );
    expect(badExperiment.ok).toBe(false);

    const badChange = parseLogbookAiPack(
      JSON.stringify({
        pack_version: LOGBOOK_AI_PACK_VERSION,
        kind: 'change',
        product: { asin: 'B0TEST1234' },
        change: {
          change_type: 'budget_update',
          summary: 'Raised budget',
          occurred_at: '2026-02-01T12:00:00Z',
        },
      }),
      'B0TEST1234'
    );
    expect(badChange.ok).toBe(false);

    const badEvaluation = parseLogbookAiPack(
      JSON.stringify({
        pack_version: LOGBOOK_AI_PACK_VERSION,
        kind: 'evaluation',
        product: { asin: 'B0TEST1234' },
        evaluation: {
          experiment_dedupe_key: 'exp-123',
          metrics_json: { outcome: {} },
        },
      }),
      'B0TEST1234'
    );
    expect(badEvaluation.ok).toBe(false);
  });

  it('derives outcome score from evaluation.metrics_json.outcome.score', () => {
    expect(extractOutcomeScore({ outcome: { score: 0.72 } })).toBe(0.72);
    expect(extractOutcomeScore({ outcome: { score: '84' } })).toBe(84);
    expect(extractOutcomeScore({ outcome: {} })).toBeNull();
  });
});
