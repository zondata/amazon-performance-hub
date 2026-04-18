import {
  InMemoryIngestionJobRepository,
  IngestionJobRunner,
  IngestionJobRunnerError,
  createStubIngestionExecutor,
} from './jobRunner';
import { IngestionBackfillRunner } from './backfillRunner';
import {
  getIngestionStateEnvelopeFromJob,
  getIngestionStateEnvelopeFromWatermark,
  summarizeIngestionStateEnvelope,
} from './stateEnvelope';

const parseCliArgs = (argv: string[]) => {
  let scenario = 'success';

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--scenario') {
      scenario = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg.startsWith('--scenario=')) {
      scenario = arg.slice('--scenario='.length);
      continue;
    }

    throw new IngestionJobRunnerError(
      'invalid_request',
      `Unknown CLI argument: ${arg}`
    );
  }

  if (!['success', 'failed'].includes(scenario)) {
    throw new IngestionJobRunnerError(
      'invalid_request',
      `Unsupported scenario: ${scenario}`
    );
  }

  return {
    scenario: scenario as 'success' | 'failed',
  };
};

export const summarizeStateEnvelopeScenario = (args: {
  scenario: 'success' | 'failed';
  lines: string[];
  executorCallCount: number;
}): string =>
  [
    'Stage 3 ingestion state-envelope stub scenario completed.',
    `Scenario: ${args.scenario}`,
    ...args.lines,
    `Executor call count: ${args.executorCallCount}`,
  ].join('\n');

export async function runStateEnvelopeStubScenario(
  scenario: 'success' | 'failed'
): Promise<{
  lines: string[];
  executorCallCount: number;
}> {
  const repository = new InMemoryIngestionJobRepository();
  const stub =
    scenario === 'success'
      ? createStubIngestionExecutor([
          {
            outcome: 'success',
            rowCount: 11,
            checksum: 'state-envelope-success',
          },
        ])
      : createStubIngestionExecutor([
          {
            outcome: 'failure',
            errorCode: 'state_envelope_failure',
            errorMessage: 'Deterministic failed state scenario',
          },
        ]);

  let nowIndex = 0;
  const nowValues = [
    '2026-04-18T00:00:00.000Z',
    '2026-04-18T00:00:01.000Z',
    '2026-04-18T00:00:02.000Z',
    '2026-04-18T00:00:03.000Z',
    '2026-04-18T00:00:04.000Z',
    '2026-04-18T00:00:05.000Z',
    '2026-04-18T00:00:06.000Z',
    '2026-04-18T00:00:07.000Z',
  ];
  let jobIdIndex = 0;

  const runner = new IngestionJobRunner({
    repository,
    executor: stub.executor,
    now: () => nowValues[Math.min(nowIndex++, nowValues.length - 1)],
    createJobId: () => `job-${String(++jobIdIndex).padStart(3, '0')}`,
  });

  if (scenario === 'success') {
    const result = await runner.submitJob({
      jobKey: 'demo_state_envelope_job',
      sourceName: 'stub_source',
      accountId: 'demo-account',
      marketplace: 'US',
      sourceWindowStart: '2026-04-10T00:00:00.000Z',
      sourceWindowEnd: '2026-04-10T23:59:59.999Z',
      idempotencyKey: 'demo:state-envelope:success',
      runKind: 'manual',
      scopeKey: 'demo-scope',
      metadata: {
        state_hints: {
          freshnessState: 'daily',
          finalizationState: 'final',
          sourceConfidence: 'high',
        },
      },
    });

    return {
      lines: [
        `job_status=${result.job.processing_status}`,
        `job_envelope=${summarizeIngestionStateEnvelope(
          getIngestionStateEnvelopeFromJob(result.job)
        )}`,
        `watermark_envelope=${summarizeIngestionStateEnvelope(
          getIngestionStateEnvelopeFromWatermark(result.watermark!)!
        )}`,
      ],
      executorCallCount: stub.getCallCount(),
    };
  }

  const backfill = new IngestionBackfillRunner({
    repository,
    jobRunner: runner,
  });
  const result = await backfill.runBackfill({
    jobKey: 'demo_state_envelope_backfill',
    sourceName: 'stub_source',
    accountId: 'demo-account',
    marketplace: 'US',
    rangeStart: '2026-04-01',
    rangeEnd: '2026-04-07',
    sliceUnit: 'week',
    sliceSize: 1,
    runKind: 'manual',
    scopeKey: 'demo-scope',
  });

  return {
    lines: [
      `slice_action=${result.sliceResults[0].action}`,
      `slice_status=${result.sliceResults[0].finalObservedJobStatus}`,
      `slice_envelope=${summarizeIngestionStateEnvelope(
        result.sliceResults[0].stateEnvelope
      )}`,
    ],
    executorCallCount: stub.getCallCount(),
  };
}

async function main(): Promise<void> {
  try {
    const args = parseCliArgs(process.argv.slice(2));
    const result = await runStateEnvelopeStubScenario(args.scenario);

    console.log(
      summarizeStateEnvelopeScenario({
        scenario: args.scenario,
        lines: result.lines,
        executorCallCount: result.executorCallCount,
      })
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Stage 3 state-envelope CLI failed: ${error.message}`);
    } else {
      console.error('Stage 3 state-envelope CLI failed due to an unknown error.');
    }

    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
