import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseSpTargetingReport } from '../../ads/parseSpTargetingReport';
import { ingestSpTargetingRaw } from '../../ingest/ingestSpTargetingRaw';
import { mapUpload } from '../../mapping/db';
import {
  buildTargetIngestGateWorkbook,
  loadAdsTargetIngestGateArtifact,
  runAdsApiTargetIngestGate,
  writeTargetIngestGateWorkbook,
} from './targetIngestGate';
import { AdsApiTargetIngestGateError } from './types';

vi.mock('../../ingest/ingestSpTargetingRaw', () => ({
  ingestSpTargetingRaw: vi.fn(),
}));

vi.mock('../../mapping/db', () => ({
  mapUpload: vi.fn(),
}));

const ingestSpTargetingRawMock = vi.mocked(ingestSpTargetingRaw);
const mapUploadMock = vi.mocked(mapUpload);

const tempDirs: string[] = [];

afterEach(() => {
  ingestSpTargetingRawMock.mockReset();
  mapUploadMock.mockReset();

  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

const makeTempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ads-target-gate-'));
  tempDirs.push(dir);
  return dir;
};

const writePersistedArtifact = (
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
      adGroupId: '100',
      adGroupName: 'Ad Group A',
      targetId: '1000',
      targetingExpression: 'asin="B001TEST"',
      matchType: 'EXACT',
      targetStatus: 'ENABLED',
      date: '2026-04-10',
      impressions: 10,
      clicks: 2,
      cost: 3.25,
      attributedSales14d: 8.5,
      attributedConversions14d: 1,
      currencyCode: 'USD',
    },
    {
      appAccountId: 'sourbear',
      appMarketplace: 'US',
      profileId: '3362351578582214',
      campaignId: '20',
      campaignName: 'Campaign B',
      adGroupId: '200',
      adGroupName: 'Ad Group B',
      targetId: '2000',
      targetingExpression: 'keyword a',
      matchType: 'BROAD',
      targetStatus: 'PAUSED',
      date: '2026-04-11',
      impressions: 12,
      clicks: 3,
      cost: 4.25,
      attributedSales14d: 9.5,
      attributedConversions14d: 2,
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
        targetRowCount: baseRows.length,
        campaignRows: [],
        targetRows: baseRows,
        dailySummary: [],
        ...overrides,
      },
      null,
      2
    )
  );

  return { artifactPath, dir };
};

describe('target ingest gate', () => {
  it('fails when the persisted artifact is missing', () => {
    const dir = makeTempDir();

    expect(() =>
      loadAdsTargetIngestGateArtifact({
        artifactPath: path.join(dir, 'missing.json'),
      })
    ).toThrowError('Missing required persisted artifact:');
  });

  it('fails when target rows are empty', () => {
    const { artifactPath } = writePersistedArtifact({
      targetRowCount: 0,
      targetRows: [],
    });

    expect(() =>
      loadAdsTargetIngestGateArtifact({
        artifactPath,
      })
    ).toThrowError('Persisted artifact must contain at least 1 target row.');
  });

  it('fails when target row metadata does not match the artifact', () => {
    const { artifactPath } = writePersistedArtifact({}, [{ profileId: 'wrong' }]);

    expect(() =>
      loadAdsTargetIngestGateArtifact({
        artifactPath,
      })
    ).toThrowError('Target row profileId mismatch at row 1.');
  });

  it('normalizes sink failures', async () => {
    const { artifactPath, dir } = writePersistedArtifact();
    ingestSpTargetingRawMock.mockRejectedValueOnce(new Error('network down'));

    await expect(
      runAdsApiTargetIngestGate({
        artifactPath,
        tempXlsxPath: path.join(dir, 'gate.xlsx'),
        gateRunId: '2026-04-17T08:15:30.123Z',
      })
    ).rejects.toMatchObject<Partial<AdsApiTargetIngestGateError>>({
      code: 'sink_failed',
      message: 'Target ingest sink failed: network down',
    });
  });

  it('writes a gate workbook and reuses the current targeting ingest sink', async () => {
    const { artifactPath, dir } = writePersistedArtifact();
    const tempXlsxPath = path.join(dir, 'gate.xlsx');

    ingestSpTargetingRawMock.mockResolvedValueOnce({
      status: 'ok',
      uploadId: 'upload-123',
      coverageStart: '2026-04-10',
      coverageEnd: '2026-04-11',
      rowCount: 2,
    });
    mapUploadMock.mockResolvedValueOnce({
      status: 'ok',
      factRows: 2,
      issueRows: 0,
    });

    const result = await runAdsApiTargetIngestGate({
      artifactPath,
      tempXlsxPath,
      gateRunId: '2026-04-17T08:15:30.123Z',
    });

    expect(result.targetRowCount).toBe(2);
    expect(result.sinkResult.uploadId).toBe('upload-123');
    expect(result.sinkResult.factRows).toBe(2);
    expect(ingestSpTargetingRawMock).toHaveBeenCalledWith(
      tempXlsxPath,
      'sourbear',
      '2026-04-16T08:15:30.123Z'
    );
    expect(mapUploadMock).toHaveBeenCalledWith('upload-123', 'sp_targeting');
  });

  it('builds a workbook shape the current targeting parser can consume', () => {
    const dir = makeTempDir();
    const workbookPath = path.join(dir, 'gate.xlsx');

    writeTargetIngestGateWorkbook({
      tempXlsxPath: workbookPath,
      gateRunId: '2026-04-17T08:15:30.123Z',
      targetRows: [
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
          matchType: 'PHRASE',
          targetStatus: 'ENABLED',
          date: '2026-04-10',
          impressions: 10,
          clicks: 2,
          cost: 3.25,
          attributedSales14d: 8.5,
          attributedConversions14d: 1,
          currencyCode: 'USD',
        },
      ],
    });

    const parsed = parseSpTargetingReport(workbookPath);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.campaign_name_raw).toBe('Campaign A');
    expect(parsed.rows[0]?.ad_group_name_raw).toBe('Ad Group A');
    expect(parsed.rows[0]?.targeting_raw).toBe('keyword a');
    expect(parsed.rows[0]?.match_type_norm).toBe('PHRASE');
  });
});
