import {
  InMemoryIngestionJobRepository,
  IngestionJobRunner,
  IngestionJobRunnerError,
  createStubIngestionExecutor,
  type IngestionJobRunRequest,
  type IngestionJobRunResult,
} from './jobRunner';

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

  if (!['success', 'failure', 'retry', 'replay'].includes(scenario)) {
    throw new IngestionJobRunnerError(
      'invalid_request',
      `Unsupported scenario: ${scenario}`
    );
  }

  return {
    scenario: scenario as 'success' | 'failure' | 'retry' | 'replay',
  };
};

const buildDemoRequest = (): IngestionJobRunRequest => ({
  jobKey: 'demo_stub_job',
  sourceName: 'stub_source',
  accountId: 'demo-account',
  marketplace: 'US',
  sourceWindowStart: '2026-04-01T00:00:00.000Z',
  sourceWindowEnd: '2026-04-07T23:59:59.999Z',
  idempotencyKey: 'demo/stub-source/2026-04-01/2026-04-07',
  runKind: 'manual',
  scopeKey: 'demo-scope',
  metadata: {
    demo: true,
  },
});

const formatRunSummary = (label: string, result: IngestionJobRunResult) => {
  const metadata = result.job.metadata as {
    retry_count?: number;
    replay_of_job_id?: string | null;
  };

  return [
    `${label}: result=${result.result}`,
    `  job_id=${result.job.id}`,
    `  idempotency_key=${result.job.idempotency_key}`,
    `  status=${result.job.processing_status}`,
    `  row_count=${result.job.row_count ?? 'null'}`,
    `  checksum=${result.job.checksum ?? 'null'}`,
    `  error_code=${result.job.error_code ?? 'null'}`,
    `  retry_count=${metadata.retry_count ?? 0}`,
    `  replay_of_job_id=${metadata.replay_of_job_id ?? 'null'}`,
    `  watermark_status=${result.watermark?.status ?? 'null'}`,
    `  watermark_last_job_id=${result.watermark?.last_job_id ?? 'null'}`,
  ].join('\n');
};

export const summarizeJobRunnerScenario = (args: {
  scenario: 'success' | 'failure' | 'retry' | 'replay';
  first: IngestionJobRunResult;
  followUp?: IngestionJobRunResult;
  executorCallCount: number;
}): string => {
  const lines = [
    'Stage 3 ingestion job runner stub scenario completed.',
    `Scenario: ${args.scenario}`,
    formatRunSummary('First run', args.first),
  ];

  if (args.followUp) {
    lines.push(formatRunSummary('Follow-up run', args.followUp));
  }

  lines.push(`Executor call count: ${args.executorCallCount}`);
  return lines.join('\n');
};

export async function runJobRunnerStubScenario(
  scenario: 'success' | 'failure' | 'retry' | 'replay'
): Promise<{
  first: IngestionJobRunResult;
  followUp?: IngestionJobRunResult;
  executorCallCount: number;
}> {
  const repository = new InMemoryIngestionJobRepository();
  const stub =
    scenario === 'success'
      ? createStubIngestionExecutor([
          {
            outcome: 'success',
            rowCount: 7,
            checksum: 'stub-success-checksum',
            retrievedAt: '2026-04-18T00:00:01.000Z',
          },
        ])
      : createStubIngestionExecutor([
          {
            outcome: 'failure',
            errorCode: 'stub_failure',
            errorMessage: 'Stub executor failure',
          },
          {
            outcome: 'success',
            rowCount: 7,
            checksum: 'stub-recovery-checksum',
            retrievedAt: '2026-04-18T00:00:02.000Z',
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

  const first = await runner.submitJob(buildDemoRequest());

  if (scenario === 'retry') {
    return {
      first,
      followUp: await runner.retryFailedJob(first.job.id),
      executorCallCount: stub.getCallCount(),
    };
  }

  if (scenario === 'replay') {
    return {
      first,
      followUp: await runner.replayFailedJob(first.job.id),
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
    const result = await runJobRunnerStubScenario(args.scenario);

    console.log(
      summarizeJobRunnerScenario({
        scenario: args.scenario,
        first: result.first,
        followUp: result.followUp,
        executorCallCount: result.executorCallCount,
      })
    );
  } catch (error) {
    if (error instanceof IngestionJobRunnerError) {
      console.error(`Stage 3 job runner error: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`Stage 3 job runner failed: ${error.message}`);
    } else {
      console.error('Stage 3 job runner failed due to an unknown error.');
    }

    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}

