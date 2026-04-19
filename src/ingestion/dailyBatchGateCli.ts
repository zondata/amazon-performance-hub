import {
  createStubDailyBatchSourceExecutor,
  runDailyBatchGate,
  summarizeDailyBatchGate,
} from './dailyBatchGate';
import { IngestionJobRunnerError } from './jobRunner';

interface CliArgs {
  accountId: string;
  marketplace: string;
  startDate: string;
  endDate: string;
  scenario: 'real' | 'stub-success' | 'stub-retail-failure' | 'stub-ads-failure';
  retailReportId: string | null;
}

const readValue = (argv: string[], index: number, flag: string): string => {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new IngestionJobRunnerError(
      'invalid_request',
      `Missing value for ${flag}`
    );
  }
  return value;
};

const parseScenario = (value: string): CliArgs['scenario'] => {
  if (
    value === 'real' ||
    value === 'stub-success' ||
    value === 'stub-retail-failure' ||
    value === 'stub-ads-failure'
  ) {
    return value;
  }

  throw new IngestionJobRunnerError(
    'invalid_request',
    `Unsupported scenario: ${value}`
  );
};

export function parseDailyBatchGateCliArgs(argv: string[]): CliArgs {
  const args: Partial<CliArgs> = {
    scenario: 'real',
    retailReportId: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--account-id') {
      args.accountId = readValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--account-id=')) {
      args.accountId = arg.slice('--account-id='.length);
      continue;
    }
    if (arg === '--marketplace') {
      args.marketplace = readValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--marketplace=')) {
      args.marketplace = arg.slice('--marketplace='.length);
      continue;
    }
    if (arg === '--start-date') {
      args.startDate = readValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--start-date=')) {
      args.startDate = arg.slice('--start-date='.length);
      continue;
    }
    if (arg === '--end-date') {
      args.endDate = readValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--end-date=')) {
      args.endDate = arg.slice('--end-date='.length);
      continue;
    }
    if (arg === '--scenario') {
      args.scenario = parseScenario(readValue(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg.startsWith('--scenario=')) {
      args.scenario = parseScenario(arg.slice('--scenario='.length));
      continue;
    }
    if (arg === '--retail-report-id') {
      args.retailReportId = readValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--retail-report-id=')) {
      args.retailReportId = arg.slice('--retail-report-id='.length);
      continue;
    }

    throw new IngestionJobRunnerError(
      'invalid_request',
      `Unknown CLI argument: ${arg}`
    );
  }

  for (const required of [
    'accountId',
    'marketplace',
    'startDate',
    'endDate',
  ] as const) {
    if (!args[required]) {
      throw new IngestionJobRunnerError(
        'invalid_request',
        `Missing required --${required.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)} argument`
      );
    }
  }

  return args as CliArgs;
}

const buildStubOptions = (scenario: CliArgs['scenario']) => {
  if (scenario === 'real') return {};

  const retail = createStubDailyBatchSourceExecutor({
    sourceGroup: 'retail',
    rowCount: 3,
    checksum: 'retail-stub-checksum',
    fail:
      scenario === 'stub-retail-failure'
        ? {
            code: 'stub_retail_failure',
            message: 'Stub retail daily failure',
          }
        : undefined,
  });
  const ads = createStubDailyBatchSourceExecutor({
    sourceGroup: 'ads',
    rowCount: 7,
    checksum: 'ads-stub-checksum',
    fail:
      scenario === 'stub-ads-failure'
        ? {
            code: 'stub_ads_failure',
            message: 'Stub ads daily failure',
          }
        : undefined,
  });

  let nowIndex = 0;
  const nowValues = [
    '2026-04-19T00:00:00.000Z',
    '2026-04-19T00:00:01.000Z',
    '2026-04-19T00:00:02.000Z',
    '2026-04-19T00:00:03.000Z',
    '2026-04-19T00:00:04.000Z',
    '2026-04-19T00:00:05.000Z',
    '2026-04-19T00:00:06.000Z',
    '2026-04-19T00:00:07.000Z',
    '2026-04-19T00:00:08.000Z',
    '2026-04-19T00:00:09.000Z',
    '2026-04-19T00:00:10.000Z',
    '2026-04-19T00:00:11.000Z',
  ];
  let jobIndex = 0;

  return {
    retailExecutor: retail.executor,
    adsExecutor: ads.executor,
    now: () => nowValues[Math.min(nowIndex++, nowValues.length - 1)],
    createJobId: () => `daily-gate-job-${String(++jobIndex).padStart(3, '0')}`,
  };
};

async function main(): Promise<void> {
  try {
    const args = parseDailyBatchGateCliArgs(process.argv.slice(2));
    const result = await runDailyBatchGate({
      request: {
        accountId: args.accountId,
        marketplace: args.marketplace,
        startDate: args.startDate,
        endDate: args.endDate,
      },
      ...buildStubOptions(args.scenario),
      realExecutorOptions: {
        retailReportId: args.retailReportId,
      },
    });

    console.log(summarizeDailyBatchGate(result));

    if (!result.ok) {
      process.exitCode = 1;
    }
  } catch (error) {
    if (error instanceof IngestionJobRunnerError) {
      console.error(`Stage 3 daily batch gate error: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`Stage 3 daily batch gate failed: ${error.message}`);
    } else {
      console.error('Stage 3 daily batch gate failed due to an unknown error.');
    }
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
