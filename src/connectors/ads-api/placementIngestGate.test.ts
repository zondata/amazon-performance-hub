import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseSpPlacementReport } from '../../ads/parseSpPlacementReport';
import { ingestSpPlacementRaw } from '../../ingest/ingestSpPlacementRaw';
import { mapUpload } from '../../mapping/db';
import {
  buildPlacementIngestGateWorkbook,
  loadAdsPlacementIngestGateArtifact,
  runAdsApiPlacementIngestGate,
  writePlacementIngestGateWorkbook,
} from './placementIngestGate';
import { AdsApiPlacementIngestGateError } from './types';

vi.mock('../../ingest/ingestSpPlacementRaw', () => ({
  ingestSpPlacementRaw: vi.fn(),
}));

vi.mock('../../mapping/db', () => ({
  mapUpload: vi.fn(),
}));

const ingestSpPlacementRawMock = vi.mocked(ingestSpPlacementRaw);
const mapUploadMock = vi.mocked(mapUpload);
const tempDirs: string[] = [];

afterEach(() => {
  ingestSpPlacementRawMock.mockReset();
  mapUploadMock.mockReset();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

const makeTempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ads-placement-gate-'));
  tempDirs.push(dir);
  return dir;
};

const writePlacementArtifact = (
  overrides: Partial<Record<string, unknown>> = {},
  rowOverrides: Array<Partial<Record<string, unknown>>> = []
) => {
  const dir = makeTempDir();
  const artifactPath = path.join(dir, 'ads-sp-daily.persisted.json');
  const baseRows = [
    {
      appAccountId: 'sourbear',
      appMarketplace: 'US',
      profileId: '3362351578582214',
      campaignId: '10',
      campaignName: 'Campaign A',
      campaignBiddingStrategy: 'dynamic bids - down only',
      placementClassification: 'TOP_OF_SEARCH',
      placementRaw: 'Top of search (first page)',
      placementCode: 'TOS',
      date: '2026-04-10',
      impressions: 10,
      clicks: 2,
      cost: 3.25,
      attributedSales14d: 8.5,
      attributedConversions14d: 1,
      attributedUnitsOrdered14d: 2,
      costPerClick: 1.625,
      clickThroughRate: 0.2,
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
        schemaVersion: 'ads-api-sp-daily-persisted/v1',
        generatedAt: '2026-04-17T00:00:00.000Z',
        appAccountId: 'sourbear',
        appMarketplace: 'US',
        adsApiBaseUrl: 'https://advertising-api.amazon.com',
        profileId: '3362351578582214',
        requestedDateRange: {
          startDate: '2026-04-10',
          endDate: '2026-04-16',
        },
        campaignRowCount: 0,
        targetRowCount: 0,
        placementRowCount: baseRows.length,
        campaignRows: [],
        targetRows: [],
        placementRows: baseRows,
        dailySummary: [],
        ...overrides,
      },
      null,
      2
    )
  );

  return { artifactPath, dir };
};

describe('placement ingest gate', () => {
  it('fails when the placement artifact is missing', () => {
    const dir = makeTempDir();
    expect(() =>
      loadAdsPlacementIngestGateArtifact({
        artifactPath: path.join(dir, 'missing.json'),
      })
    ).toThrowError('Missing required placement artifact:');
  });

  it('fails when placement rows are empty', () => {
    const { artifactPath } = writePlacementArtifact({
      placementRowCount: 0,
      placementRows: [],
    });

    expect(() =>
      loadAdsPlacementIngestGateArtifact({
        artifactPath,
      })
    ).toThrowError('Placement artifact must contain at least 1 placement row.');
  });

  it('normalizes sink failures', async () => {
    const { artifactPath, dir } = writePlacementArtifact();
    ingestSpPlacementRawMock.mockRejectedValueOnce(new Error('network down'));

    await expect(
      runAdsApiPlacementIngestGate({
        artifactPath,
        tempXlsxPath: path.join(dir, 'gate.xlsx'),
        gateRunId: '2026-04-17T08:15:30.123Z',
      })
    ).rejects.toMatchObject({
      code: 'sink_failed',
      message: 'Placement ingest sink failed: network down',
    } satisfies Partial<AdsApiPlacementIngestGateError>);
  });

  it('writes a gate workbook and reuses the current placement ingest sink', async () => {
    const { artifactPath, dir } = writePlacementArtifact();
    const tempXlsxPath = path.join(dir, 'gate.xlsx');

    ingestSpPlacementRawMock.mockResolvedValueOnce({
      status: 'ok',
      uploadId: 'upload-123',
      coverageStart: '2026-04-10',
      coverageEnd: '2026-04-10',
      rowCount: 1,
    });
    mapUploadMock.mockResolvedValueOnce({
      status: 'ok',
      factRows: 1,
      issueRows: 0,
    });

    const result = await runAdsApiPlacementIngestGate({
      artifactPath,
      tempXlsxPath,
      gateRunId: '2026-04-17T08:15:30.123Z',
    });

    expect(result.placementRowCount).toBe(1);
    expect(result.sinkResult.uploadId).toBe('upload-123');
    expect(result.sinkResult.factRows).toBe(1);
    expect(ingestSpPlacementRawMock).toHaveBeenCalledWith(
      tempXlsxPath,
      'sourbear',
      '2026-04-16T08:15:30.123Z'
    );
    expect(mapUploadMock).toHaveBeenCalledWith('upload-123', 'sp_placement');
  });

  it('builds a workbook shape the current placement parser can consume', () => {
    const dir = makeTempDir();
    const workbookPath = path.join(dir, 'gate.xlsx');
    writePlacementIngestGateWorkbook({
      tempXlsxPath: workbookPath,
      gateRunId: '2026-04-17T08:15:30.123Z',
      placementRows: [
        {
          appAccountId: 'sourbear',
          appMarketplace: 'US',
          profileId: '3362351578582214',
          campaignId: '10',
          campaignName: 'Campaign A',
          campaignBiddingStrategy: 'dynamic bids - down only',
          placementClassification: 'TOP_OF_SEARCH',
          placementRaw: 'Top of search (first page)',
          placementCode: 'TOS',
          date: '2026-04-10',
          impressions: 10,
          clicks: 2,
          cost: 3.25,
          attributedSales14d: 8.5,
          attributedConversions14d: 1,
          attributedUnitsOrdered14d: 2,
          costPerClick: 1.625,
          clickThroughRate: 0.2,
          currencyCode: 'USD',
        },
      ],
    });

    const parsed = parseSpPlacementReport(workbookPath);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.campaign_name_raw).toBe('Campaign A');
    expect(parsed.rows[0]?.placement_raw).toBe('Top of search (first page)');
    expect(parsed.rows[0]?.placement_code).toBe('TOS');
  });

  it('produces a workbook instance', () => {
    const workbook = buildPlacementIngestGateWorkbook({
      gateRunId: '2026-04-17T08:15:30.123Z',
      placementRows: [
        {
          appAccountId: 'sourbear',
          appMarketplace: 'US',
          profileId: '3362351578582214',
          campaignId: '10',
          campaignName: 'Campaign A',
          campaignBiddingStrategy: null,
          placementClassification: 'PRODUCT_PAGES',
          placementRaw: 'Product pages',
          placementCode: 'PP',
          date: '2026-04-10',
          impressions: 10,
          clicks: 2,
          cost: 3.25,
          attributedSales14d: 8.5,
          attributedConversions14d: 1,
          attributedUnitsOrdered14d: 2,
          costPerClick: null,
          clickThroughRate: null,
          currencyCode: 'USD',
        },
      ],
    });

    expect(workbook.SheetNames).toEqual(['Sheet1']);
  });
});
