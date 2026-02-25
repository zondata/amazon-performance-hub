import { describe, expect, it } from 'vitest';

import { buildRollbackOutputPack } from '../apps/web/src/lib/logbook/rollbackPlan';

describe('buildRollbackOutputPack', () => {
  it('reverses a structured SP bid update using before_json', () => {
    const pack = buildRollbackOutputPack({
      experiment: {
        experiment_id: '11111111-1111-1111-1111-111111111111',
        asin: 'B0TEST12345',
        marketplace: 'US',
      },
      changes: [
        {
          change_id: 'chg-1',
          run_id: 'run-1',
          before_json: { bid: 1.2 },
          after_json: {
            generator: 'bulkgen:sp:update',
            dedupe_key: 'run-1::bulkgen:sp:update::Keyword::C1::AG1::T1::',
            run_id: 'run-1',
          },
          channel: 'ads',
          summary: 'SP target bid update',
        },
      ],
      targetRunId: 'run-1',
    });

    expect(pack.kind).toBe('experiment_output_pack');
    expect(pack.rollback.target_run_id).toBe('run-1');
    expect(pack.rollback.rollback_action_count).toBe(1);
    expect(pack.rollback.rollback_run_id.startsWith('rollback:')).toBe(true);
    expect(pack.bulkgen_plans.length).toBe(1);
    expect(pack.bulkgen_plans[0]?.channel).toBe('SP');
    expect(pack.bulkgen_plans[0]?.actions).toEqual([
      {
        type: 'update_target_bid',
        target_id: 'T1',
        new_bid: 1.2,
      },
    ]);
    expect(pack.warnings).toEqual([]);
  });

  it('emits warnings for non-rollable changes', () => {
    const pack = buildRollbackOutputPack({
      experiment: {
        experiment_id: '11111111-1111-1111-1111-111111111111',
        asin: 'B0TEST12345',
        marketplace: 'US',
      },
      changes: [
        {
          change_id: 'chg-2',
          run_id: 'run-2',
          before_json: null,
          after_json: { generator: 'bulkgen:sp:update' },
          channel: 'ads',
          summary: 'manual note',
        },
      ],
      targetRunId: 'run-2',
    });

    expect(pack.bulkgen_plans).toEqual([]);
    expect(pack.manual_changes).toEqual([]);
    expect(pack.warnings.some((warning) => warning.includes('change_id=chg-2'))).toBe(true);
  });
});
