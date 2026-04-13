import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildFirstSalesAndTrafficReportArtifactPath,
  buildFirstSalesAndTrafficReportDocumentMetadataRequest,
  fetchFirstSalesAndTrafficReportDocument,
  requireFirstSalesAndTrafficReportDocumentId,
  writeFirstSalesAndTrafficReportArtifact,
} from './firstReportDocument';

const tempDirs: string[] = [];

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

const makeTempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spapi-doc-test-'));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('sp-api first report document boundary', () => {
  it('extracts the report document id from a completed report status summary', () => {
    expect(
      requireFirstSalesAndTrafficReportDocumentId({
        endpoint: 'getReport',
        region: 'na',
        marketplaceId: 'ATVPDKIKX0DER',
        reportId: 'report-123',
        reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
        processingStatus: 'DONE',
        terminalReached: true,
        maxAttemptsReached: false,
        attemptCount: 1,
        processingStartTime: null,
        processingEndTime: null,
        reportDocumentId: 'doc-123',
      })
    ).toBe('doc-123');
  });

  it('uses the correct get-report-document endpoint path', () => {
    const request = buildFirstSalesAndTrafficReportDocumentMetadataRequest({
      region: 'na',
      accessToken: 'access-token',
      reportDocumentId: 'doc-123',
    });

    expect(request.url).toBe(
      'https://sellingpartnerapi-na.amazon.com/reports/2021-06-30/documents/doc-123'
    );
    expect(request.method).toBe('GET');
    expect(request.headers).toEqual({
      'user-agent': 'amazon-performance-hub/v2-spapi-first-report-document',
      'x-amz-access-token': 'access-token',
    });
  });

  it('returns a redacted retrieval summary for a completed report', async () => {
    const outputRoot = makeTempDir();

    const summary = await fetchFirstSalesAndTrafficReportDocument({
      reportId: 'report-123',
      envSource: makeEnv(),
      tokenTransport: makeTokenTransport(),
      statusApiTransport: vi.fn(async () => ({
        status: 200,
        json: {
          reportId: 'report-123',
          reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
          processingStatus: 'DONE',
          reportDocumentId: 'doc-123',
        },
      })),
      metadataApiTransport: vi.fn(async () => ({
        status: 200,
        json: {
          reportDocumentId: 'doc-123',
          url: 'https://secret.example.com/presigned-download',
          compressionAlgorithm: 'GZIP',
        },
      })),
      downloadTransport: vi.fn(async () => ({
        status: 200,
        body: Buffer.from('raw-gzip-bytes'),
        headers: {
          'content-type': 'application/octet-stream',
        },
      })),
      outputRoot,
    });

    expect(summary).toEqual({
      endpoint: 'getReportDocument',
      region: 'na',
      marketplaceId: 'ATVPDKIKX0DER',
      reportId: 'report-123',
      processingStatus: 'DONE',
      reportDocumentId: 'doc-123',
      compressionAlgorithm: 'GZIP',
      contentType: 'application/octet-stream',
      outputFilePath: path.resolve(
        outputRoot,
        'report-report-123.document.raw.gz'
      ),
      downloadedByteCount: 14,
      storedByteCount: 14,
    });
  });

  it('writes the raw document bytes to the expected bounded output path', async () => {
    const outputRoot = makeTempDir();
    const bytes = Buffer.from('hello world');

    const artifact = await writeFirstSalesAndTrafficReportArtifact({
      reportId: 'report-123',
      compressionAlgorithm: null,
      contentType: 'text/plain; charset=utf-8',
      bytes,
      outputRoot,
    });

    expect(artifact.outputFilePath).toBe(
      buildFirstSalesAndTrafficReportArtifactPath({
        reportId: 'report-123',
        compressionAlgorithm: null,
        contentType: 'text/plain; charset=utf-8',
        outputRoot,
      })
    );
    expect(fs.readFileSync(artifact.outputFilePath, 'utf8')).toBe('hello world');
    expect(artifact.outputFilePath).toContain(`${path.sep}spapi-doc-test-`);
  });

  it('raises a typed error for non-2xx document metadata responses', async () => {
    await expect(
      fetchFirstSalesAndTrafficReportDocument({
        reportId: 'report-123',
        envSource: makeEnv(),
        tokenTransport: makeTokenTransport(),
        statusApiTransport: vi.fn(async () => ({
          status: 200,
          json: {
            reportId: 'report-123',
            reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
            processingStatus: 'DONE',
            reportDocumentId: 'doc-123',
          },
        })),
        metadataApiTransport: vi.fn(async () => ({
          status: 404,
          json: {
            errors: [{ code: 'NotFound', message: 'Document missing' }],
          },
        })),
      })
    ).rejects.toMatchObject({
      name: 'SpApiRequestError',
      code: 'api_response_error',
      status: 404,
    });
  });

  it('raises a typed error for malformed document metadata payloads', async () => {
    await expect(
      fetchFirstSalesAndTrafficReportDocument({
        reportId: 'report-123',
        envSource: makeEnv(),
        tokenTransport: makeTokenTransport(),
        statusApiTransport: vi.fn(async () => ({
          status: 200,
          json: {
            reportId: 'report-123',
            reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
            processingStatus: 'DONE',
            reportDocumentId: 'doc-123',
          },
        })),
        metadataApiTransport: vi.fn(async () => ({
          status: 200,
          json: {
            reportDocumentId: 'doc-123',
          },
        })),
      })
    ).rejects.toMatchObject({
      name: 'SpApiRequestError',
      code: 'invalid_response',
    });
  });

  it('returns a safe summary without exposing the pre-signed download URL', async () => {
    const outputRoot = makeTempDir();

    const summary = await fetchFirstSalesAndTrafficReportDocument({
      reportId: 'report-123',
      envSource: makeEnv(),
      tokenTransport: makeTokenTransport(),
      statusApiTransport: vi.fn(async () => ({
        status: 200,
        json: {
          reportId: 'report-123',
          reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
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
        body: Buffer.from('plain text body'),
        headers: {
          'content-type': 'text/plain; charset=utf-8',
        },
      })),
      outputRoot,
    });

    const serialized = JSON.stringify(summary);

    expect(serialized).toContain('"reportId":"report-123"');
    expect(serialized).toContain('"reportDocumentId":"doc-123"');
    expect(serialized).not.toContain('https://secret.example.com/presigned-download');
    expect(serialized).not.toContain('access-token');
    expect(serialized).not.toContain('refresh-token');
  });
});
