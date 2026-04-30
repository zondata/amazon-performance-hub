import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildAdsApiDateRange } from './spCampaignDaily';
import { loadAdsApiEnvForProfileSync } from './env';
import {
  buildSpAdvertisedProductDailyCreateRequest,
  buildSpAdvertisedProductDailyCreateRequestBody,
  normalizeSpAdvertisedProductDailyRows,
  parseSpAdvertisedProductDailyDownloadedRows,
  runSpAdvertisedProductDailyPull,
  validateProfileSyncArtifactForSpAdvertisedProductDaily,
} from './spAdvertisedProductDaily';

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adsapi-advertised-product-profile-sync-'));
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

describe('Amazon Ads SP advertised product daily boundary', () => {
  it('fails when the profile-sync artifact mismatches local env', () => {
    const config = loadAdsApiEnvForProfileSync(profileSyncEnv);
    const artifactPath = writeProfileArtifact({ appMarketplace: 'CA' });

    expect(() =>
      validateProfileSyncArtifactForSpAdvertisedProductDaily({
        config,
        artifactPath,
      })
    ).toThrowError(
      'Profile-sync artifact appMarketplace does not match APP_MARKETPLACE.'
    );
  });

  it('builds the advertised product create request with advertiser grouping', () => {
    const config = loadAdsApiEnvForProfileSync(profileSyncEnv);
    const dateRange = buildAdsApiDateRange({
      startDate: '2026-04-10',
      endDate: '2026-04-16',
    });

    expect(
      buildSpAdvertisedProductDailyCreateRequest({
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
        buildSpAdvertisedProductDailyCreateRequestBody({
          dateRange,
        })
      ),
    });
  });

  it('normalizes advertised product rows into the required row shape', () => {
    const rawRowsPayload = parseSpAdvertisedProductDailyDownloadedRows({
      body: Buffer.from(
        JSON.stringify([
          {
            date: '2026-04-11',
            campaignId: '2',
            campaignName: 'Campaign B',
            adGroupId: '200',
            adGroupName: 'Ad Group B',
            advertisedAsin: 'b000111',
            advertisedSku: 'sku-b',
            impressions: 200,
            clicks: 20,
            cost: 12.34,
            sales14d: 56.78,
            purchases14d: 3,
            unitsSoldClicks14d: 4,
            campaignBudgetCurrencyCode: 'USD',
          },
          {
            date: '2026-04-10',
            campaignId: '1',
            campaignName: 'Campaign A',
            advertisedAsin: 'b000222',
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
      normalizeSpAdvertisedProductDailyRows({
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
        date: '2026-04-10',
        campaignId: '1',
        campaignName: 'Campaign A',
        adGroupId: null,
        adGroupName: null,
        advertisedAsin: 'B000222',
        advertisedSku: null,
        impressions: 100,
        clicks: 10,
        cost: 5.67,
        attributedSales14d: 12.34,
        attributedConversions14d: 1,
        attributedUnitsOrdered14d: 2,
        currencyCode: null,
      },
      {
        appAccountId: 'sourbear',
        appMarketplace: 'US',
        profileId: '3362351578582214',
        date: '2026-04-11',
        campaignId: '2',
        campaignName: 'Campaign B',
        adGroupId: '200',
        adGroupName: 'Ad Group B',
        advertisedAsin: 'B000111',
        advertisedSku: 'sku-b',
        impressions: 200,
        clicks: 20,
        cost: 12.34,
        attributedSales14d: 56.78,
        attributedConversions14d: 3,
        attributedUnitsOrdered14d: 4,
        currencyCode: 'USD',
      },
    ]);
  });

  it('runs the advertised product pull and writes artifacts', async () => {
    const config = loadAdsApiEnvForProfileSync(profileSyncEnv);
    const artifactPath = writeProfileArtifact();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adsapi-advertised-product-pull-'));
    tempDirs.push(dir);
    const rawArtifactPath = path.join(dir, 'advertised-product.raw.json');
    const normalizedArtifactPath = path.join(dir, 'advertised-product.normalized.json');

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
            date: '2026-04-10',
            campaignId: '1',
            campaignName: 'Campaign A',
            advertisedAsin: 'b000333',
            impressions: 9,
            clicks: 2,
            cost: 3.5,
            sales14d: 11.2,
            purchases14d: 1,
            unitsSoldClicks14d: 1,
          },
        ])
      ),
      headers: {},
    }));

    const result = await runSpAdvertisedProductDailyPull({
      config,
      accessToken: 'access-token',
      dateRange: {
        startDate: '2026-04-10',
        endDate: '2026-04-16',
      },
      transport,
      downloadTransport,
      artifactPath,
      rawArtifactPath,
      normalizedArtifactPath,
      pollIntervalMs: 0,
      sleep: async () => {},
    });

    expect(result.normalizedArtifact.rowCount).toBe(1);
    expect(result.normalizedArtifact.normalizedAdvertisedProductRows[0]?.advertisedAsin).toBe(
      'B000333'
    );
    expect(fs.existsSync(rawArtifactPath)).toBe(true);
    expect(fs.existsSync(normalizedArtifactPath)).toBe(true);
  });
});
