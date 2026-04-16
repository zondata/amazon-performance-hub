import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_ENV_FILE_CANDIDATES = [
  '.env.local',
  '.env',
  'apps/web/.env.local',
  'apps/web/.env',
] as const;

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseDotEnv(contents: string): Record<string, string> {
  const parsed: Record<string, string> = {};

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = stripWrappingQuotes(trimmed.slice(separatorIndex + 1));

    if (!key) {
      continue;
    }

    parsed[key] = value;
  }

  return parsed;
}

export function loadLocalEnvFiles(options: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  candidates?: readonly string[];
} = {}): string[] {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const candidates = options.candidates ?? DEFAULT_ENV_FILE_CANDIDATES;
  const loadedFiles: string[] = [];

  for (const candidate of candidates) {
    const filePath = path.resolve(cwd, candidate);

    if (!fs.existsSync(filePath)) {
      continue;
    }

    const parsed = parseDotEnv(fs.readFileSync(filePath, 'utf8'));

    for (const [key, value] of Object.entries(parsed)) {
      if (env[key] == null || env[key] === '') {
        env[key] = value;
      }
    }

    loadedFiles.push(candidate);
  }

  return loadedFiles;
}
