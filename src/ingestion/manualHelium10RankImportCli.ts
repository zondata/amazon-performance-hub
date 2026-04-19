import {
  ManualHelium10RankImportError,
  runManualHelium10RankImport,
  summarizeManualHelium10RankImport,
} from './manualHelium10RankImport';

interface CliArgs {
  csvPath: string;
  accountId: string;
  marketplace: string;
}

function readValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new ManualHelium10RankImportError('invalid_file', `Missing value for ${flag}.`);
  }
  return value;
}

export function parseManualHelium10RankImportCliArgs(argv: string[]): CliArgs {
  const args: Partial<CliArgs> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--file') {
      args.csvPath = readValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--file=')) {
      args.csvPath = arg.slice('--file='.length);
      continue;
    }
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

    throw new ManualHelium10RankImportError('invalid_file', `Unknown CLI argument: ${arg}`);
  }

  if (!args.csvPath) {
    throw new ManualHelium10RankImportError('invalid_file', 'Missing required --file <csv> argument.');
  }
  if (!args.accountId) {
    throw new ManualHelium10RankImportError(
      'invalid_file',
      'Missing required --account-id <id> argument.'
    );
  }
  if (!args.marketplace) {
    throw new ManualHelium10RankImportError(
      'invalid_file',
      'Missing required --marketplace <code> argument.'
    );
  }

  return args as CliArgs;
}

async function main(): Promise<void> {
  try {
    const args = parseManualHelium10RankImportCliArgs(process.argv.slice(2));
    const result = await runManualHelium10RankImport({
      csvPath: args.csvPath,
      accountId: args.accountId,
      marketplace: args.marketplace,
    });
    console.log(summarizeManualHelium10RankImport(result));
  } catch (error) {
    if (error instanceof ManualHelium10RankImportError) {
      console.error(`Manual Helium 10 rank import failed: ${error.message}`);
      for (const issue of error.issues.slice(0, 10)) {
        console.error(`issue row=${issue.rowNumber} code=${issue.code} message=${issue.message}`);
      }
    } else if (error instanceof Error) {
      console.error(`Manual Helium 10 rank import failed: ${error.message}`);
    } else {
      console.error('Manual Helium 10 rank import failed due to an unknown error.');
    }
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
