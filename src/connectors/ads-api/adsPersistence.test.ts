import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  buildAdsPersistenceDailySummary,
  loadAdsPersistenceInputs,
  runAdsPersistence,
} from './adsPersistence';

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

const makeTempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ads-persist-'));
  tempDirs.push(dir);
  return dir;
};

const writeArtifacts = (overrides: {
  campaignRaw?: Record<string, unknown>;
  campaignNormalized?: Record<string, unknown>;
  targetRaw?: Record<string, unknown>;
  targetNormalized?: Record<string, unknown>;
} = {}) => {
  const dir = makeTempDir();
  const paths = {
    campaignRawArtifactPath: path.join(dir, 'sp-campaign-daily.raw.json'),
    campaignNormalizedArtifactPath: path.join(
      dir,
      'sp-campaign-daily.normalized.json'
    ),
    targetRawArtifactPath: path.join(dir, 'sp-target-daily.raw.json'),
    targetNormalizedArtifactPath: path.join(dir, 'sp-target-daily.normalized.json'),
  };

  const shared = {
    appAccountId: 'sourbear',
    appMarketplace: 'US',
    adsApiBaseUrl: 'https://advertising-api.amazon.com',
    profileId: '3362351578582214',
    requestedDateRange: {
      startDate: '2026-04-10',
      endDate: '2026-04-16',
    },
  };

  fs.writeFileSync(
    paths.campaignRawArtifactPath,
    JSON.stringify(
      {
        schemaVersion: 'ads-api-sp-campaign-daily-raw/v1',
        generatedAt: '2026-04-17T00:00:00.000Z',
        ...shared,
        reportMetadata: {
          reportId: 'campaign-report',
          status: 'COMPLETED',
          statusDetails: null,
          fileSize: 123,
          downloadUrlPresent: true,
        },
        rawRowsPayload: {
          format: 'json',
          rows: [{ campaignId: '1' }],
        },
        ...overrides.campaignRaw,
      },
      null,
      2
    )
  );

  fs.writeFileSync(
    paths.campaignNormalizedArtifactPath,
    JSON.stringify(
      {
        schemaVersion: 'ads-api-sp-campaign-daily-normalized/v1',
        generatedAt: '2026-04-17T00:00:00.000Z',
        ...shared,
        rowCount: 2,
        normalizedCampaignRows: [
          {
            appAccountId: 'sourbear',
            appMarketplace: 'US',
            profileId: '3362351578582214',
            campaignId: '20',
            campaignName: 'Campaign B',
            campaignStatus: 'ENABLED',
            campaignBudgetType: 'DAILY_BUDGET',
            date: '2026-04-11',
            impressions: 20,
            clicks: 2,
            cost: 4.5,
            attributedSales14d: 8.5,
            attributedConversions14d: 1,
            currencyCode: 'USD',
          },
          {
            appAccountId: 'sourbear',
            appMarketplace: 'US',
            profileId: '3362351578582214',
            campaignId: '10',
            campaignName: 'Campaign A',
            campaignStatus: 'ENABLED',
            campaignBudgetType: 'DAILY_BUDGET',
            date: '2026-04-10',
            impressions: 10,
            clicks: 1,
            cost: 2.5,
            attributedSales14d: 5.5,
            attributedConversions14d: 1,
            currencyCode: 'USD',
          },
        ],
        ...overrides.campaignNormalized,
      },
      null,
      2
    )
  );

  fs.writeFileSync(
    paths.targetRawArtifactPath,
    JSON.stringify(
      {
        schemaVersion: 'ads-api-sp-target-daily-raw/v1',
        generatedAt: '2026-04-17T00:00:00.000Z',
        ...shared,
        reportMetadata: {
          reportId: 'target-report',
          status: 'COMPLETED',
          statusDetails: null,
          fileSize: 456,
          downloadUrlPresent: true,
        },
        rawRowsPayload: {
          format: 'json',
          rows: [{ targetId: '1' }],
        },
        ...overrides.targetRaw,
      },
      null,
      2
    )
  );

  fs.writeFileSync(
    paths.targetNormalizedArtifactPath,
    JSON.stringify(
      {
        schemaVersion: 'ads-api-sp-target-daily-normalized/v1',
        generatedAt: '2026-04-17T00:00:00.000Z',
        ...shared,
        rowCount: 2,
        normalizedTargetRows: [
          {
            appAccountId: 'sourbear',
            appMarketplace: 'US',
            profileId: '3362351578582214',
            campaignId: '20',
            campaignName: 'Campaign B',
            adGroupId: '200',
            adGroupName: 'Ad Group B',
            targetId: '2000',
            targetingExpression: 'keyword b',
            matchType: 'EXACT',
            targetStatus: 'ENABLED',
            date: '2026-04-11',
            impressions: 12,
            clicks: 3,
            cost: 3.4,
            attributedSales14d: 6.7,
            attributedConversions14d: 1,
            currencyCode: 'USD',
          },
          {
            appAccountId: 'sourbear',
            appMarketplace: 'US',
            profileId: '3362351578582214',
            campaignId: '10',
            campaignName: 'Campaign A',
            adGroupId: '100',
            adGroupName: 'Ad Group A',
            targetId: '1000',
            targetingExpression: 'keyword a',
            matchType: 'BROAD',
            targetStatus: 'PAUSED',
            date: '2026-04-10',
            impressions: 8,
            clicks: 2,
            cost: 1.2,
            attributedSales14d: 2.3,
            attributedConversions14d: 1,
            currencyCode: 'USD',
          },
        ],
        ...overrides.targetNormalized,
      },
      null,
      2
    )
  );

  return paths;
};

describe('Ads persistence boundary', () => {
  it('fails when a required artifact is missing', () => {
    const dir = makeTempDir();

    expect(() =>
      loadAdsPersistenceInputs({
        sources: {
          campaignRawArtifactPath: path.join(dir, 'missing.json'),
        },
      })
    ).toThrowError('Missing required local artifact:');
  });

  it('fails when an artifact is not valid JSON', () => {
    const paths = writeArtifacts();
    fs.writeFileSync(paths.targetRawArtifactPath, '{not-json');

    expect(() =>
      loadAdsPersistenceInputs({
        sources: paths,
      })
    ).toThrowError(`Artifact is not valid JSON: ${paths.targetRawArtifactPath}`);
  });

  it('fails when artifact metadata does not match', () => {
    const paths = writeArtifacts({
      targetNormalized: {
        appMarketplace: 'CA',
      },
    });

    expect(() =>
      loadAdsPersistenceInputs({
        sources: paths,
      })
    ).toThrowError(
      'Target normalized artifact appMarketplace does not match the other artifacts.'
    );
  });

  it('builds deterministic daily summary output', () => {
    expect(
      buildAdsPersistenceDailySummary({
        campaignRows: [
          {
            appAccountId: 'sourbear',
            appMarketplace: 'US',
            profileId: '1',
            campaignId: '2',
            campaignName: 'Campaign B',
            campaignStatus: 'ENABLED',
            campaignBudgetType: 'DAILY_BUDGET',
            date: '2026-04-11',
            impressions: 20,
            clicks: 2,
            cost: 4.5,
            attributedSales14d: 8.5,
            attributedConversions14d: 1,
            currencyCode: 'USD',
          },
          {
            appAccountId: 'sourbear',
            appMarketplace: 'US',
            profileId: '1',
            campaignId: '1',
            campaignName: 'Campaign A',
            campaignStatus: 'ENABLED',
            campaignBudgetType: 'DAILY_BUDGET',
            date: '2026-04-10',
            impressions: 10,
            clicks: 1,
            cost: 2.5,
            attributedSales14d: 5.5,
            attributedConversions14d: 1,
            currencyCode: 'USD',
          },
        ],
        targetRows: [
          {
            appAccountId: 'sourbear',
            appMarketplace: 'US',
            profileId: '1',
            campaignId: '2',
            campaignName: 'Campaign B',
            adGroupId: '20',
            adGroupName: 'Ad Group B',
            targetId: '200',
            targetingExpression: 'keyword b',
            matchType: 'EXACT',
            targetStatus: 'ENABLED',
            date: '2026-04-11',
            impressions: 12,
            clicks: 3,
            cost: 3.4,
            attributedSales14d: 6.7,
            attributedConversions14d: 1,
            currencyCode: 'USD',
          },
          {
            appAccountId: 'sourbear',
            appMarketplace: 'US',
            profileId: '1',
            campaignId: '1',
            campaignName: 'Campaign A',
            adGroupId: '10',
            adGroupName: 'Ad Group A',
            targetId: '100',
            targetingExpression: 'keyword a',
            matchType: 'BROAD',
            targetStatus: 'PAUSED',
            date: '2026-04-10',
            impressions: 8,
            clicks: 2,
            cost: 1.2,
            attributedSales14d: 2.3,
            attributedConversions14d: 1,
            currencyCode: 'USD',
          },
        ],
      })
    ).toEqual([
      {
        date: '2026-04-10',
        campaignRowCount: 1,
        targetRowCount: 1,
        campaignImpressions: 10,
        campaignClicks: 1,
        campaignCost: 2.5,
        campaignAttributedSales14d: 5.5,
        campaignAttributedConversions14d: 1,
        targetImpressions: 8,
        targetClicks: 2,
        targetCost: 1.2,
        targetAttributedSales14d: 2.3,
        targetAttributedConversions14d: 1,
      },
      {
        date: '2026-04-11',
        campaignRowCount: 1,
        targetRowCount: 1,
        campaignImpressions: 20,
        campaignClicks: 2,
        campaignCost: 4.5,
        campaignAttributedSales14d: 8.5,
        campaignAttributedConversions14d: 1,
        targetImpressions: 12,
        targetClicks: 3,
        targetCost: 3.4,
        targetAttributedSales14d: 6.7,
        targetAttributedConversions14d: 1,
      },
    ]);
  });

  it('writes the landed and persisted artifacts locally', () => {
    const paths = writeArtifacts();
    const outputDir = makeTempDir();

    const result = runAdsPersistence({
      sources: paths,
      landingArtifactPath: path.join(outputDir, 'ads-sp-daily.landed.json'),
      normalizationArtifactPath: path.join(
        outputDir,
        'ads-sp-daily.persisted.json'
      ),
      generatedAt: '2026-04-17T12:00:00.000Z',
    });

    expect(result.sharedMetadata.appAccountId).toBe('sourbear');
    expect(result.persistedArtifact.campaignRowCount).toBe(2);
    expect(result.persistedArtifact.targetRowCount).toBe(2);
    expect(result.persistedArtifact.campaignRows[0]?.date).toBe('2026-04-10');
    expect(result.persistedArtifact.targetRows[0]?.targetId).toBe('1000');
    expect(fs.existsSync(result.landingArtifactPath)).toBe(true);
    expect(fs.existsSync(result.normalizationArtifactPath)).toBe(true);
  });
});
