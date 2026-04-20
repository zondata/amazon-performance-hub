import { loadLocalEnvFiles } from '../connectors/sp-api/loadLocalEnv';
import {
  InMemoryIngestionJobRepository,
  IngestionJobRunnerError,
} from './jobRunner';
import {
  createPostgresPool,
  PostgresIngestionJobRepository,
} from './postgresIngestionJobRepository';
import {
  runFirstSalesTrafficRetailIngest,
  summarizeFirstSalesTrafficRetailIngest,
} from './firstSalesTrafficRetailIngest';
import {
  PostgresFirstSalesTrafficWarehouseSink,
  type FirstSalesTrafficByAsinWarehouseRow,
  type FirstSalesTrafficByDateWarehouseRow,
  type FirstSalesTrafficWarehouseSink,
} from '../warehouse/firstSalesTrafficWarehouseWrite';

interface CliArgs {
  accountId: string;
  marketplace: string;
  startDate: string;
  endDate: string;
  reportId: string | null;
  rawPath: string | null;
  warehouseReadyPath: string | null;
  ensureSchema: boolean;
  scenario: 'real' | 'stub-success' | 'stub-failure';
}

class StubWarehouseSink implements FirstSalesTrafficWarehouseSink {
  readonly dateRows: FirstSalesTrafficByDateWarehouseRow[] = [];
  readonly asinRows: FirstSalesTrafficByAsinWarehouseRow[] = [];

  constructor(private readonly shouldFail: boolean) {}

  async applySchema(): Promise<void> {}

  async upsertAccount(): Promise<void> {
    if (this.shouldFail) {
      throw new Error('Stub FT-01 warehouse sink failure');
    }
  }

  async upsertByDateRows(
    rows: FirstSalesTrafficByDateWarehouseRow[]
  ): Promise<number> {
    this.dateRows.push(...rows);
    return rows.length;
  }

  async upsertByAsinRows(
    rows: FirstSalesTrafficByAsinWarehouseRow[]
  ): Promise<number> {
    this.asinRows.push(...rows);
    return rows.length;
  }
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
  if (value === 'real' || value === 'stub-success' || value === 'stub-failure') {
    return value;
  }
  throw new IngestionJobRunnerError(
    'invalid_request',
    `Unsupported scenario: ${value}`
  );
};

export function parseFirstSalesTrafficRetailIngestCliArgs(
  argv: string[]
): CliArgs {
  const args: Partial<CliArgs> = {
    reportId: null,
    rawPath: null,
    warehouseReadyPath: null,
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
    if (arg === '--report-id') {
      args.reportId = readValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--report-id=')) {
      args.reportId = arg.slice('--report-id='.length);
      continue;
    }
    if (arg === '--raw-path') {
      args.rawPath = readValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--raw-path=')) {
      args.rawPath = arg.slice('--raw-path='.length);
      continue;
    }
    if (arg === '--warehouse-ready-path') {
      args.warehouseReadyPath = readValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--warehouse-ready-path=')) {
      args.warehouseReadyPath = arg.slice('--warehouse-ready-path='.length);
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

  if (!args.reportId && !args.rawPath && !args.warehouseReadyPath) {
    throw new IngestionJobRunnerError(
      'invalid_request',
      'Provide --report-id, --raw-path, or --warehouse-ready-path'
    );
  }

  return args as CliArgs;
}

async function runWithStub(args: CliArgs): Promise<void> {
  let nowIndex = 0;
  const nowValues = [
    '2026-04-20T00:00:00.000Z',
    '2026-04-20T00:00:01.000Z',
    '2026-04-20T00:00:02.000Z',
    '2026-04-20T00:00:03.000Z',
  ];
  const result = await runFirstSalesTrafficRetailIngest({
    request: {
      accountId: args.accountId,
      marketplace: args.marketplace,
      startDate: args.startDate,
      endDate: args.endDate,
      reportId: args.reportId,
      rawFilePath: args.rawPath,
      warehouseReadyArtifactPath: args.warehouseReadyPath,
      applySchema: args.ensureSchema,
    },
    repository: new InMemoryIngestionJobRepository(),
    sink: new StubWarehouseSink(args.scenario === 'stub-failure'),
    now: () => nowValues[Math.min(nowIndex++, nowValues.length - 1)],
    createJobId: () => 'ft01-stub-job-001',
  });

  console.log(summarizeFirstSalesTrafficRetailIngest(result));
  if (!result.ok) process.exitCode = 1;
}

async function runReal(args: CliArgs): Promise<void> {
  loadLocalEnvFiles();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new IngestionJobRunnerError(
      'invalid_request',
      'DATABASE_URL is required for the real FT-01 retail ingest path'
    );
  }

  const pool = createPostgresPool(databaseUrl);
  try {
    const result = await runFirstSalesTrafficRetailIngest({
      request: {
        accountId: args.accountId,
        marketplace: args.marketplace,
        startDate: args.startDate,
        endDate: args.endDate,
        reportId: args.reportId,
        rawFilePath: args.rawPath,
        warehouseReadyArtifactPath: args.warehouseReadyPath,
        applySchema: args.ensureSchema,
      },
      repository: new PostgresIngestionJobRepository(pool),
      sink: new PostgresFirstSalesTrafficWarehouseSink(pool),
    });

    console.log(summarizeFirstSalesTrafficRetailIngest(result));
    if (!result.ok) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  try {
    const args = parseFirstSalesTrafficRetailIngestCliArgs(
      process.argv.slice(2)
    );

    if (args.scenario === 'real') {
      await runReal(args);
    } else {
      await runWithStub(args);
    }
  } catch (error) {
    if (error instanceof IngestionJobRunnerError) {
      console.error(`FT-01 retail ingest error: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`FT-01 retail ingest failed: ${error.message}`);
    } else {
      console.error('FT-01 retail ingest failed due to an unknown error.');
    }
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
