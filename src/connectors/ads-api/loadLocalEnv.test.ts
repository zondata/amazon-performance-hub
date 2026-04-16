import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadAdsApiEnvForRefresh } from './env';
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

describe('Amazon Ads local env loading', () => {
  it('loads Amazon Ads values from .env.local and preserves existing process env', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'adsapi-env-'));
    tempDirs.push(cwd);

    fs.writeFileSync(
      path.join(cwd, '.env.local'),
      [
        'AMAZON_ADS_CLIENT_ID=file-client-id',
        'AMAZON_ADS_CLIENT_SECRET=file-client-secret',
        'AMAZON_ADS_API_BASE_URL=https://advertising-api.amazon.com',
      ].join('\n')
    );

    const env: NodeJS.ProcessEnv = {
      AMAZON_ADS_CLIENT_ID: 'existing-client-id',
    };

    const loadedFiles = loadLocalEnvFiles({
      cwd,
      env,
      candidates: ['.env.local'],
    });

    expect(loadedFiles).toEqual(['.env.local']);
    expect(env.AMAZON_ADS_CLIENT_ID).toBe('existing-client-id');
    expect(env.AMAZON_ADS_CLIENT_SECRET).toBe('file-client-secret');
    expect(env.AMAZON_ADS_API_BASE_URL).toBe(
      'https://advertising-api.amazon.com'
    );
  });

  it('supports a quoted refresh token from .env.local', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'adsapi-env-'));
    tempDirs.push(cwd);

    fs.writeFileSync(
      path.join(cwd, '.env.local'),
      [
        'AMAZON_ADS_CLIENT_ID=client-id',
        'AMAZON_ADS_CLIENT_SECRET=client-secret',
        'AMAZON_ADS_API_BASE_URL=https://advertising-api.amazon.com',
        'AMAZON_ADS_REFRESH_TOKEN=\"quoted-refresh-token\"',
      ].join('\n')
    );

    const env: NodeJS.ProcessEnv = {};
    loadLocalEnvFiles({
      cwd,
      env,
      candidates: ['.env.local'],
    });

    const config = loadAdsApiEnvForRefresh(env);
    expect(config.credentials.refreshToken).toBe('quoted-refresh-token');
  });
});
