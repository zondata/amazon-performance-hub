import { describe, expect, it, vi } from 'vitest';

import {
  FIRST_SALES_AND_TRAFFIC_REPORT_TYPE,
  buildFirstSalesAndTrafficReportRequest,
  buildFirstSalesAndTrafficReportRequestBody,
  createFirstSalesAndTrafficReportRequest,
} from './firstReportRequest';

const makeEnv = () => ({
  SP_API_LWA_CLIENT_ID: 'client-id',
  SP_API_LWA_CLIENT_SECRET: 'client-secret',
  SP_API_REFRESH_TOKEN: 'refresh-token',
  SP_API_REGION: 'na',
  SP_API_MARKETPLACE_ID: 'ATVPDKIKX0DER',
});

describe('sp-api first report request boundary', () => {
  it('builds the expected request body shape for the chosen report type', () => {
    expect(
      buildFirstSalesAndTrafficReportRequestBody({
        marketplaceId: 'ATVPDKIKX0DER',
        now: new Date('2026-04-13T10:00:00.000Z'),
      })
    ).toEqual({
      reportType: FIRST_SALES_AND_TRAFFIC_REPORT_TYPE,
      marketplaceIds: ['ATVPDKIKX0DER'],
      dataStartTime: '2026-04-12T00:00:00.000Z',
      dataEndTime: '2026-04-12T23:59:59.000Z',
      reportOptions: {
        dateGranularity: 'DAY',
        asinGranularity: 'CHILD',
      },
    });
  });

  it('supports an explicit date window for bounded live proof reruns', () => {
    expect(
      buildFirstSalesAndTrafficReportRequestBody({
        marketplaceId: 'ATVPDKIKX0DER',
        startDate: '2026-04-12',
        endDate: '2026-04-12',
      })
    ).toMatchObject({
      dataStartTime: '2026-04-12T00:00:00.000Z',
      dataEndTime: '2026-04-12T23:59:59.000Z',
      reportOptions: {
        dateGranularity: 'DAY',
        asinGranularity: 'CHILD',
      },
    });
  });

  it('uses the correct reports endpoint path and includes marketplace scope', () => {
    const request = buildFirstSalesAndTrafficReportRequest({
      region: 'na',
      accessToken: 'access-token',
      marketplaceId: 'ATVPDKIKX0DER',
      now: new Date('2026-04-13T10:00:00.000Z'),
    });

    expect(request.url).toBe(
      'https://sellingpartnerapi-na.amazon.com/reports/2021-06-30/reports'
    );
    expect(request.method).toBe('POST');
    expect(request.headers).toEqual({
      'content-type': 'application/json; charset=UTF-8',
      'user-agent': 'amazon-performance-hub/v2-spapi-first-report-request',
      'x-amz-access-token': 'access-token',
    });
    expect(JSON.parse(request.body ?? '{}')).toMatchObject({
      marketplaceIds: ['ATVPDKIKX0DER'],
      reportType: FIRST_SALES_AND_TRAFFIC_REPORT_TYPE,
    });
  });

  it('parses a mocked success response into a safe summary', async () => {
    const tokenTransport = vi.fn(async () => ({
      status: 200,
      json: {
        access_token: 'access-token',
        token_type: 'bearer',
        expires_in: 3600,
      },
    }));
    const apiTransport = vi.fn(async () => ({
      status: 202,
      json: {
        reportId: 'report-123',
      },
    }));

    await expect(
      createFirstSalesAndTrafficReportRequest({
        envSource: makeEnv(),
        tokenTransport,
        apiTransport,
        now: new Date('2026-04-13T10:00:00.000Z'),
      })
    ).resolves.toEqual({
      endpoint: 'createReport',
      region: 'na',
      marketplaceId: 'ATVPDKIKX0DER',
      reportType: FIRST_SALES_AND_TRAFFIC_REPORT_TYPE,
      reportId: 'report-123',
    });
  });

  it('raises a typed error for non-2xx responses', async () => {
    const tokenTransport = vi.fn(async () => ({
      status: 200,
      json: {
        access_token: 'access-token',
        token_type: 'bearer',
        expires_in: 3600,
      },
    }));
    const apiTransport = vi.fn(async () => ({
      status: 429,
      json: {
        errors: [{ code: 'QuotaExceeded', message: 'Too many requests' }],
      },
    }));

    await expect(
      createFirstSalesAndTrafficReportRequest({
        envSource: makeEnv(),
        tokenTransport,
        apiTransport,
      })
    ).rejects.toMatchObject({
      name: 'SpApiRequestError',
      code: 'api_response_error',
      status: 429,
    });
  });

  it('raises a typed error for malformed success payloads', async () => {
    const tokenTransport = vi.fn(async () => ({
      status: 200,
      json: {
        access_token: 'access-token',
        token_type: 'bearer',
        expires_in: 3600,
      },
    }));
    const apiTransport = vi.fn(async () => ({
      status: 202,
      json: {
        processingStatus: 'IN_QUEUE',
      },
    }));

    await expect(
      createFirstSalesAndTrafficReportRequest({
        envSource: makeEnv(),
        tokenTransport,
        apiTransport,
      })
    ).rejects.toMatchObject({
      name: 'SpApiRequestError',
      code: 'invalid_response',
    });
  });
});
