import {
  createStubWeeklyQueryIntelligenceExecutor,
  runWeeklyQueryIntelligenceGate,
  summarizeWeeklyQueryIntelligenceGate,
} from './weeklyQueryIntelligenceGate';
import { IngestionJobRunnerError } from './jobRunner';

interface CliArgs {
  accountId: string;
  marketplace: string;
  startDate: string;
  endDate: string;
  asin: string | null;
  marketplaceId: string | null;
  scenario:
    | 'real'
    | 'stub-success'
    | 'stub-sqp-failure'
    | 'stub-search-terms-failure';
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
    value === 'stub-sqp-failure' ||
    value === 'stub-search-terms-failure'
  ) {
    return value;
  }

  throw new IngestionJobRunnerError(
    'invalid_request',
    `Unsupported scenario: ${value}`
  );
};

export function parseWeeklyQueryIntelligenceGateCliArgs(
  argv: string[]
): CliArgs {
  const args: Partial<CliArgs> = {
    scenario: 'real',
    asin: null,
    marketplaceId: null,
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
    if (arg === '--asin') {
      args.asin = readValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--asin=')) {
      args.asin = arg.slice('--asin='.length);
      continue;
    }
    if (arg === '--marketplace-id') {
      args.marketplaceId = readValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--marketplace-id=')) {
      args.marketplaceId = arg.slice('--marketplace-id='.length);
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

  const sqp = createStubWeeklyQueryIntelligenceExecutor({
    sourceGroup: 'sqp',
    rowCount: 11,
    checksum: 'sqp-stub-checksum',
    fail:
      scenario === 'stub-sqp-failure'
        ? {
            code: 'stub_sqp_failure',
            message: 'Stub SQP weekly failure',
          }
        : undefined,
  });
  const searchTerms = createStubWeeklyQueryIntelligenceExecutor({
    sourceGroup: 'search_terms',
    rowCount: 13,
    checksum: 'search-terms-stub-checksum',
    fail:
      scenario === 'stub-search-terms-failure'
        ? {
            code: 'stub_search_terms_failure',
            message: 'Stub Search Terms weekly failure',
          }
        : undefined,
  });

  let nowIndex = 0;
  const nowValues = [
    '2026-04-19T01:00:00.000Z',
    '2026-04-19T01:00:01.000Z',
    '2026-04-19T01:00:02.000Z',
    '2026-04-19T01:00:03.000Z',
    '2026-04-19T01:00:04.000Z',
    '2026-04-19T01:00:05.000Z',
    '2026-04-19T01:00:06.000Z',
    '2026-04-19T01:00:07.000Z',
    '2026-04-19T01:00:08.000Z',
    '2026-04-19T01:00:09.000Z',
    '2026-04-19T01:00:10.000Z',
    '2026-04-19T01:00:11.000Z',
  ];
  let jobIndex = 0;

  return {
    sqpExecutor: sqp.executor,
    searchTermsExecutor: searchTerms.executor,
    now: () => nowValues[Math.min(nowIndex++, nowValues.length - 1)],
    createJobId: () =>
      `weekly-query-gate-job-${String(++jobIndex).padStart(3, '0')}`,
  };
};

async function main(): Promise<void> {
  try {
    const args = parseWeeklyQueryIntelligenceGateCliArgs(
      process.argv.slice(2)
    );
    const result = await runWeeklyQueryIntelligenceGate({
      request: {
        accountId: args.accountId,
        marketplace: args.marketplace,
        startDate: args.startDate,
        endDate: args.endDate,
        asin: args.asin,
        marketplaceId: args.marketplaceId,
      },
      ...buildStubOptions(args.scenario),
    });

    console.log(summarizeWeeklyQueryIntelligenceGate(result));

    if (!result.ok) {
      process.exitCode = 1;
    }
  } catch (error) {
    if (error instanceof IngestionJobRunnerError) {
      console.error(
        `Stage 3 weekly query-intelligence gate error: ${error.message}`
      );
    } else if (error instanceof Error) {
      console.error(
        `Stage 3 weekly query-intelligence gate failed: ${error.message}`
      );
    } else {
      console.error(
        'Stage 3 weekly query-intelligence gate failed due to an unknown error.'
      );
    }
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
