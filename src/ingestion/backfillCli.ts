import {
  InMemoryIngestionJobRepository,
  IngestionJobRunner,
  IngestionJobRunnerError,
  createStubIngestionExecutor,
} from './jobRunner';
import {
  IngestionBackfillRunner,
  type IngestionBackfillRequest,
  type IngestionBackfillRunResult,
} from './backfillRunner';

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

  if (!['success', 'failed-only-rerun'].includes(scenario)) {
    throw new IngestionJobRunnerError(
      'invalid_request',
      `Unsupported scenario: ${scenario}`
    );
  }

  return {
    scenario: scenario as 'success' | 'failed-only-rerun',
  };
};

const buildDemoRequest = (
  rerunMode: 'none' | 'failed_only'
): IngestionBackfillRequest => ({
  jobKey: 'demo_backfill_job',
  sourceName: 'stub_source',
  accountId: 'demo-account',
  marketplace: 'US',
  rangeStart: '2026-04-01',
  rangeEnd: '2026-04-03',
  sliceUnit: 'day',
  sliceSize: 1,
  runKind: 'manual',
  scopeKey: 'demo-scope',
  baseMetadata: {
    demo: true,
  },
  rerunMode,
});

const formatRunSummary = (label: string, result: IngestionBackfillRunResult) =>
  [
    `${label}: slices=${result.plan.slices.length}`,
    `  actions=${JSON.stringify(result.actionCounts)}`,
    ...result.sliceResults.map(
      (sliceResult) =>
        `  slice=${sliceResult.slice.rangeStart}->${sliceResult.slice.rangeEnd} action=${sliceResult.action} job_id=${sliceResult.jobId} status=${sliceResult.finalObservedJobStatus} executor_invoked=${sliceResult.executorInvoked}`
    ),
  ].join('\n');

export const summarizeBackfillScenario = (args: {
  scenario: 'success' | 'failed-only-rerun';
  first: IngestionBackfillRunResult;
  followUp?: IngestionBackfillRunResult;
  executorCallCount: number;
}): string => {
  const lines = [
    'Stage 3 ingestion backfill stub scenario completed.',
    `Scenario: ${args.scenario}`,
    formatRunSummary('First run', args.first),
  ];

  if (args.followUp) {
    lines.push(formatRunSummary('Follow-up run', args.followUp));
  }

  lines.push(`Executor call count: ${args.executorCallCount}`);
  return lines.join('\n');
};

export async function runBackfillStubScenario(
  scenario: 'success' | 'failed-only-rerun'
): Promise<{
  first: IngestionBackfillRunResult;
  followUp?: IngestionBackfillRunResult;
  executorCallCount: number;
}> {
  const repository = new InMemoryIngestionJobRepository();
  const stub =
    scenario === 'success'
      ? createStubIngestionExecutor([
          {
            outcome: 'success',
            rowCount: 3,
            checksum: 'stub-backfill-success',
            retrievedAt: '2026-04-18T00:00:01.000Z',
          },
        ])
      : createStubIngestionExecutor([
          {
            outcome: 'success',
            rowCount: 3,
            checksum: 'stub-backfill-slice-1',
            retrievedAt: '2026-04-18T00:00:01.000Z',
          },
          {
            outcome: 'failure',
            errorCode: 'stub_backfill_failure',
            errorMessage: 'Deterministic slice failure',
          },
          {
            outcome: 'success',
            rowCount: 5,
            checksum: 'stub-backfill-rerun',
            retrievedAt: '2026-04-18T00:00:05.000Z',
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
    '2026-04-18T00:00:08.000Z',
    '2026-04-18T00:00:09.000Z',
    '2026-04-18T00:00:10.000Z',
    '2026-04-18T00:00:11.000Z',
    '2026-04-18T00:00:12.000Z',
    '2026-04-18T00:00:13.000Z',
    '2026-04-18T00:00:14.000Z',
  ];
  let jobIdIndex = 0;

  const runner = new IngestionJobRunner({
    repository,
    executor: stub.executor,
    now: () => nowValues[Math.min(nowIndex++, nowValues.length - 1)],
    createJobId: () => `job-${String(++jobIdIndex).padStart(3, '0')}`,
  });
  const backfill = new IngestionBackfillRunner({
    repository,
    jobRunner: runner,
  });

  const first = await backfill.runBackfill(buildDemoRequest('none'));

  if (scenario === 'failed-only-rerun') {
    return {
      first,
      followUp: await backfill.runBackfill(buildDemoRequest('failed_only')),
      executorCallCount: stub.getCallCount(),
    };
  }

  return {
    first,
    executorCallCount: stub.getCallCount(),
  };
}

async function main(): Promise<void> {
  try {
    const args = parseCliArgs(process.argv.slice(2));
    const result = await runBackfillStubScenario(args.scenario);

    console.log(
      summarizeBackfillScenario({
        scenario: args.scenario,
        first: result.first,
        followUp: result.followUp,
        executorCallCount: result.executorCallCount,
      })
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Stage 3 backfill runner failed: ${error.message}`);
    } else {
      console.error('Stage 3 backfill runner failed due to an unknown error.');
    }

    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
