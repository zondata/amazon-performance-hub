import { describe, expect, it } from 'vitest';

import {
  runStateEnvelopeStubScenario,
  summarizeStateEnvelopeScenario,
} from './stateEnvelopeCli';

describe('Stage 3 ingestion state-envelope CLI summary', () => {
  it('prints a safe deterministic success state-envelope summary', async () => {
    const result = await runStateEnvelopeStubScenario('success');
    const summary = summarizeStateEnvelopeScenario({
      scenario: 'success',
      lines: result.lines,
      executorCallCount: result.executorCallCount,
    });

    expect(summary).toContain('Scenario: success');
    expect(summary).toContain('job_status=available');
    expect(summary).toContain('"freshnessState":"daily"');
    expect(summary).toContain('"finalizationState":"final"');
    expect(summary).toContain('"sourceConfidence":"high"');
    expect(summary).not.toContain('refresh_token');
    expect(summary).not.toContain('secret');
  });

  it('prints a safe deterministic failed state-envelope summary', async () => {
    const result = await runStateEnvelopeStubScenario('failed');
    const summary = summarizeStateEnvelopeScenario({
      scenario: 'failed',
      lines: result.lines,
      executorCallCount: result.executorCallCount,
    });

    expect(summary).toContain('Scenario: failed');
    expect(summary).toContain('slice_status=failed');
    expect(summary).toContain('"freshnessState":"weekly"');
    expect(summary).toContain('"finalizationState":"partial_period"');
    expect(summary).toContain('"sourceConfidence":"unknown"');
    expect(summary).not.toContain('unknown error');
  });
});
