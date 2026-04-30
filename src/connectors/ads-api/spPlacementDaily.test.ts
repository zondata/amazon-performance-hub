import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildAdsApiDateRange } from './spCampaignDaily';
import { loadAdsApiEnvForProfileSync } from './env';
import {
  buildSpPlacementDailyCreateRequest,
  buildSpPlacementDailyCreateRequestBody,
  normalizeSpPlacementDailyRows,
  parseSpPlacementDailyDownloadedRows,
  requestSpPlacementDailyReport,
  runSpPlacementDailyPull,
  validateProfileSyncArtifactForSpPlacementDaily,
} from './spPlacementDaily';

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
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

const writeProfileArtifact = (overrides: Record<string, unknown> = {}) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adsapi-placement-profile-sync-'));
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

describe('Amazon Ads SP placement daily boundary', () => {
  it('fails when the profile-sync artifact mismatches local env', () => {
    const config = loadAdsApiEnvForProfileSync(profileSyncEnv);
    const artifactPath = writeProfileArtifact({ appAccountId: 'dynamix' });

    expect(() =>
      validateProfileSyncArtifactForSpPlacementDaily({
        config,
        artifactPath,
      })
    ).toThrowError(
      'Profile-sync artifact appAccountId does not match APP_ACCOUNT_ID.'
    );
  });

  it('builds the placement daily create request with placement grouping', () => {
    const config = loadAdsApiEnvForProfileSync(profileSyncEnv);
    const dateRange = buildAdsApiDateRange({
      startDate: '2026-04-10',
      endDate: '2026-04-16',
    });

    expect(
      buildSpPlacementDailyCreateRequest({
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
        buildSpPlacementDailyCreateRequestBody({
          dateRange,
        })
      ),
    });
  });

  it('normalizes placement rows into the required row shape', () => {
    const rawRowsPayload = parseSpPlacementDailyDownloadedRows({
      body: Buffer.from(
        JSON.stringify([
          {
            campaignId: '2',
            campaignName: 'Campaign B',
            campaignBiddingStrategy: 'dynamic bids - up and down',
            placementClassification: 'TOP_OF_SEARCH',
            date: '2026-04-11',
            impressions: 200,
            clicks: 20,
            cost: 12.34,
            sales14d: 56.78,
            purchases14d: 3,
            unitsSoldClicks14d: 4,
            costPerClick: 0.617,
            clickThroughRate: 0.1,
            campaignBudgetCurrencyCode: 'USD',
          },
          {
            campaignId: '1',
            campaignName: 'Campaign A',
            placementClassification: 'PRODUCT_PAGES',
            date: '2026-04-10',
            impressions: 100,
            clicks: 10,
            cost: 5.67,
            sales14d: 12.34,
            purchases14d: 1,
            unitsSoldClicks14d: 2,
          },
        ])
      ),
    });

    expect(
      normalizeSpPlacementDailyRows({
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
        campaignBiddingStrategy: null,
        placementClassification: 'PRODUCT_PAGES',
        placementRaw: 'Product pages',
        placementCode: 'PP',
        date: '2026-04-10',
        impressions: 100,
        clicks: 10,
        cost: 5.67,
        attributedSales14d: 12.34,
        attributedConversions14d: 1,
        attributedUnitsOrdered14d: 2,
        costPerClick: null,
        clickThroughRate: null,
        currencyCode: null,
      },
      {
        appAccountId: 'sourbear',
        appMarketplace: 'US',
        profileId: '3362351578582214',
        campaignId: '2',
        campaignName: 'Campaign B',
        campaignBiddingStrategy: 'dynamic bids - up and down',
        placementClassification: 'TOP_OF_SEARCH',
        placementRaw: 'Top of search (first page)',
        placementCode: 'TOS',
        date: '2026-04-11',
        impressions: 200,
        clicks: 20,
        cost: 12.34,
        attributedSales14d: 56.78,
        attributedConversions14d: 3,
        attributedUnitsOrdered14d: 4,
        costPerClick: 0.617,
        clickThroughRate: 0.1,
        currencyCode: 'USD',
      },
    ]);
  });

  it('runs the placement pull and writes artifacts', async () => {
    const config = loadAdsApiEnvForProfileSync(profileSyncEnv);
    const artifactPath = writeProfileArtifact();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adsapi-placement-pull-'));
    tempDirs.push(dir);
    const rawArtifactPath = path.join(dir, 'placement.raw.json');
    const normalizedArtifactPath = path.join(dir, 'placement.normalized.json');

    const transport = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        json: { reportId: 'rpt-1', status: 'PENDING' },
        headers: {},
      })
      .mockResolvedValueOnce({
        status: 200,
        json: {
          reportId: 'rpt-1',
          status: 'COMPLETED',
          location: 'https://download.example/report.json.gz',
        },
        headers: {},
      });

    const downloadTransport = vi.fn(async () => ({
      status: 200,
      body: Buffer.from(
        JSON.stringify([
          {
            campaignId: '1',
            campaignName: 'Campaign A',
            placementClassification: 'REST_OF_SEARCH',
            date: '2026-04-10',
            impressions: 100,
            clicks: 10,
            cost: 5.67,
            sales14d: 12.34,
            purchases14d: 1,
            unitsSoldClicks14d: 2,
          },
        ])
      ),
      headers: {
        'content-type': 'application/json',
      },
    }));

    const result = await runSpPlacementDailyPull({
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
      pollIntervalMs: 1,
      sleep: async () => {},
    });

    expect(result.normalizedArtifact.rowCount).toBe(1);
    expect(fs.existsSync(rawArtifactPath)).toBe(true);
    expect(fs.existsSync(normalizedArtifactPath)).toBe(true);
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
      requestSpPlacementDailyReport({
        config,
        accessToken: 'access-token',
        dateRange,
        transport,
      })
    ).rejects.toThrowError(
      'Amazon Ads placement daily report request failed with status 401'
    );
  });
});
