import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { ingestSpCampaignRaw } from '../../ingest/ingestSpCampaignRaw';
import { mapUpload } from '../../mapping/db';
import {
  buildCampaignIngestGateCsv,
  loadAdsCampaignIngestGateArtifact,
  runAdsApiCampaignIngestGate,
} from './campaignIngestGate';
import { AdsApiCampaignIngestGateError } from './types';

vi.mock('../../ingest/ingestSpCampaignRaw', () => ({
  ingestSpCampaignRaw: vi.fn(),
}));

vi.mock('../../mapping/db', () => ({
  mapUpload: vi.fn(),
}));

const ingestSpCampaignRawMock = vi.mocked(ingestSpCampaignRaw);
const mapUploadMock = vi.mocked(mapUpload);

const tempDirs: string[] = [];

afterEach(() => {
  ingestSpCampaignRawMock.mockReset();
  mapUploadMock.mockReset();

  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

const makeTempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ads-campaign-gate-'));
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
      campaignStatus: 'ENABLED',
      campaignBudgetType: 'DAILY_BUDGET',
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
      campaignStatus: 'PAUSED',
      campaignBudgetType: 'DAILY_BUDGET',
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
        campaignRowCount: baseRows.length,
        targetRowCount: 0,
        campaignRows: baseRows,
        targetRows: [],
        dailySummary: [],
        ...overrides,
      },
      null,
      2
    )
  );

  return { artifactPath, dir };
};

describe('campaign ingest gate', () => {
  it('fails when the persisted artifact is missing', () => {
    const dir = makeTempDir();

    expect(() =>
      loadAdsCampaignIngestGateArtifact({
        artifactPath: path.join(dir, 'missing.json'),
      })
    ).toThrowError('Missing required persisted artifact:');
  });

  it('fails when campaign rows are empty', () => {
    const { artifactPath } = writePersistedArtifact({
      campaignRowCount: 0,
      campaignRows: [],
    });

    expect(() =>
      loadAdsCampaignIngestGateArtifact({
        artifactPath,
      })
    ).toThrowError('Persisted artifact must contain at least 1 campaign row.');
  });

  it('fails when campaign row metadata does not match the artifact', () => {
    const { artifactPath } = writePersistedArtifact({}, [{ profileId: 'wrong' }]);

    expect(() =>
      loadAdsCampaignIngestGateArtifact({
        artifactPath,
      })
    ).toThrowError('Campaign row profileId mismatch at row 1.');
  });

  it('normalizes sink failures', async () => {
    const { artifactPath, dir } = writePersistedArtifact();
    ingestSpCampaignRawMock.mockRejectedValueOnce(new Error('network down'));

    await expect(
      runAdsApiCampaignIngestGate({
        artifactPath,
        tempCsvPath: path.join(dir, 'gate.csv'),
        gateRunId: '2026-04-17T08:15:30.123Z',
      })
    ).rejects.toMatchObject({
      code: 'sink_failed',
      message: 'Campaign ingest sink failed: network down',
    } satisfies Partial<AdsApiCampaignIngestGateError>);
  });

  it('writes a gate CSV and reuses the current campaign ingest sink', async () => {
    const { artifactPath, dir } = writePersistedArtifact();
    const tempCsvPath = path.join(dir, 'gate.csv');

    ingestSpCampaignRawMock.mockResolvedValueOnce({
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

    const result = await runAdsApiCampaignIngestGate({
      artifactPath,
      tempCsvPath,
      gateRunId: '2026-04-17T08:15:30.123Z',
    });

    expect(result.campaignRowCount).toBe(2);
    expect(result.sinkResult.uploadId).toBe('upload-123');
    expect(result.sinkResult.factRows).toBe(2);
    expect(ingestSpCampaignRawMock).toHaveBeenCalledWith(
      tempCsvPath,
      'sourbear',
      '2026-04-16T08:15:30.123Z'
    );
    expect(mapUploadMock).toHaveBeenCalledWith('upload-123', 'sp_campaign');

    const writtenCsv = fs.readFileSync(tempCsvPath, 'utf8');
    expect(writtenCsv).toContain('Gate Run Id');
    expect(writtenCsv).toContain('Campaign A');
    expect(writtenCsv).toContain('2026-04-17T08:15:30.123Z');
  });

  it('builds a CSV shape the current campaign parser can consume', () => {
    const csv = buildCampaignIngestGateCsv({
      gateRunId: '2026-04-17T08:15:30.123Z',
      campaignRows: [
        {
          appAccountId: 'sourbear',
          appMarketplace: 'US',
          profileId: '3362351578582214',
          campaignId: '10',
          campaignName: 'Campaign, A',
          campaignStatus: 'ENABLED',
          campaignBudgetType: 'DAILY_BUDGET',
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

    expect(csv).toContain('"Campaign, A"');
    expect(csv.split('\n')[0]).toContain('Campaign Name');
    expect(csv).toContain('2026-04-17T08:15:30.123Z');
  });
});
