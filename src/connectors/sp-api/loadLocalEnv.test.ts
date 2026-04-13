import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadLocalEnvFiles } from './loadLocalEnv';

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();

    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('loadLocalEnvFiles', () => {
  it('loads missing values from .env.local', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'spapi-env-'));
    tempDirs.push(cwd);

    fs.writeFileSync(
      path.join(cwd, '.env.local'),
      [
        'SP_API_REFRESH_TOKEN=refresh-token',
        'SP_API_LWA_CLIENT_ID=client-id',
        'SP_API_LWA_CLIENT_SECRET=client-secret',
      ].join('\n'),
    );

    const env: NodeJS.ProcessEnv = {};
    const loadedFiles = loadLocalEnvFiles({
      cwd,
      env,
      candidates: ['.env.local'],
    });

    expect(loadedFiles).toEqual(['.env.local']);
    expect(env.SP_API_REFRESH_TOKEN).toBe('refresh-token');
    expect(env.SP_API_LWA_CLIENT_ID).toBe('client-id');
    expect(env.SP_API_LWA_CLIENT_SECRET).toBe('client-secret');
  });

  it('does not override values already present in process env', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'spapi-env-'));
    tempDirs.push(cwd);

    fs.writeFileSync(
      path.join(cwd, '.env.local'),
      [
        'SP_API_REFRESH_TOKEN=file-refresh-token',
        'SP_API_LWA_CLIENT_ID=file-client-id',
      ].join('\n'),
    );

    const env: NodeJS.ProcessEnv = {
      SP_API_REFRESH_TOKEN: 'existing-refresh-token',
      SP_API_LWA_CLIENT_ID: 'existing-client-id',
    };

    loadLocalEnvFiles({
      cwd,
      env,
      candidates: ['.env.local'],
    });

    expect(env.SP_API_REFRESH_TOKEN).toBe('existing-refresh-token');
    expect(env.SP_API_LWA_CLIENT_ID).toBe('existing-client-id');
  });
});
