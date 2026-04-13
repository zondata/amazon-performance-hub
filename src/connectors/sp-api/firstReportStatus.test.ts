import { describe, expect, it, vi } from 'vitest';

import {
  buildFirstSalesAndTrafficReportStatusRequest,
  pollFirstSalesAndTrafficReportStatus,
} from './firstReportStatus';

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

describe('sp-api first report status boundary', () => {
  it('uses the correct get-report endpoint path', () => {
    const request = buildFirstSalesAndTrafficReportStatusRequest({
      region: 'na',
      accessToken: 'access-token',
      reportId: 'report-123',
    });

    expect(request.url).toBe(
      'https://sellingpartnerapi-na.amazon.com/reports/2021-06-30/reports/report-123'
    );
    expect(request.method).toBe('GET');
    expect(request.headers).toEqual({
      'user-agent': 'amazon-performance-hub/v2-spapi-first-report-status',
      'x-amz-access-token': 'access-token',
    });
  });

  it('requires a non-empty report id', async () => {
    await expect(
      pollFirstSalesAndTrafficReportStatus({
        reportId: '   ',
        envSource: makeEnv(),
      })
    ).rejects.toMatchObject({
      name: 'SpApiRequestError',
      code: 'request_build_error',
    });
  });

  it('parses a single-check response into a safe summary', async () => {
    const summary = await pollFirstSalesAndTrafficReportStatus({
      reportId: 'report-123',
      mode: 'single-check',
      envSource: makeEnv(),
      tokenTransport: makeTokenTransport(),
      apiTransport: vi.fn(async () => ({
        status: 200,
        json: {
          reportId: 'report-123',
          reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
          processingStatus: 'DONE',
          processingStartTime: '2026-04-13T10:00:00Z',
          processingEndTime: '2026-04-13T10:02:00Z',
          reportDocumentId: 'doc-123',
          url: 'https://example.com/presigned-download',
        },
      })),
    });

    expect(summary).toEqual({
      endpoint: 'getReport',
      region: 'na',
      marketplaceId: 'ATVPDKIKX0DER',
      reportId: 'report-123',
      reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
      processingStatus: 'DONE',
      terminalReached: true,
      maxAttemptsReached: false,
      attemptCount: 1,
      processingStartTime: '2026-04-13T10:00:00Z',
      processingEndTime: '2026-04-13T10:02:00Z',
      reportDocumentId: 'doc-123',
    });
  });

  it('stops polling once a terminal status is reached', async () => {
    const wait = vi.fn(async () => undefined);
    const apiTransport = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        json: {
          reportId: 'report-123',
          reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
          processingStatus: 'IN_QUEUE',
        },
      })
      .mockResolvedValueOnce({
        status: 200,
        json: {
          reportId: 'report-123',
          reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
          processingStatus: 'IN_PROGRESS',
        },
      })
      .mockResolvedValueOnce({
        status: 200,
        json: {
          reportId: 'report-123',
          reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
          processingStatus: 'DONE',
          reportDocumentId: 'doc-123',
        },
      });

    const summary = await pollFirstSalesAndTrafficReportStatus({
      reportId: 'report-123',
      envSource: makeEnv(),
      tokenTransport: makeTokenTransport(),
      apiTransport,
      maxAttempts: 5,
      pollIntervalMs: 25,
      wait,
    });

    expect(summary.processingStatus).toBe('DONE');
    expect(summary.terminalReached).toBe(true);
    expect(summary.attemptCount).toBe(3);
    expect(summary.maxAttemptsReached).toBe(false);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it('stops polling at max attempts when the status stays non-terminal', async () => {
    const wait = vi.fn(async () => undefined);
    const apiTransport = vi.fn(async () => ({
      status: 200,
      json: {
        reportId: 'report-123',
        reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
        processingStatus: 'IN_PROGRESS',
      },
    }));

    const summary = await pollFirstSalesAndTrafficReportStatus({
      reportId: 'report-123',
      envSource: makeEnv(),
      tokenTransport: makeTokenTransport(),
      apiTransport,
      maxAttempts: 2,
      pollIntervalMs: 10,
      wait,
    });

    expect(summary.processingStatus).toBe('IN_PROGRESS');
    expect(summary.terminalReached).toBe(false);
    expect(summary.maxAttemptsReached).toBe(true);
    expect(summary.attemptCount).toBe(2);
    expect(wait).toHaveBeenCalledTimes(1);
  });

  it('raises a typed error for non-2xx status responses', async () => {
    await expect(
      pollFirstSalesAndTrafficReportStatus({
        reportId: 'report-123',
        mode: 'single-check',
        envSource: makeEnv(),
        tokenTransport: makeTokenTransport(),
        apiTransport: vi.fn(async () => ({
          status: 404,
          json: {
            errors: [{ code: 'NotFound', message: 'Report does not exist' }],
          },
        })),
      })
    ).rejects.toMatchObject({
      name: 'SpApiRequestError',
      code: 'api_response_error',
      status: 404,
    });
  });

  it('raises a typed error for malformed success payloads', async () => {
    await expect(
      pollFirstSalesAndTrafficReportStatus({
        reportId: 'report-123',
        mode: 'single-check',
        envSource: makeEnv(),
        tokenTransport: makeTokenTransport(),
        apiTransport: vi.fn(async () => ({
          status: 200,
          json: {
            reportId: 'report-123',
            processingStatus: 'BROKEN_STATUS',
          },
        })),
      })
    ).rejects.toMatchObject({
      name: 'SpApiRequestError',
      code: 'invalid_response',
    });
  });

  it('returns a safe summary without leaking secrets or raw payload fields', async () => {
    const summary = await pollFirstSalesAndTrafficReportStatus({
      reportId: 'report-123',
      mode: 'single-check',
      envSource: makeEnv(),
      tokenTransport: vi.fn(async () => ({
        status: 200,
        json: {
          access_token: 'super-secret-access-token',
          token_type: 'bearer',
          expires_in: 3600,
        },
      })),
      apiTransport: vi.fn(async () => ({
        status: 200,
        json: {
          reportId: 'report-123',
          reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
          processingStatus: 'DONE',
          reportDocumentId: 'doc-123',
          reportDocumentUrl: 'https://secret.example.com/download',
        },
      })),
    });

    const serialized = JSON.stringify(summary);

    expect(serialized).toContain('"reportId":"report-123"');
    expect(serialized).toContain('"processingStatus":"DONE"');
    expect(serialized).not.toContain('super-secret-access-token');
    expect(serialized).not.toContain('refresh-token');
    expect(serialized).not.toContain('reportDocumentUrl');
    expect(serialized).not.toContain('https://secret.example.com/download');
  });
});
