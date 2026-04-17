import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildAdsApiDateRange } from './spCampaignDaily';
import { loadAdsApiEnvForProfileSync } from './env';
import {
  buildSpTargetDailyCreateRequest,
  buildSpTargetDailyCreateRequestBody,
  normalizeSpTargetDailyRows,
  parseSpTargetDailyDownloadedRows,
  requestSpTargetDailyReport,
  runSpTargetDailyPull,
  validateProfileSyncArtifactForSpTargetDaily,
} from './spTargetDaily';

const profileSyncEnv = {
  AMAZON_ADS_CLIENT_ID: 'client-id',
  AMAZON_ADS_CLIENT_SECRET: 'client-secret',
  AMAZON_ADS_API_BASE_URL: 'https://advertising-api.amazon.com',
  AMAZON_ADS_REFRESH_TOKEN: 'refresh-token',
  AMAZON_ADS_PROFILE_ID: '3362351578582214',
  APP_ACCOUNT_ID: 'sourbear',
  APP_MARKETPLACE: 'US',
};

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

const writeProfileArtifact = (overrides: Record<string, unknown> = {}) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adsapi-target-profile-sync-'));
  tempDirs.push(dir);
  const artifactPath = path.join(dir, 'ads-profiles.sync.json');
  fs.writeFileSync(
    artifactPath,
    JSON.stringify(
      {
        schemaVersion: 'ads-api-profile-sync/v1',
        generatedAt: '2026-04-17T00:00:00.000Z',
        appAccountId: 'sourbear',
        appMarketplace: 'US',
        adsApiBaseUrl: 'https://advertising-api.amazon.com',
        configuredProfileId: '3362351578582214',
        selectedProfile: {
          profileId: '3362351578582214',
          countryCode: 'US',
          currencyCode: 'USD',
          timezone: 'America/Los_Angeles',
          accountInfo: {
            id: 'A10515NC1ZVACY',
            type: 'seller',
            name: 'NETRADE SOLUTION',
            validPaymentMethod: true,
          },
        },
        profileCount: 3,
        profilesSummary: [],
        ...overrides,
      },
      null,
      2
    )
  );
  return artifactPath;
};

describe('Amazon Ads SP target daily boundary', () => {
  it('fails when the profile-sync artifact is missing', () => {
    const config = loadAdsApiEnvForProfileSync(profileSyncEnv);

    expect(() =>
      validateProfileSyncArtifactForSpTargetDaily({
        config,
        artifactPath: path.join(os.tmpdir(), 'missing-ads-profiles.sync.json'),
      })
    ).toThrowError('Missing profile-sync artifact:');
  });

  it('fails when the profile-sync artifact mismatches local env', () => {
    const config = loadAdsApiEnvForProfileSync(profileSyncEnv);
    const artifactPath = writeProfileArtifact({ appAccountId: 'dynamix' });

    expect(() =>
      validateProfileSyncArtifactForSpTargetDaily({
        config,
        artifactPath,
      })
    ).toThrowError(
      'Profile-sync artifact appAccountId does not match APP_ACCOUNT_ID.'
    );
  });

  it('fails on invalid date inputs', () => {
    expect(() =>
      buildAdsApiDateRange({
        startDate: '2026-04-31',
        endDate: '2026-04-16',
      })
    ).toThrowError('Invalid start date: 2026-04-31. Expected YYYY-MM-DD.');

    expect(() =>
      buildAdsApiDateRange({
        startDate: '2026-04-16',
        endDate: '2026-04-10',
      })
    ).toThrowError('End date must be on or after start date.');
  });

  it('fails on date windows wider than 31 days', () => {
    expect(() =>
      buildAdsApiDateRange({
        startDate: '2026-04-01',
        endDate: '2026-05-02',
      })
    ).toThrowError('Date range must be 31 days or fewer.');
  });

  it('builds the target daily create request with the validated scope header', () => {
    const config = loadAdsApiEnvForProfileSync(profileSyncEnv);
    const dateRange = buildAdsApiDateRange({
      startDate: '2026-04-10',
      endDate: '2026-04-16',
    });

    expect(
      buildSpTargetDailyCreateRequest({
        config,
        accessToken: 'access-token',
        dateRange,
      })
    ).toEqual({
      url: 'https://advertising-api.amazon.com/reporting/reports',
      method: 'POST',
      headers: {
        authorization: 'Bearer access-token',
        'Amazon-Advertising-API-ClientId': 'client-id',
        'Amazon-Advertising-API-Scope': '3362351578582214',
        'content-type': 'application/json',
      },
      body: JSON.stringify(
        buildSpTargetDailyCreateRequestBody({
          dateRange,
        })
      ),
    });
  });

  it('normalizes a non-2xx report request failure', async () => {
    const config = loadAdsApiEnvForProfileSync(profileSyncEnv);
    const dateRange = buildAdsApiDateRange({
      startDate: '2026-04-10',
      endDate: '2026-04-16',
    });
    const transport = vi.fn(async () => ({
      status: 401,
      json: { message: 'unauthorized' },
    }));

    await expect(
      requestSpTargetDailyReport({
        config,
        accessToken: 'access-token',
        dateRange,
        transport,
      })
    ).rejects.toThrowError(
      'Amazon Ads target daily report request failed with status 401'
    );
  });

  it('normalizes a transport failure', async () => {
    const config = loadAdsApiEnvForProfileSync(profileSyncEnv);
    const dateRange = buildAdsApiDateRange({
      startDate: '2026-04-10',
      endDate: '2026-04-16',
    });
    const transport = vi.fn(async () => {
      throw new Error('socket hang up');
    });

    await expect(
      requestSpTargetDailyReport({
        config,
        accessToken: 'access-token',
        dateRange,
        transport,
      })
    ).rejects.toThrowError(
      'Amazon Ads target daily report request failed before a response was received'
    );
  });

  it('fails on invalid report response payloads', async () => {
    const config = loadAdsApiEnvForProfileSync(profileSyncEnv);
    const dateRange = buildAdsApiDateRange({
      startDate: '2026-04-10',
      endDate: '2026-04-16',
    });
    const transport = vi.fn(async () => ({
      status: 200,
      json: { status: 'PENDING' },
    }));

    await expect(
      requestSpTargetDailyReport({
        config,
        accessToken: 'access-token',
        dateRange,
        transport,
      })
    ).rejects.toThrowError(
      'Amazon Ads target daily report request returned an invalid response payload'
    );
  });

  it('normalizes target daily rows into the required row shape', () => {
    const rawRowsPayload = parseSpTargetDailyDownloadedRows({
      body: Buffer.from(
        JSON.stringify([
          {
            campaignId: '2',
            campaignName: 'Campaign B',
            adGroupId: '22',
            adGroupName: 'Ad Group B',
            targetId: '202',
            targetingExpression: 'asin=\"B0TEST\"',
            matchType: 'TARGETING_EXPRESSION',
            targetStatus: 'ENABLED',
            date: '2026-04-11',
            impressions: 200,
            clicks: 20,
            cost: 12.34,
            sales14d: 56.78,
            purchases14d: 3,
            campaignBudgetCurrencyCode: 'USD',
          },
          {
            campaignId: '1',
            adGroupId: '11',
            targetId: '101',
            keywordText: 'dog memorial gift',
            keywordStatus: 'PAUSED',
            date: '2026-04-10',
            impressions: 100,
            clicks: 10,
            cost: 5.67,
            sales14d: 12.34,
            purchases14d: 1,
          },
        ])
      ),
      headers: { 'content-type': 'application/json' },
    });

    expect(
      normalizeSpTargetDailyRows({
        rawRowsPayload,
        appAccountId: 'sourbear',
        appMarketplace: 'US',
        profileId: '3362351578582214',
      })
    ).toEqual([
      {
        appAccountId: 'sourbear',
        appMarketplace: 'US',
        profileId: '3362351578582214',
        campaignId: '1',
        campaignName: null,
        adGroupId: '11',
        adGroupName: null,
        targetId: '101',
        targetingExpression: 'dog memorial gift',
        matchType: null,
        targetStatus: 'PAUSED',
        date: '2026-04-10',
        impressions: 100,
        clicks: 10,
        cost: 5.67,
        attributedSales14d: 12.34,
        attributedConversions14d: 1,
        currencyCode: null,
      },
      {
        appAccountId: 'sourbear',
        appMarketplace: 'US',
        profileId: '3362351578582214',
        campaignId: '2',
        campaignName: 'Campaign B',
        adGroupId: '22',
        adGroupName: 'Ad Group B',
        targetId: '202',
        targetingExpression: 'asin="B0TEST"',
        matchType: 'TARGETING_EXPRESSION',
        targetStatus: 'ENABLED',
        date: '2026-04-11',
        impressions: 200,
        clicks: 20,
        cost: 12.34,
        attributedSales14d: 56.78,
        attributedConversions14d: 3,
        currencyCode: 'USD',
      },
    ]);
  });

  it('runs the bounded target daily pull and writes both artifacts', async () => {
    const config = loadAdsApiEnvForProfileSync(profileSyncEnv);
    const artifactPath = writeProfileArtifact();
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adsapi-target-daily-'));
    tempDirs.push(outputDir);
    const rawArtifactPath = path.join(outputDir, 'sp-target-daily.raw.json');
    const normalizedArtifactPath = path.join(
      outputDir,
      'sp-target-daily.normalized.json'
    );
    const transport = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        json: {
          reportId: 'report-123',
          status: 'PENDING',
        },
      })
      .mockResolvedValueOnce({
        status: 200,
        json: {
          reportId: 'report-123',
          status: 'COMPLETED',
          url: 'https://download.example.com/report-123',
          fileSize: 321,
        },
      });
    const downloadTransport = vi.fn(async () => ({
      status: 200,
      body: Buffer.from(
        JSON.stringify([
          {
            campaignId: '1',
            campaignName: 'Campaign A',
            adGroupId: '11',
            adGroupName: 'Ad Group A',
            targetId: '101',
            targetingExpression: 'asin="B0TEST"',
            matchType: 'TARGETING_EXPRESSION',
            targetStatus: 'ENABLED',
            date: '2026-04-10',
            impressions: 10,
            clicks: 1,
            cost: 2.34,
            sales14d: 3.45,
            purchases14d: 1,
            campaignBudgetCurrencyCode: 'USD',
          },
        ])
      ),
      headers: { 'content-type': 'application/json' },
    }));

    const result = await runSpTargetDailyPull({
      config,
      accessToken: 'access-token',
      dateRange: buildAdsApiDateRange({
        startDate: '2026-04-10',
        endDate: '2026-04-16',
      }),
      transport,
      downloadTransport,
      artifactPath,
      rawArtifactPath,
      normalizedArtifactPath,
      pollIntervalMs: 0,
      generatedAt: '2026-04-17T12:00:00.000Z',
    });

    expect(result.validatedArtifact.configuredProfileId).toBe('3362351578582214');
    expect(result.metadata.reportId).toBe('report-123');
    expect(result.normalizedArtifact.rowCount).toBe(1);
    expect(fs.existsSync(rawArtifactPath)).toBe(true);
    expect(fs.existsSync(normalizedArtifactPath)).toBe(true);
  });
});
