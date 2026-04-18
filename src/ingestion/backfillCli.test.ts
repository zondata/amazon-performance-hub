import { describe, expect, it } from 'vitest';

import {
  runBackfillStubScenario,
  summarizeBackfillScenario,
} from './backfillCli';

describe('Stage 3 ingestion backfill CLI summary', () => {
  it('prints a safe deterministic success summary', async () => {
    const result = await runBackfillStubScenario('success');
    const summary = summarizeBackfillScenario({
      scenario: 'success',
      first: result.first,
      followUp: result.followUp,
      executorCallCount: result.executorCallCount,
    });

    expect(summary).toContain('Scenario: success');
    expect(summary).toContain('"created":3');
    expect(summary).toContain('slice=2026-04-01->2026-04-01 action=created');
    expect(summary).toContain('status=available');
    expect(summary).not.toContain('refresh_token');
    expect(summary).not.toContain('secret');
  });

  it('prints a safe deterministic failed-only rerun summary', async () => {
    const result = await runBackfillStubScenario('failed-only-rerun');
    const summary = summarizeBackfillScenario({
      scenario: 'failed-only-rerun',
      first: result.first,
      followUp: result.followUp,
      executorCallCount: result.executorCallCount,
    });

    expect(summary).toContain('Scenario: failed-only-rerun');
    expect(summary).toContain('"rerun_failed":1');
    expect(summary).toContain('"skipped_available":2');
    expect(summary).toContain('action=rerun_failed');
    expect(summary).toContain('Executor call count: 4');
    expect(summary).not.toContain('unknown error');
  });
});
