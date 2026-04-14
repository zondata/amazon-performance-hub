import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildFirstSearchTermsReportRequestBody,
  runFirstSpApiSearchTermsRealPullAndIngest,
} from './firstSearchTermsRealPull';

const tempDirs: string[] = [];

const makeTempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spapi-search-terms-real-'));
  tempDirs.push(dir);
  return dir;
};

const makeEnv = () => ({
  SP_API_LWA_CLIENT_ID: 'client-id',
  SP_API_LWA_CLIENT_SECRET: 'client-secret',
  SP_API_REFRESH_TOKEN: 'refresh-token',
  SP_API_REGION: 'na',
  SP_API_MARKETPLACE_ID: 'ATVPDKIKX0DER',
});

const makeTokenTransport = () =>
  vi.fn(async () => ({
    status: 200,
    json: {
      access_token: 'access-token',
      token_type: 'bearer',
      expires_in: 3600,
    },
  }));

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

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('sp-api Search Terms first real pull boundary', () => {
  it('validates one bounded Sunday-to-Saturday marketplace week request body', () => {
    expect(
      buildFirstSearchTermsReportRequestBody({
        marketplaceId: 'ATVPDKIKX0DER',
        startDate: '2026-04-05',
        endDate: '2026-04-11',
      })
    ).toEqual({
      reportType: 'GET_BRAND_ANALYTICS_SEARCH_TERMS_REPORT',
      marketplaceIds: ['ATVPDKIKX0DER'],
      dataStartTime: '2026-04-05',
      dataEndTime: '2026-04-11',
      reportOptions: {
        reportPeriod: 'WEEK',
      },
    });
  });

  it('fails clearly when polling never reaches a terminal status', async () => {
    await expect(
      runFirstSpApiSearchTermsRealPullAndIngest({
        startDate: '2026-04-05',
        endDate: '2026-04-11',
        maxAttempts: 2,
        pollIntervalMs: 0,
        envSource: makeEnv(),
        tokenTransport: makeTokenTransport(),
        requestApiTransport: vi.fn(async () => ({
          status: 202,
          json: { reportId: 'search-123' },
        })),
        statusApiTransport: vi.fn(async () => ({
          status: 200,
          json: {
            reportId: 'search-123',
            reportType: 'GET_BRAND_ANALYTICS_SEARCH_TERMS_REPORT',
            processingStatus: 'IN_PROGRESS',
          },
        })),
        wait: vi.fn(async () => undefined),
      })
    ).rejects.toMatchObject({
      name: 'SpApiRequestError',
      code: 'api_response_error',
    });
  });

  it('fails clearly when the terminal report omits reportDocumentId', async () => {
    await expect(
      runFirstSpApiSearchTermsRealPullAndIngest({
        startDate: '2026-04-05',
        endDate: '2026-04-11',
        envSource: makeEnv(),
        tokenTransport: makeTokenTransport(),
        requestApiTransport: vi.fn(async () => ({
          status: 202,
          json: { reportId: 'search-123' },
        })),
        statusApiTransport: vi.fn(async () => ({
          status: 200,
          json: {
            reportId: 'search-123',
            reportType: 'GET_BRAND_ANALYTICS_SEARCH_TERMS_REPORT',
            processingStatus: 'DONE',
          },
        })),
      })
    ).rejects.toMatchObject({
      name: 'SpApiRequestError',
      code: 'api_response_error',
    });
  });

  it('downloads the raw artifact and hands it into the existing Search Terms parse+ingest boundary', async () => {
    const outputRoot = makeTempDir();
    const parseIngestImpl = vi.fn(async ({ rawFilePath, reportId }) => {
      expect(reportId).toBe('search-123');
      expect(rawFilePath).toBe(
        path.resolve(outputRoot, 'report-search-123.search-terms.raw.json')
      );
      expect(fs.existsSync(rawFilePath!)).toBe(true);
      expect(fs.readFileSync(rawFilePath!, 'utf8')).toBe(SEARCH_TERMS_JSON);

      return {
        endpoint: 'spApiSearchTermsParseAndIngest',
        reportId: 'search-123',
        inputFilePath: rawFilePath!,
        marketplace: 'US',
        marketplaceId: 'ATVPDKIKX0DER',
        coverageStart: '2026-04-05',
        coverageEnd: '2026-04-11',
        rowCount: 1,
        uploadId: 'upload-123',
        warningsCount: 0,
      };
    });

    const summary = await runFirstSpApiSearchTermsRealPullAndIngest({
      startDate: '2026-04-05',
      endDate: '2026-04-11',
      envSource: makeEnv(),
      tokenTransport: makeTokenTransport(),
      requestApiTransport: vi.fn(async () => ({
        status: 202,
        json: { reportId: 'search-123' },
      })),
      statusApiTransport: vi.fn(async () => ({
        status: 200,
        json: {
          reportId: 'search-123',
          reportType: 'GET_BRAND_ANALYTICS_SEARCH_TERMS_REPORT',
          processingStatus: 'DONE',
          reportDocumentId: 'doc-123',
        },
      })),
      metadataApiTransport: vi.fn(async () => ({
        status: 200,
        json: {
          reportDocumentId: 'doc-123',
          url: 'https://secret.example.com/presigned-download',
        },
      })),
      downloadTransport: vi.fn(async () => ({
        status: 200,
        body: Buffer.from(SEARCH_TERMS_JSON),
        headers: {
          'content-type': 'application/json; charset=utf-8',
        },
      })),
      outputRoot,
      parseIngestImpl,
    });

    expect(summary).toEqual({
      endpoint: 'spApiSearchTermsFirstRealPullAndIngest',
      reportId: 'search-123',
      reportDocumentId: 'doc-123',
      rawArtifactPath: path.resolve(outputRoot, 'report-search-123.search-terms.raw.json'),
      marketplace: 'US',
      marketplaceId: 'ATVPDKIKX0DER',
      coverageStart: '2026-04-05',
      coverageEnd: '2026-04-11',
      rowCount: 1,
      uploadId: 'upload-123',
      warningsCount: 0,
    });
  });
});
