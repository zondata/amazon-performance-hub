import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import { afterEach, describe, expect, it } from 'vitest';

import {
  parseValidatedSpApiSearchTermsRawArtifact,
  readSpApiSearchTermsRawArtifact,
  resolveSpApiSearchTermsRawArtifactPath,
  runFirstSpApiSearchTermsParseIngest,
  streamParseSpApiSearchTermsRawArtifact,
} from './firstSearchTermsParseIngest';

const tempDirs: string[] = [];

const makeTempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spapi-search-terms-'));
  tempDirs.push(dir);
  return dir;
};

const SEARCH_TERMS_JSON = JSON.stringify({
  reportSpecification: {
    reportType: 'GET_BRAND_ANALYTICS_SEARCH_TERMS_REPORT',
    reportOptions: {
      reportPeriod: 'WEEK',
    },
    dataStartTime: '2026-04-05',
    dataEndTime: '2026-04-11',
    marketplaceIds: ['ATVPDKIKX0DER'],
  },
  dataByDepartmentAndSearchTerm: [
    {
      departmentName: 'Amazon.com',
      searchTerm: 'vitamin c serum',
      searchFrequencyRank: 1,
      clickedAsin: 'B0TESTASIN',
      clickShareRank: 1,
      clickShare: 0.0771,
      conversionShare: 0.0874,
    },
  ],
});

const REAL_OBSERVED_SEARCH_TERMS_JSON = JSON.stringify({
  reportSpecification: {
    reportType: 'GET_BRAND_ANALYTICS_SEARCH_TERMS_REPORT',
    reportOptions: {
      reportPeriod: 'WEEK',
    },
    dataStartTime: '2026-04-05',
    dataEndTime: '2026-04-11',
    marketplaceIds: ['ATVPDKIKX0DER'],
  },
  dataByDepartmentAndSearchTerm: [
    {
      departmentName: 'Amazon.com',
      searchTerm: 'xxx-videos',
      searchFrequencyRank: 9,
      clickedAsin: 'B09ZJ98FFR',
      clickedItemName: 'XX/XY',
      clickShareRank: 1,
      clickShare: 0.3183,
      conversionShare: null,
    },
  ],
});

const WRONG_FAMILY_JSON = JSON.stringify({
  reportSpecification: {
    reportType: 'GET_BRAND_ANALYTICS_SEARCH_QUERY_PERFORMANCE_REPORT',
    reportOptions: {
      reportPeriod: 'WEEK',
      asin: 'B0TESTASIN',
    },
    dataStartTime: '2026-04-05',
    dataEndTime: '2026-04-11',
    marketplaceIds: ['ATVPDKIKX0DER'],
  },
  dataByAsin: [],
});

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('sp-api Search Terms parse+ingest boundary', () => {
  it('resolves the deterministic raw artifact path from report id', async () => {
    const rawDir = makeTempDir();
    const rawPath = path.join(rawDir, 'report-search-123.search-terms.raw.json');
    fs.writeFileSync(rawPath, SEARCH_TERMS_JSON);

    await expect(
      resolveSpApiSearchTermsRawArtifactPath({
        reportId: 'search-123',
        rawOutputRoot: rawDir,
      })
    ).resolves.toEqual({
      reportId: 'search-123',
      inputFilePath: rawPath,
    });
  });

  it('raises a typed error when the raw artifact is missing', async () => {
    await expect(
      resolveSpApiSearchTermsRawArtifactPath({
        rawFilePath: '/tmp/does-not-exist/report-missing.search-terms.raw.json',
      })
    ).rejects.toMatchObject({
      name: 'SpApiSearchTermsIngestError',
      code: 'artifact_not_found',
    });
  });

  it('rejects non-Search-Terms family content for the bounded marketplace-window path', async () => {
    const rawDir = makeTempDir();
    const rawPath = path.join(rawDir, 'report-search-123.search-terms.raw.json');
    fs.writeFileSync(rawPath, WRONG_FAMILY_JSON);

    await expect(
      runFirstSpApiSearchTermsParseIngest({
        rawFilePath: rawPath,
        env: {
          APP_ACCOUNT_ID: 'test-account',
          APP_MARKETPLACE: 'US',
        },
        ingestImpl: async () => ({ status: 'ok', uploadId: 'unused', rowCount: 0 }),
      })
    ).rejects.toMatchObject({
      name: 'SpApiSearchTermsIngestError',
      code: 'validation_failed',
    });
  });

  it('builds a safe successful parse summary without exposing raw search terms', async () => {
    const rawDir = makeTempDir();
    const rawPath = path.join(rawDir, 'report-search-123.search-terms.raw.json');
    fs.writeFileSync(rawPath, SEARCH_TERMS_JSON);

    const summary = await runFirstSpApiSearchTermsParseIngest({
      rawFilePath: rawPath,
      env: {
        APP_ACCOUNT_ID: 'test-account',
        APP_MARKETPLACE: 'US',
      },
      ingestImpl: async () => ({
        status: 'ok',
        uploadId: 'upload-123',
        rowCount: 1,
        coverageStart: '2026-04-05',
        coverageEnd: '2026-04-11',
        warningsCount: 0,
        marketplaceId: 'ATVPDKIKX0DER',
      }),
    });

    const serialized = JSON.stringify(summary);
    expect(summary.reportId).toBe('search-123');
    expect(summary.marketplace).toBe('US');
    expect(summary.marketplaceId).toBe('ATVPDKIKX0DER');
    expect(summary.coverageStart).toBe('2026-04-05');
    expect(summary.coverageEnd).toBe('2026-04-11');
    expect(summary.rowCount).toBe(1);
    expect(summary.uploadId).toBe('upload-123');
    expect(summary.warningsCount).toBe(0);
    expect(serialized).not.toContain('vitamin c serum');
    expect(serialized).not.toContain('Amazon.com');
  });

  it('reads gzip Search Terms artifacts and exposes the filename hint without the gzip suffix', async () => {
    const rawDir = makeTempDir();
    const rawPath = path.join(rawDir, 'report-search-123.search-terms.raw.json.gz');
    fs.writeFileSync(rawPath, gzipSync(SEARCH_TERMS_JSON));

    const artifact = await readSpApiSearchTermsRawArtifact({ inputFilePath: rawPath });

    expect(artifact.decompressed).toBe(true);
    expect(artifact.filenameHint).toBe('report-search-123.search-terms.raw.json');
  });

  it('parses the official Search Terms artifact shape through the streaming parser without requiring one full JSON string load', async () => {
    const rawDir = makeTempDir();
    const rawPath = path.join(rawDir, 'report-search-stream.search-terms.raw.json.gz');
    fs.writeFileSync(rawPath, gzipSync(SEARCH_TERMS_JSON));

    const events: string[] = [];
    let totalRows = 0;

    for await (const event of streamParseSpApiSearchTermsRawArtifact({
      inputFilePath: rawPath,
      rowBatchSize: 1,
    })) {
      events.push(event.type);
      if (event.type === 'rows') {
        totalRows += event.rows.length;
      }
    }

    expect(events).toEqual(['metadata', 'rows']);
    expect(totalRows).toBe(1);
  });

  it('can still materialize a parsed result for tests and fallback callers', async () => {
    const rawDir = makeTempDir();
    const rawPath = path.join(rawDir, 'report-search-parsed.search-terms.raw.json');
    fs.writeFileSync(rawPath, SEARCH_TERMS_JSON);

    const parsed = await parseValidatedSpApiSearchTermsRawArtifact({
      inputFilePath: rawPath,
    });

    expect(parsed.marketplaceId).toBe('ATVPDKIKX0DER');
    expect(parsed.coverageStart).toBe('2026-04-05');
    expect(parsed.coverageEnd).toBe('2026-04-11');
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.search_term_raw).toBe('vitamin c serum');
  });

  it('accepts the real observed Search Terms row shape when conversionShare is explicitly null', async () => {
    const rawDir = makeTempDir();
    const rawPath = path.join(rawDir, 'report-search-real.search-terms.raw.json');
    fs.writeFileSync(rawPath, REAL_OBSERVED_SEARCH_TERMS_JSON);

    const parsed = await parseValidatedSpApiSearchTermsRawArtifact({
      inputFilePath: rawPath,
    });

    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.search_term_raw).toBe('xxx-videos');
    expect(parsed.rows[0]?.clicked_asin).toBe('B09ZJ98FFR');
    expect(parsed.rows[0]?.conversion_share).toBe(0);
  });
});
