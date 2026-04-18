import { describe, expect, it } from 'vitest';

import {
  runJobRunnerStubScenario,
  summarizeJobRunnerScenario,
} from './jobRunnerCli';

describe('Stage 3 ingestion job runner CLI summary', () => {
  it('prints a safe deterministic success summary', async () => {
    const result = await runJobRunnerStubScenario('success');
    const summary = summarizeJobRunnerScenario({
      scenario: 'success',
      first: result.first,
      followUp: result.followUp,
      executorCallCount: result.executorCallCount,
    });

    expect(summary).toContain('Scenario: success');
    expect(summary).toContain('result=created');
    expect(summary).toContain('status=available');
    expect(summary).toContain('checksum=stub-success-checksum');
    expect(summary).not.toContain('refresh_token');
    expect(summary).not.toContain('secret');
  });

  it('prints a safe deterministic retry summary', async () => {
    const result = await runJobRunnerStubScenario('retry');
    const summary = summarizeJobRunnerScenario({
      scenario: 'retry',
      first: result.first,
      followUp: result.followUp,
      executorCallCount: result.executorCallCount,
    });

    expect(summary).toContain('Scenario: retry');
    expect(summary).toContain('First run: result=created');
    expect(summary).toContain('status=failed');
    expect(summary).toContain('Follow-up run: result=retried');
    expect(summary).toContain('status=available');
    expect(summary).toContain('Executor call count: 2');
    expect(summary).not.toContain('unknown error');
  });
});

