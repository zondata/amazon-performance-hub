import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildFirstSqpReportRequestBody,
  runFirstSpApiSqpRealPullAndIngest,
} from './firstSqpRealPull';

const tempDirs: string[] = [];

const makeTempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spapi-sqp-real-'));
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

const ASIN_SQP_JSON = JSON.stringify({
  reportSpecification: {
    reportType: 'GET_BRAND_ANALYTICS_SEARCH_QUERY_PERFORMANCE_REPORT',
      reportOptions: {
        reportPeriod: 'WEEK',
        asin: 'B0TESTA123',
      },
    dataStartTime: '2026-02-01',
    dataEndTime: '2026-02-07',
    marketplaceIds: ['ATVPDKIKX0DER'],
  },
  dataByAsin: [
    {
      startDate: '2026-02-01',
      endDate: '2026-02-07',
      asin: 'B0TESTA123',
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

describe('sp-api sqp first real pull boundary', () => {
  it('validates one bounded Sunday-to-Saturday ASIN week request body', () => {
    expect(
      buildFirstSqpReportRequestBody({
        marketplaceId: 'ATVPDKIKX0DER',
        asin: 'b0testasin',
        startDate: '2026-02-01',
        endDate: '2026-02-07',
      })
    ).toEqual({
      reportType: 'GET_BRAND_ANALYTICS_SEARCH_QUERY_PERFORMANCE_REPORT',
      marketplaceIds: ['ATVPDKIKX0DER'],
      dataStartTime: '2026-02-01',
      dataEndTime: '2026-02-07',
      reportOptions: {
        reportPeriod: 'WEEK',
        asin: 'B0TESTASIN',
      },
    });
  });

  it('fails clearly when polling never reaches a terminal status', async () => {
    await expect(
      runFirstSpApiSqpRealPullAndIngest({
        asin: 'B0TESTASIN',
        startDate: '2026-02-01',
        endDate: '2026-02-07',
        maxAttempts: 2,
        pollIntervalMs: 0,
        envSource: makeEnv(),
        tokenTransport: makeTokenTransport(),
        requestApiTransport: vi.fn(async () => ({
          status: 202,
          json: { reportId: 'sqp-123' },
        })),
        statusApiTransport: vi.fn(async () => ({
          status: 200,
          json: {
            reportId: 'sqp-123',
            reportType: 'GET_BRAND_ANALYTICS_SEARCH_QUERY_PERFORMANCE_REPORT',
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
      runFirstSpApiSqpRealPullAndIngest({
        asin: 'B0TESTASIN',
        startDate: '2026-02-01',
        endDate: '2026-02-07',
        envSource: makeEnv(),
        tokenTransport: makeTokenTransport(),
        requestApiTransport: vi.fn(async () => ({
          status: 202,
          json: { reportId: 'sqp-123' },
        })),
        statusApiTransport: vi.fn(async () => ({
          status: 200,
          json: {
            reportId: 'sqp-123',
            reportType: 'GET_BRAND_ANALYTICS_SEARCH_QUERY_PERFORMANCE_REPORT',
            processingStatus: 'DONE',
          },
        })),
      })
    ).rejects.toMatchObject({
      name: 'SpApiRequestError',
      code: 'api_response_error',
    });
  });

  it('downloads the raw artifact and hands it into the existing sqp parse+ingest boundary', async () => {
    const outputRoot = makeTempDir();
    const parseIngestImpl = vi.fn(async ({ rawFilePath, reportId }) => {
      expect(reportId).toBe('sqp-123');
      expect(rawFilePath).toBe(
        path.resolve(outputRoot, 'report-sqp-123.sqp.raw.json')
      );
      expect(fs.existsSync(rawFilePath!)).toBe(true);
      expect(fs.readFileSync(rawFilePath!, 'utf8')).toBe(ASIN_SQP_JSON);

      return {
        endpoint: 'spApiSqpParseAndIngest',
        reportId: 'sqp-123',
        inputFilePath: rawFilePath!,
        scopeType: 'asin',
        scopeValue: 'B0TESTA123',
        coverageStart: '2026-02-01',
        coverageEnd: '2026-02-07',
        rowCount: 1,
        uploadId: 'upload-123',
        warningsCount: 0,
      } as const;
    });

    const summary = await runFirstSpApiSqpRealPullAndIngest({
      asin: 'B0TESTASIN',
      startDate: '2026-02-01',
      endDate: '2026-02-07',
      envSource: makeEnv(),
      tokenTransport: makeTokenTransport(),
      requestApiTransport: vi.fn(async () => ({
        status: 202,
        json: { reportId: 'sqp-123' },
      })),
      statusApiTransport: vi.fn(async () => ({
        status: 200,
        json: {
          reportId: 'sqp-123',
          reportType: 'GET_BRAND_ANALYTICS_SEARCH_QUERY_PERFORMANCE_REPORT',
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
        body: Buffer.from(ASIN_SQP_JSON),
        headers: {
          'content-type': 'application/json; charset=utf-8',
        },
      })),
      outputRoot,
      parseIngestImpl,
    });

    expect(summary).toEqual({
      endpoint: 'spApiSqpFirstRealPullAndIngest',
      reportId: 'sqp-123',
      reportDocumentId: 'doc-123',
      rawArtifactPath: path.resolve(outputRoot, 'report-sqp-123.sqp.raw.json'),
      scopeType: 'asin',
      scopeValue: 'B0TESTA123',
      coverageStart: '2026-02-01',
      coverageEnd: '2026-02-07',
      rowCount: 1,
      uploadId: 'upload-123',
      warningsCount: 0,
    });
  });
});
