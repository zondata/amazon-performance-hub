import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import { afterEach, describe, expect, it } from 'vitest';

import {
  buildSpApiSqpMaterializedCsvPath,
  ensureSpApiSqpIngestCsvPath,
  readSpApiSqpRawArtifact,
  resolveSpApiSqpRawArtifactPath,
  runFirstSpApiSqpParseIngest,
} from './firstSqpParseIngest';

const tempDirs: string[] = [];

const makeTempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spapi-sqp-'));
  tempDirs.push(dir);
  return dir;
};

const ASIN_SQP_CSV = `ASIN or Product=["B0TESTASIN01"],Reporting Range=["Weekly"],Select week=["Week 6 | 2026-02-01 - 2026-02-07 2026"]
Reporting Date,Search Query,Search Query Score,Search Query Volume,Impressions: Total Count,Impressions: ASIN Count,Impressions: ASIN Share,Clicks: Total Count,Click Rate %,Clicks: ASIN Count,Clicks: ASIN Share
2026-02-07,vitamin c serum,320,10000,1000,180,18,72,0.72,16,22.22
`;

const BRAND_SQP_CSV = `Brand=["sourbear"],Reporting Range=["Weekly"],Select week=["Week 6 | 2026-02-01 - 2026-02-07 2026"]
Reporting Date,Search Query,Search Query Score,Search Query Volume,Impressions: Total Count,Impressions: Brand Count,Impressions: Brand Share,Clicks: Total Count,Click Rate %,Clicks: Brand Count,Clicks: Brand Share
2026-02-07,vitamin c serum,320,10000,1000,180,18,72,0.72,16,22.22
`;

const ASIN_SQP_JSON = JSON.stringify({
  reportSpecification: {
    reportType: 'GET_BRAND_ANALYTICS_SEARCH_QUERY_PERFORMANCE_REPORT',
    reportOptions: {
      reportPeriod: 'WEEK',
      asin: 'B0TESTASIN01',
    },
    dataStartTime: '2026-02-01',
    dataEndTime: '2026-02-07',
    marketplaceIds: ['ATVPDKIKX0DER'],
  },
  dataByAsin: [
    {
      startDate: '2026-02-01',
      endDate: '2026-02-07',
      asin: 'B0TESTASIN01',
      searchQueryData: {
        searchQuery: 'vitamin c serum',
        searchQueryScore: 320,
        searchQueryVolume: 10000,
      },
      impressionData: {
        totalQueryImpressionCount: 1000,
        asinImpressionCount: 180,
        asinImpressionShare: 0.18,
      },
      clickData: {
        totalClickCount: 72,
        totalClickRate: 0.72,
        asinClickCount: 16,
        asinClickShare: 0.2222,
        totalMedianClickPrice: { amount: 12.34, currencyCode: 'USD' },
        asinMedianClickPrice: { amount: 13.45, currencyCode: 'USD' },
        totalSameDayShippingClickCount: 1,
        totalOneDayShippingClickCount: 2,
        totalTwoDayShippingClickCount: 3,
      },
      cartAddData: {
        totalCartAddCount: 10,
        totalCartAddRate: 0.1,
        asinCartAddCount: 4,
        asinCartAddShare: 0.4,
        totalMedianCartAddPrice: { amount: 23.45, currencyCode: 'USD' },
        asinMedianCartAddPrice: { amount: 24.56, currencyCode: 'USD' },
        totalSameDayShippingCartAddCount: 1,
        totalOneDayShippingCartAddCount: 2,
        totalTwoDayShippingCartAddCount: 3,
      },
      purchaseData: {
        totalPurchaseCount: 3,
        totalPurchaseRate: 0.03,
        asinPurchaseCount: 1,
        asinPurchaseShare: 0.3333,
        totalMedianPurchasePrice: { amount: 30.12, currencyCode: 'USD' },
        asinMedianPurchasePrice: { amount: 31.23, currencyCode: 'USD' },
        totalSameDayShippingPurchaseCount: 1,
        totalOneDayShippingPurchaseCount: 1,
        totalTwoDayShippingPurchaseCount: 1,
      },
    },
  ],
});

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('sp-api sqp parse+ingest boundary', () => {
  it('resolves the deterministic raw artifact path from report id', async () => {
    const rawDir = makeTempDir();
    const rawPath = path.join(rawDir, 'report-sqp-123.sqp.raw.csv');
    fs.writeFileSync(rawPath, ASIN_SQP_CSV);

    await expect(
      resolveSpApiSqpRawArtifactPath({
        reportId: 'sqp-123',
        rawOutputRoot: rawDir,
      })
    ).resolves.toEqual({
      reportId: 'sqp-123',
      inputFilePath: rawPath,
    });
  });

  it('raises a typed error when the raw artifact is missing', async () => {
    await expect(
      resolveSpApiSqpRawArtifactPath({
        rawFilePath: '/tmp/does-not-exist/report-missing.sqp.raw.csv',
      })
    ).rejects.toMatchObject({
      name: 'SpApiSqpIngestError',
      code: 'artifact_not_found',
    });
  });

  it('rejects non-ASIN SQP content for the bounded ASIN-window path', async () => {
    const rawDir = makeTempDir();
    const rawPath = path.join(rawDir, 'report-sqp-123.sqp.raw.csv');
    fs.writeFileSync(rawPath, BRAND_SQP_CSV);

    await expect(
      runFirstSpApiSqpParseIngest({
        rawFilePath: rawPath,
        env: {
          APP_ACCOUNT_ID: 'test-account',
          APP_MARKETPLACE: 'US',
        },
        ingestImpl: async () => ({ status: 'ok', uploadId: 'unused', rowCount: 0 }),
      })
    ).rejects.toMatchObject({
      name: 'SpApiSqpIngestError',
      code: 'validation_failed',
    });
  });

  it('builds a safe successful parse summary without exposing raw query rows', async () => {
    const rawDir = makeTempDir();
    const rawPath = path.join(rawDir, 'report-sqp-123.sqp.raw.csv');
    fs.writeFileSync(rawPath, ASIN_SQP_CSV);

    const summary = await runFirstSpApiSqpParseIngest({
      rawFilePath: rawPath,
      env: {
        APP_ACCOUNT_ID: 'test-account',
        APP_MARKETPLACE: 'US',
      },
      ingestImpl: async () => ({
        status: 'ok',
        uploadId: 'upload-123',
        rowCount: 1,
        coverageStart: '2026-02-01',
        coverageEnd: '2026-02-07',
        warningsCount: 0,
        scopeType: 'asin',
        scopeValue: 'B0TESTASIN01',
      }),
    });

    const serialized = JSON.stringify(summary);
    expect(summary.reportId).toBe('sqp-123');
    expect(summary.scopeType).toBe('asin');
    expect(summary.scopeValue).toBe('B0TESTASIN01');
    expect(summary.coverageStart).toBe('2026-02-01');
    expect(summary.coverageEnd).toBe('2026-02-07');
    expect(summary.rowCount).toBe(1);
    expect(summary.uploadId).toBe('upload-123');
    expect(summary.warningsCount).toBe(0);
    expect(serialized).not.toContain('vitamin c serum');
    expect(serialized).not.toContain('320');
  });

  it('keeps the existing upload id when SQP input was already ingested', async () => {
    const rawDir = makeTempDir();
    const rawPath = path.join(rawDir, 'report-sqp-123.sqp.raw.csv');
    fs.writeFileSync(rawPath, ASIN_SQP_CSV);

    const summary = await runFirstSpApiSqpParseIngest({
      rawFilePath: rawPath,
      env: {
        APP_ACCOUNT_ID: 'test-account',
        APP_MARKETPLACE: 'US',
      },
      ingestImpl: async () => ({
        status: 'already ingested',
        uploadId: 'existing-upload-123',
        rowCount: 1,
      }),
    });

    expect(summary.uploadId).toBe('existing-upload-123');
    expect(summary.rowCount).toBe(1);
  });

  it('reuses the bounded ingest path after materializing gzip raw artifacts to a deterministic CSV path', async () => {
    const rawDir = makeTempDir();
    const rawPath = path.join(rawDir, 'report-sqp-123.sqp.raw.csv.gz');
    fs.writeFileSync(rawPath, gzipSync(ASIN_SQP_CSV));
    const csvOutputRoot = makeTempDir();

    let observedCsvPath = '';

    const summary = await runFirstSpApiSqpParseIngest({
      rawFilePath: rawPath,
      csvOutputRoot,
      env: {
        APP_ACCOUNT_ID: 'test-account',
        APP_MARKETPLACE: 'US',
      },
      ingestImpl: async (csvPath) => {
        observedCsvPath = csvPath;
        return {
          status: 'ok',
          uploadId: 'upload-123',
          rowCount: 1,
          coverageStart: '2026-02-01',
          coverageEnd: '2026-02-07',
          warningsCount: 0,
          scopeType: 'asin',
          scopeValue: 'B0TESTASIN01',
        };
      },
    });

    expect(observedCsvPath).toBe(
      buildSpApiSqpMaterializedCsvPath({
        reportId: 'sqp-123',
        rawFilePath: rawPath,
        outputRoot: csvOutputRoot,
      })
    );
    expect(fs.existsSync(observedCsvPath)).toBe(true);
    expect(summary.uploadId).toBe('upload-123');
  });

  it('reads gzip SQP artifacts and exposes the filename hint without the gzip suffix', async () => {
    const rawDir = makeTempDir();
    const rawPath = path.join(rawDir, 'report-sqp-123.sqp.raw.csv.gz');
    fs.writeFileSync(rawPath, gzipSync(ASIN_SQP_CSV));

    const artifact = await readSpApiSqpRawArtifact({ inputFilePath: rawPath });

    expect(artifact.decompressed).toBe(true);
    expect(artifact.filenameHint).toBe('report-sqp-123.sqp.raw.csv');
    expect(artifact.text).toContain('ASIN or Product');
  });

  it('accepts the official SP-API SQP JSON artifact format through the existing parse+ingest boundary', async () => {
    const rawDir = makeTempDir();
    const rawPath = path.join(rawDir, 'report-sqp-json-123.sqp.raw.json');
    fs.writeFileSync(rawPath, ASIN_SQP_JSON);

    const summary = await runFirstSpApiSqpParseIngest({
      rawFilePath: rawPath,
      env: {
        APP_ACCOUNT_ID: 'test-account',
        APP_MARKETPLACE: 'US',
      },
      ingestImpl: async () => ({
        status: 'ok',
        uploadId: 'upload-json-123',
        rowCount: 1,
        coverageStart: '2026-02-01',
        coverageEnd: '2026-02-07',
        warningsCount: 0,
        scopeType: 'asin',
        scopeValue: 'B0TESTASIN01',
      }),
    });

    expect(summary.reportId).toBe('sqp-json-123');
    expect(summary.scopeType).toBe('asin');
    expect(summary.scopeValue).toBe('B0TESTASIN01');
    expect(summary.coverageStart).toBe('2026-02-01');
    expect(summary.coverageEnd).toBe('2026-02-07');
    expect(summary.rowCount).toBe(1);
    expect(summary.uploadId).toBe('upload-json-123');
  });

  it('writes a materialized CSV artifact for non-CSV raw inputs', async () => {
    const rawDir = makeTempDir();
    const outputRoot = makeTempDir();
    const rawPath = path.join(rawDir, 'external-artifact.raw.gz');
    fs.writeFileSync(rawPath, 'placeholder');

    const csvPath = await ensureSpApiSqpIngestCsvPath({
      rawFilePath: rawPath,
      rawText: ASIN_SQP_CSV,
      reportId: null,
      decompressed: true,
      outputRoot,
    });

    expect(fs.existsSync(csvPath)).toBe(true);
    expect(fs.readFileSync(csvPath, 'utf8')).toBe(ASIN_SQP_CSV);
  });
});
