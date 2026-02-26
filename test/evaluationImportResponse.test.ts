import { describe, expect, it } from 'vitest';

import { normalizeEvaluationImportSuccess } from '../apps/web/src/lib/logbook/aiPack/evaluationImportResponse';

describe('normalizeEvaluationImportSuccess', () => {
  it('fills missing summary fields with deterministic defaults', () => {
    const normalized = normalizeEvaluationImportSuccess({
      ok: true,
      experiment_id: 'exp_1',
      evaluation_id: 'eval_1',
    });

    expect(normalized.ok).toBe(true);
    expect(normalized.warnings).toEqual([]);
    expect(normalized.applied).toEqual({
      kiv: {
        created: 0,
        updated: 0,
        status_changed: 0,
        matched_by_id: 0,
        matched_by_title: 0,
      },
      events: {
        created: 0,
      },
      memory: {
        updated: false,
      },
    });
  });

  it('preserves provided applied counters and warning list', () => {
    const normalized = normalizeEvaluationImportSuccess({
      ok: true,
      experiment_id: 'exp_2',
      evaluation_id: 'eval_2',
      warnings: ['one warning'],
      applied: {
        kiv: {
          created: 2,
          updated: 3,
          status_changed: 1,
          matched_by_id: 1,
          matched_by_title: 2,
        },
        events: {
          created: 4,
        },
        memory: {
          updated: true,
        },
      },
    });

    expect(normalized.warnings).toEqual(['one warning']);
    expect(normalized.applied.kiv.created).toBe(2);
    expect(normalized.applied.kiv.updated).toBe(3);
    expect(normalized.applied.events.created).toBe(4);
    expect(normalized.applied.memory.updated).toBe(true);
  });

  it('throws when called with a failure payload', () => {
    expect(() =>
      normalizeEvaluationImportSuccess({
        ok: false,
        error: 'invalid',
      })
    ).toThrow('normalizeEvaluationImportSuccess expects a successful result.');
  });
});
