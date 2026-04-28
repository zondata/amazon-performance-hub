import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildAdsApiDateRange,
  DEFAULT_SP_CAMPAIGN_DAILY_MAX_ATTEMPTS,
  buildSpCampaignDailyCreateRequest,
  buildSpCampaignDailyCreateRequestBody,
  normalizeSpCampaignDailyRows,
  parseSpCampaignDailyDownloadedRows,
  requestSpCampaignDailyReport,
  runSpCampaignDailyPull,
  validateProfileSyncArtifactForSpCampaignDaily,
} from './spCampaignDaily';
import { loadAdsApiEnvForProfileSync } from './env';

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adsapi-profile-sync-'));
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

describe('Amazon Ads SP campaign daily boundary', () => {
  it('fails when the profile-sync artifact is missing', () => {
    const config = loadAdsApiEnvForProfileSync(profileSyncEnv);

    expect(() =>
      validateProfileSyncArtifactForSpCampaignDaily({
        config,
        artifactPath: path.join(os.tmpdir(), 'missing-ads-profiles.sync.json'),
      })
    ).toThrowError('Missing profile-sync artifact:');
  });

  it('fails when the profile-sync artifact mismatches local env', () => {
    const config = loadAdsApiEnvForProfileSync(profileSyncEnv);
    const artifactPath = writeProfileArtifact({ appAccountId: 'dynamix' });

    expect(() =>
      validateProfileSyncArtifactForSpCampaignDaily({
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

  it('builds the campaign daily create request with the validated scope header', () => {
    const config = loadAdsApiEnvForProfileSync(profileSyncEnv);
    const dateRange = buildAdsApiDateRange({
      startDate: '2026-04-10',
      endDate: '2026-04-16',
    });

    expect(
      buildSpCampaignDailyCreateRequest({
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
        buildSpCampaignDailyCreateRequestBody({
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
      requestSpCampaignDailyReport({
        config,
        accessToken: 'access-token',
        dateRange,
        transport,
      })
    ).rejects.toThrowError(
      'Amazon Ads campaign daily report request failed with status 401'
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
      requestSpCampaignDailyReport({
        config,
        accessToken: 'access-token',
        dateRange,
        transport,
      })
    ).rejects.toThrowError(
      'Amazon Ads campaign daily report request failed before a response was received'
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
      requestSpCampaignDailyReport({
        config,
        accessToken: 'access-token',
        dateRange,
        transport,
      })
    ).rejects.toThrowError(
      'Amazon Ads campaign daily report request returned an invalid response payload'
    );
  });

  it('records timeout diagnostics with status history and redacted response tails', async () => {
    const config = loadAdsApiEnvForProfileSync(profileSyncEnv);
    const dateRange = buildAdsApiDateRange({
      startDate: '2026-04-10',
      endDate: '2026-04-16',
    });
    const transport = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        json: {
          reportId: 'rpt-123',
          status: 'PENDING',
        },
        headers: {},
      })
      .mockResolvedValue({
        status: 200,
        json: {
          reportId: 'rpt-123',
          status: 'PROCESSING',
          statusDetails: 'still generating',
          note:
            'https://download.example/report?X-Amz-Signature=secret-signature&token=abc',
        },
        headers: {
          'retry-after': '30',
        },
      });

    let thrown: Error | null = null;
    try {
      await requestSpCampaignDailyReport({
        config,
        accessToken: 'access-token',
        dateRange,
        transport,
        maxAttempts: 3,
        pollIntervalMs: 0,
        sleep: async () => {},
      });
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown).toBeTruthy();
    expect((thrown as { code?: string }).code).toBe('pending_timeout');
    expect(thrown?.message).toContain('remained pending after 3 attempts');
    expect(thrown?.message).toContain('report_id=rpt-123');
    expect(thrown?.message).not.toContain('secret-signature');
    const details = (thrown as { details?: Record<string, unknown> }).details ?? {};
    expect(details.reportId).toBe('rpt-123');
    expect(details.maxAttempts).toBe(3);
    expect(details.pollIntervalMs).toBe(0);
    expect(details.retryAfter).toBe('30');
    expect(Array.isArray(details.lastStatuses)).toBe(true);
    expect(JSON.stringify(details.lastResponseBodyTail)).not.toContain('secret-signature');
  });

  it('reuses an existing pending report instead of creating a duplicate', async () => {
    const config = loadAdsApiEnvForProfileSync(profileSyncEnv);
    const dateRange = buildAdsApiDateRange({
      startDate: '2026-04-10',
      endDate: '2026-04-16',
    });
    const pendingStore = {
      findReusablePendingRequest: vi.fn(async () => ({
        reportId: 'rpt-existing',
        status: 'PENDING',
        statusDetails: 'awaiting_generation',
        attemptCount: 12,
        diagnosticPath: '/tmp/diag.json',
        lastResponseJson: {},
      })),
      upsertPendingRequest: vi.fn(async () => {}),
    };
    const transport = vi.fn(async () => ({
      status: 200,
      json: {
        reportId: 'rpt-existing',
        status: 'SUCCESS',
        location: 'https://download.example/report',
      },
      headers: {},
    }));

    const result = await requestSpCampaignDailyReport({
      config,
      accessToken: 'access-token',
      dateRange,
      transport,
      pendingStore,
      pollIntervalMs: 0,
      sleep: async () => {},
    });

    expect(result.reportId).toBe('rpt-existing');
    expect(transport).toHaveBeenCalledTimes(1);
    const firstRequest = (
      transport.mock.calls as unknown as Array<Array<{ method?: string; url?: string }>>
    )[0]?.[0];
    expect(firstRequest?.method).toBe('GET');
    expect(String(firstRequest?.url ?? '')).toContain('/rpt-existing');
    expect(pendingStore.findReusablePendingRequest).toHaveBeenCalledOnce();
  });

  it('fails clearly when resume-pending is requested but no saved report exists', async () => {
    const config = loadAdsApiEnvForProfileSync(profileSyncEnv);
    const dateRange = buildAdsApiDateRange({
      startDate: '2026-04-10',
      endDate: '2026-04-16',
    });
    const pendingStore = {
      findReusablePendingRequest: vi.fn(async () => null),
      upsertPendingRequest: vi.fn(async () => {}),
    };

    let thrown: unknown;
    try {
      await requestSpCampaignDailyReport({
        config,
        accessToken: 'access-token',
        dateRange,
        transport: vi.fn(),
        pendingStore,
        resumePendingOnly: true,
      });
    } catch (error) {
      thrown = error;
    }

    expect((thrown as { code?: string }).code).toBe('pending_report_not_found');
  });

  it('emits poll updates for the create phase and every fifteenth attempt', async () => {
    const config = loadAdsApiEnvForProfileSync(profileSyncEnv);
    const dateRange = buildAdsApiDateRange({
      startDate: '2026-04-10',
      endDate: '2026-04-16',
    });
    const transport = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        json: {
          reportId: 'rpt-123',
          status: 'PENDING',
        },
        headers: {},
      })
      .mockResolvedValue({
        status: 200,
        json: {
          reportId: 'rpt-123',
          status: 'QUEUED',
        },
        headers: {},
      });
    const updates: Array<{ kind: string; attempt: number }> = [];

    await expect(
      requestSpCampaignDailyReport({
        config,
        accessToken: 'access-token',
        dateRange,
        transport,
        maxAttempts: 16,
        pollIntervalMs: 0,
        sleep: async () => {},
        onPollUpdate: (update) => {
          updates.push({ kind: update.kind, attempt: update.snapshot.attempt });
        },
      })
    ).rejects.toThrowError('remained pending after 16 attempts');

    expect(updates).toEqual([
      { kind: 'create', attempt: 0 },
      { kind: 'poll', attempt: 1 },
      { kind: 'poll', attempt: 15 },
      { kind: 'timeout', attempt: 16 },
    ]);
  });

  it('uses the new default max-attempt budget when one is not provided', async () => {
    const config = loadAdsApiEnvForProfileSync(profileSyncEnv);
    const dateRange = buildAdsApiDateRange({
      startDate: '2026-04-10',
      endDate: '2026-04-16',
    });
    const transport = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        json: {
          reportId: 'rpt-123',
          status: 'PENDING',
        },
        headers: {},
      })
      .mockResolvedValue({
        status: 200,
        json: {
          reportId: 'rpt-123',
          status: 'PROCESSING',
        },
        headers: {},
      });
    let sleepCalls = 0;

    await expect(
      requestSpCampaignDailyReport({
        config,
        accessToken: 'access-token',
        dateRange,
        transport,
        pollIntervalMs: 0,
        sleep: async () => {
          sleepCalls += 1;
        },
      })
    ).rejects.toThrowError(
      `remained pending after ${DEFAULT_SP_CAMPAIGN_DAILY_MAX_ATTEMPTS} attempts`
    );

    expect(sleepCalls).toBe(DEFAULT_SP_CAMPAIGN_DAILY_MAX_ATTEMPTS - 1);
  });

  it('normalizes campaign daily rows into the required row shape', () => {
    const rawRowsPayload = parseSpCampaignDailyDownloadedRows({
      body: Buffer.from(
        JSON.stringify([
          {
            campaignId: '2',
            campaignName: 'Campaign B',
            campaignStatus: 'enabled',
            campaignBudgetType: 'daily',
            date: '2026-04-11',
            impressions: 200,
            clicks: 20,
            cost: 12.34,
            sales14d: 56.78,
            purchases14d: 3,
            currency: 'USD',
          },
          {
            campaignId: '1',
            campaignName: 'Campaign A',
            campaignStatus: 'paused',
            campaignBudgetType: null,
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
      normalizeSpCampaignDailyRows({
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
        campaignName: 'Campaign A',
        campaignStatus: 'paused',
        campaignBudgetType: null,
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
        campaignStatus: 'enabled',
        campaignBudgetType: 'daily',
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

  it('runs the bounded pull and writes both required local artifacts', async () => {
    const config = loadAdsApiEnvForProfileSync(profileSyncEnv);
    const dateRange = buildAdsApiDateRange({
      startDate: '2026-04-10',
      endDate: '2026-04-16',
    });
    const artifactPath = writeProfileArtifact();
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adsapi-sp-campaign-'));
    tempDirs.push(outDir);
    const rawArtifactPath = path.join(outDir, 'raw.json');
    const normalizedArtifactPath = path.join(outDir, 'normalized.json');

    const transport = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        json: {
          reportId: 'rpt-123',
          status: 'PENDING',
        },
      })
      .mockResolvedValueOnce({
        status: 200,
        json: {
          reportId: 'rpt-123',
          status: 'SUCCESS',
          location: 'https://download.example/report',
          fileSize: 123,
        },
      });

    const downloadTransport = vi.fn(async () => ({
      status: 200,
      body: Buffer.from(
        JSON.stringify([
          {
            campaignId: '99',
            campaignName: 'Core Campaign',
            campaignStatus: 'enabled',
            campaignBudgetType: 'daily',
            date: '2026-04-10',
            impressions: 10,
            clicks: 1,
            cost: 2.34,
            sales14d: 9.87,
            purchases14d: 1,
            currency: 'USD',
          },
        ])
      ),
      headers: { 'content-type': 'application/json' },
    }));

    const result = await runSpCampaignDailyPull({
      config,
      accessToken: 'access-token',
      dateRange,
      transport,
      downloadTransport,
      artifactPath,
      rawArtifactPath,
      normalizedArtifactPath,
      pollIntervalMs: 0,
      sleep: async () => {},
      generatedAt: '2026-04-17T00:00:00.000Z',
    });

    expect(result.normalizedArtifact.normalizedCampaignRows[0]).toMatchObject({
      appAccountId: 'sourbear',
      appMarketplace: 'US',
      profileId: '3362351578582214',
      campaignId: '99',
      campaignName: 'Core Campaign',
      campaignStatus: 'enabled',
      campaignBudgetType: 'daily',
      date: '2026-04-10',
      impressions: 10,
      clicks: 1,
      cost: 2.34,
      attributedSales14d: 9.87,
      attributedConversions14d: 1,
      currencyCode: 'USD',
    });

    expect(fs.existsSync(rawArtifactPath)).toBe(true);
    expect(fs.existsSync(normalizedArtifactPath)).toBe(true);
  });

  it('resumes a saved pending report through the full pull path and downloads once ready', async () => {
    const config = loadAdsApiEnvForProfileSync(profileSyncEnv);
    const dateRange = buildAdsApiDateRange({
      startDate: '2026-04-10',
      endDate: '2026-04-16',
    });
    const artifactPath = writeProfileArtifact();
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adsapi-sp-campaign-resume-'));
    tempDirs.push(outDir);
    const pendingStore = {
      findReusablePendingRequest: vi.fn(async () => ({
        reportId: 'rpt-existing',
        status: 'PENDING',
        statusDetails: null,
        attemptCount: 3,
        diagnosticPath: null,
        lastResponseJson: {},
      })),
      upsertPendingRequest: vi.fn(async () => {}),
    };
    const transport = vi.fn(async () => ({
      status: 200,
      json: {
        reportId: 'rpt-existing',
        status: 'SUCCESS',
        location: 'https://download.example/report',
        fileSize: 456,
      },
      headers: {},
    }));
    const downloadTransport = vi.fn(async () => ({
      status: 200,
      body: Buffer.from(
        JSON.stringify([
          {
            campaignId: '1',
            campaignName: 'Resumed Campaign',
            campaignStatus: 'enabled',
            date: '2026-04-10',
            impressions: 10,
            clicks: 1,
            cost: 2.34,
            sales14d: 4.56,
            purchases14d: 1,
          },
        ])
      ),
      headers: { 'content-type': 'application/json' },
    }));

    const result = await runSpCampaignDailyPull({
      config,
      accessToken: 'access-token',
      dateRange,
      transport,
      downloadTransport,
      artifactPath,
      rawArtifactPath: path.join(outDir, 'raw.json'),
      normalizedArtifactPath: path.join(outDir, 'normalized.json'),
      pendingStore,
      resumePendingOnly: true,
      pollIntervalMs: 0,
      sleep: async () => {},
    });

    expect(result.metadata.reportId).toBe('rpt-existing');
    expect(transport).toHaveBeenCalledTimes(1);
    expect(downloadTransport).toHaveBeenCalledTimes(1);
  });
});
