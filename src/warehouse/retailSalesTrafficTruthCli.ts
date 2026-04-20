import { loadLocalEnvFiles } from '../connectors/sp-api/loadLocalEnv';
import { createPostgresPool } from '../ingestion/postgresIngestionJobRepository';
import {
  InMemoryRetailSalesTrafficTruthReader,
  PostgresRetailSalesTrafficTruthReader,
  RetailSalesTrafficTruthError,
  RETAIL_TRUTH_SOURCE,
  runRetailSalesTrafficTruthProof,
  summarizeRetailSalesTrafficTruthProof,
} from './retailSalesTrafficTruth';

type CliArgs = {
  accountId: string;
  marketplace: string;
  startDate: string;
  endDate: string;
  asin: string | null;
  ensureSchema: boolean;
  scenario: 'real' | 'stub-success' | 'stub-legacy-fallback';
};

const readValue = (argv: string[], index: number, flag: string): string => {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new RetailSalesTrafficTruthError(
      'invalid_input',
      `Missing value for ${flag}`
    );
  }
  return value;
};

const parseScenario = (value: string): CliArgs['scenario'] => {
  if (
    value === 'real' ||
    value === 'stub-success' ||
    value === 'stub-legacy-fallback'
  ) {
    return value;
  }
  throw new RetailSalesTrafficTruthError(
    'invalid_input',
    `Unsupported scenario: ${value}`
  );
};

export function parseRetailSalesTrafficTruthCliArgs(argv: string[]): CliArgs {
  const args: Partial<CliArgs> = {
    asin: null,
    ensureSchema: false,
    scenario: 'real',
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
    if (arg === '--ensure-schema') {
      args.ensureSchema = true;
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
    throw new RetailSalesTrafficTruthError(
      'invalid_input',
      `Unknown argument: ${arg}`
    );
  }

  for (const field of ['accountId', 'marketplace', 'startDate', 'endDate'] as const) {
    if (!args[field]) {
      throw new RetailSalesTrafficTruthError(
        'invalid_input',
        `Missing required argument --${field
          .replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
          .replace(/^account-id$/, 'account-id')}`
      );
    }
  }

  return args as CliArgs;
}

const runStub = async (args: CliArgs): Promise<void> => {
  const legacyFallback = args.scenario === 'stub-legacy-fallback';
  const reader = new InMemoryRetailSalesTrafficTruthReader(
    [
      {
        accountId: args.accountId,
        marketplace: args.marketplace.toUpperCase(),
        date: args.startDate,
        reportId: 'stub-report-001',
        ingestionJobId: '00000000-0000-0000-0000-000000000001',
        canonicalRecordId: 'stub-report-001:salesAndTrafficByDate:0',
        reportWindowStart: args.startDate,
        reportWindowEnd: args.endDate,
        orderedProductSalesAmount: 123.45,
        orderedProductSalesCurrency: 'USD',
        unitsOrdered: 3,
        totalOrderItems: 3,
        sessions: 11,
        pageViews: 22,
        exportedAt: '2026-04-20T12:00:00.000Z',
        ingestedAt: '2026-04-20T12:05:00.000Z',
        retailTruthSource: RETAIL_TRUTH_SOURCE,
        legacySalesTrendFallback: legacyFallback,
      },
    ],
    [
      {
        accountId: args.accountId,
        marketplace: args.marketplace.toUpperCase(),
        asin: args.asin ?? 'B0STUBASIN',
        parentAsin: args.asin ?? 'B0STUBASIN',
        childAsin: null,
        sku: null,
        date: null,
        reportId: 'stub-report-001',
        ingestionJobId: '00000000-0000-0000-0000-000000000001',
        canonicalRecordId: 'stub-report-001:salesAndTrafficByAsin:0',
        reportWindowStart: args.startDate,
        reportWindowEnd: args.endDate,
        orderedProductSalesAmount: 123.45,
        orderedProductSalesCurrency: 'USD',
        unitsOrdered: 3,
        totalOrderItems: 3,
        sessions: 11,
        pageViews: 22,
        exportedAt: '2026-04-20T12:00:00.000Z',
        ingestedAt: '2026-04-20T12:05:00.000Z',
        retailTruthSource: RETAIL_TRUTH_SOURCE,
        legacySalesTrendFallback: legacyFallback,
      },
    ]
  );

  const summary = await runRetailSalesTrafficTruthProof({
    reader,
    query: {
      accountId: args.accountId,
      marketplace: args.marketplace,
      startDate: args.startDate,
      endDate: args.endDate,
      asin: args.asin,
    },
  });
  console.log(summarizeRetailSalesTrafficTruthProof(summary));
};

const runReal = async (args: CliArgs): Promise<void> => {
  loadLocalEnvFiles();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new RetailSalesTrafficTruthError(
      'invalid_input',
      'DATABASE_URL is required for the real FT-02 retail truth proof'
    );
  }

  const pool = createPostgresPool(databaseUrl);
  try {
    const reader = new PostgresRetailSalesTrafficTruthReader(pool);
    if (args.ensureSchema) {
      await reader.applySchema();
    }
    const summary = await runRetailSalesTrafficTruthProof({
      reader,
      query: {
        accountId: args.accountId,
        marketplace: args.marketplace,
        startDate: args.startDate,
        endDate: args.endDate,
        asin: args.asin,
      },
    });
    console.log(summarizeRetailSalesTrafficTruthProof(summary));
  } finally {
    await pool.end();
  }
};

const main = async (): Promise<void> => {
  try {
    const args = parseRetailSalesTrafficTruthCliArgs(process.argv.slice(2));
    if (args.scenario === 'real') {
      await runReal(args);
    } else {
      await runStub(args);
    }
  } catch (error) {
    console.error('ok=no');
    if (error instanceof RetailSalesTrafficTruthError) {
      console.error(`error_code=${error.code}`);
      console.error(`error_message=${error.message}`);
    } else if (error instanceof Error) {
      console.error('error_code=unexpected_error');
      console.error(`error_message=${error.message}`);
    } else {
      console.error('error_code=unexpected_error');
      console.error('error_message=Unknown error');
    }
    process.exitCode = 1;
  }
};

void main();
