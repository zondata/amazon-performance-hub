import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseSpAdvertisedProductReport } from '../../sp/parseSpAdvertisedProductReport';
import { ingestSpAdvertisedProductRaw } from '../../ingest/ingestSpAdvertisedProductRaw';
import {
  buildAdvertisedProductIngestGateWorkbook,
  loadAdsAdvertisedProductIngestGateArtifact,
  runAdsApiAdvertisedProductIngestGate,
  writeAdvertisedProductIngestGateWorkbook,
} from './advertisedProductIngestGate';
import { AdsApiAdvertisedProductIngestGateError } from './types';

vi.mock('../../ingest/ingestSpAdvertisedProductRaw', () => ({
  ingestSpAdvertisedProductRaw: vi.fn(),
}));

const ingestSpAdvertisedProductRawMock = vi.mocked(ingestSpAdvertisedProductRaw);
const tempDirs: string[] = [];

afterEach(() => {
  ingestSpAdvertisedProductRawMock.mockReset();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

const makeTempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ads-advertised-product-gate-'));
  tempDirs.push(dir);
  return dir;
};

const writeAdvertisedProductArtifact = (
  overrides: Partial<Record<string, unknown>> = {},
  rowOverrides: Array<Partial<Record<string, unknown>>> = []
) => {
  const dir = makeTempDir();
  const artifactPath = path.join(dir, 'ads-sp-advertised-product.normalized.json');
  const baseRows = [
    {
      appAccountId: 'sourbear',
      appMarketplace: 'US',
      profileId: '3362351578582214',
      date: '2026-04-10',
      campaignId: '10',
      campaignName: 'Campaign A',
      adGroupId: '100',
      adGroupName: 'Ad Group A',
      advertisedAsin: 'B000111',
      advertisedSku: 'SKU-1',
      impressions: 10,
      clicks: 2,
      cost: 3.25,
      attributedSales14d: 8.5,
      attributedConversions14d: 1,
      attributedUnitsOrdered14d: 2,
      currencyCode: 'USD',
    },
  ].map((row, index) => ({
    ...row,
    ...(rowOverrides[index] ?? {}),
  }));

  fs.writeFileSync(
    artifactPath,
    JSON.stringify(
      {
        schemaVersion: 'ads-api-sp-advertised-product-daily-normalized/v1',
        generatedAt: '2026-04-17T00:00:00.000Z',
        appAccountId: 'sourbear',
        appMarketplace: 'US',
        adsApiBaseUrl: 'https://advertising-api.amazon.com',
        profileId: '3362351578582214',
        requestedDateRange: {
          startDate: '2026-04-10',
          endDate: '2026-04-16',
        },
        rowCount: baseRows.length,
        normalizedAdvertisedProductRows: baseRows,
        ...overrides,
      },
      null,
      2
    )
  );

  return { artifactPath, dir };
};

describe('advertised product ingest gate', () => {
  it('fails when the advertised product artifact is missing', () => {
    const dir = makeTempDir();
    expect(() =>
      loadAdsAdvertisedProductIngestGateArtifact({
        artifactPath: path.join(dir, 'missing.json'),
      })
    ).toThrowError('Missing required advertised product artifact:');
  });

  it('fails when advertised product rows are empty', () => {
    const { artifactPath } = writeAdvertisedProductArtifact({
      rowCount: 0,
      normalizedAdvertisedProductRows: [],
    });

    expect(() =>
      loadAdsAdvertisedProductIngestGateArtifact({
        artifactPath,
      })
    ).toThrowError('Advertised product artifact must contain at least 1 row.');
  });

  it('normalizes sink failures', async () => {
    const { artifactPath, dir } = writeAdvertisedProductArtifact();
    ingestSpAdvertisedProductRawMock.mockRejectedValueOnce(new Error('network down'));

    await expect(
      runAdsApiAdvertisedProductIngestGate({
        artifactPath,
        tempXlsxPath: path.join(dir, 'gate.xlsx'),
        gateRunId: '2026-04-17T08:15:30.123Z',
      })
    ).rejects.toMatchObject({
      code: 'sink_failed',
      message: 'Advertised product ingest sink failed: network down',
    } satisfies Partial<AdsApiAdvertisedProductIngestGateError>);
  });

  it('writes a gate workbook and reuses the current advertised product ingest sink', async () => {
    const { artifactPath, dir } = writeAdvertisedProductArtifact();
    const tempXlsxPath = path.join(dir, 'gate.xlsx');

    ingestSpAdvertisedProductRawMock.mockResolvedValueOnce({
      status: 'ok',
      uploadId: 'upload-123',
      coverageStart: '2026-04-10',
      coverageEnd: '2026-04-10',
      rowCount: 1,
    });

    const result = await runAdsApiAdvertisedProductIngestGate({
      artifactPath,
      tempXlsxPath,
      gateRunId: '2026-04-17T08:15:30.123Z',
    });

    expect(result.advertisedProductRowCount).toBe(1);
    expect(result.sinkResult.uploadId).toBe('upload-123');
    expect(result.sinkResult.factRows).toBe(1);
    expect(result.sinkResult.mapStatus).toBe('not_required');
    expect(ingestSpAdvertisedProductRawMock).toHaveBeenCalledWith(
      tempXlsxPath,
      'sourbear',
      '2026-04-16T08:15:30.123Z'
    );
  });

  it('builds a workbook shape the current advertised product parser can consume', () => {
    const dir = makeTempDir();
    const workbookPath = path.join(dir, 'gate.xlsx');
    writeAdvertisedProductIngestGateWorkbook({
      tempXlsxPath: workbookPath,
      gateRunId: '2026-04-17T08:15:30.123Z',
      advertisedProductRows: [
        {
          appAccountId: 'sourbear',
          appMarketplace: 'US',
          profileId: '3362351578582214',
          date: '2026-04-10',
          campaignId: '10',
          campaignName: 'Campaign A',
          adGroupId: '100',
          adGroupName: 'Ad Group A',
          advertisedAsin: 'B000111',
          advertisedSku: 'SKU-1',
          impressions: 10,
          clicks: 2,
          cost: 3.25,
          attributedSales14d: 8.5,
          attributedConversions14d: 1,
          attributedUnitsOrdered14d: 2,
          currencyCode: 'USD',
        },
      ],
    });

    const parsed = parseSpAdvertisedProductReport(workbookPath);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.campaign_name_raw).toBe('Campaign A');
    expect(parsed.rows[0]?.advertised_asin_norm).toBe('B000111');
    expect(parsed.rows[0]?.sku_raw).toBe('SKU-1');
  });

  it('produces a workbook instance', () => {
    const workbook = buildAdvertisedProductIngestGateWorkbook({
      gateRunId: '2026-04-17T08:15:30.123Z',
      advertisedProductRows: [
        {
          appAccountId: 'sourbear',
          appMarketplace: 'US',
          profileId: '3362351578582214',
          date: '2026-04-10',
          campaignId: '10',
          campaignName: 'Campaign A',
          adGroupId: null,
          adGroupName: null,
          advertisedAsin: 'B000111',
          advertisedSku: null,
          impressions: 10,
          clicks: 2,
          cost: 3.25,
          attributedSales14d: 8.5,
          attributedConversions14d: 1,
          attributedUnitsOrdered14d: 2,
          currencyCode: 'USD',
        },
      ],
    });

    expect(workbook.SheetNames).toEqual(['Sheet1']);
  });
});
