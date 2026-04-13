import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import { afterEach, describe, expect, it } from 'vitest';

import {
  buildFirstSalesAndTrafficParsedArtifactPath,
  parseFirstSalesAndTrafficReportContent,
  readFirstSalesAndTrafficRawArtifact,
  resolveFirstSalesAndTrafficRawArtifactPath,
  writeFirstSalesAndTrafficParsedArtifact,
} from './firstReportParser';

const tempDirs: string[] = [];

const makeTempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spapi-parse-test-'));
  tempDirs.push(dir);
  return dir;
};

const makeReportJson = (rows: unknown[] = []) =>
  JSON.stringify({
    reportSpecification: {
      reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
      reportOptions: {
        dateGranularity: 'DAY',
        asinGranularity: 'PARENT',
      },
      dataStartTime: '2026-04-12',
      dataEndTime: '2026-04-12',
      marketplaceIds: ['ATVPDKIKX0DER'],
    },
    salesAndTrafficByDate: rows,
    salesAndTrafficByAsin: [],
  });

const writeCompressedRawArtifact = (args: {
  dir: string;
  reportId: string;
  contents: string;
}) => {
  const filePath = path.join(
    args.dir,
    `report-${args.reportId}.document.raw.gz`
  );
  fs.writeFileSync(filePath, gzipSync(args.contents));
  return filePath;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('sp-api first report parser boundary', () => {
  it('resolves the deterministic raw artifact path from report id', async () => {
    const rawDir = makeTempDir();
    const rawPath = writeCompressedRawArtifact({
      dir: rawDir,
      reportId: 'report-123',
      contents: makeReportJson(),
    });

    await expect(
      resolveFirstSalesAndTrafficRawArtifactPath({
        reportId: 'report-123',
        rawOutputRoot: rawDir,
      })
    ).resolves.toEqual({
      reportId: 'report-123',
      inputFilePath: rawPath,
    });
  });

  it('decompresses gz input and reads the JSON artifact text', async () => {
    const rawDir = makeTempDir();
    const rawPath = writeCompressedRawArtifact({
      dir: rawDir,
      reportId: 'report-123',
      contents: makeReportJson(),
    });

    const rawArtifact = await readFirstSalesAndTrafficRawArtifact({
      inputFilePath: rawPath,
    });

    expect(rawArtifact.decompressed).toBe(true);
    expect(rawArtifact.text).toContain('"reportType":"GET_SALES_AND_TRAFFIC_REPORT"');
  });

  it('parses JSON section headers and aligns rows to the same header count', async () => {
    const rawDir = makeTempDir();
    const parsedDir = makeTempDir();
    const rawPath = writeCompressedRawArtifact({
      dir: rawDir,
      reportId: 'report-123',
      contents: makeReportJson([
        {
          date: '2026-04-12',
          salesByDate: {
            orderedProductSales: {
              amount: 127.94,
              currencyCode: 'USD',
            },
            unitsOrdered: 6,
          },
          trafficByDate: {
            pageViews: 0,
          },
        },
        {
          date: '2026-04-13',
          salesByDate: {
            orderedProductSales: {
              amount: 75.0,
            },
          },
          trafficByDate: {
            pageViews: 3,
          },
        },
      ]),
    });

    const summary = await parseFirstSalesAndTrafficReportContent({
      rawFilePath: rawPath,
      parsedOutputRoot: parsedDir,
    });
    const parsedArtifact = JSON.parse(
      fs.readFileSync(summary.parsedArtifactPath, 'utf8')
    ) as {
      sections: Array<{
        sectionName: string;
        headers: string[];
        rows: Array<Record<string, unknown>>;
      }>;
    };

    expect(summary.detectedFormat).toBe('json');
    expect(summary.decompressed).toBe(true);
    expect(summary.sectionCount).toBe(2);
    expect(summary.totalRowCount).toBe(2);

    const dateSection = parsedArtifact.sections.find(
      (section) => section.sectionName === 'salesAndTrafficByDate'
    );
    expect(dateSection?.headers).toEqual([
      'date',
      'salesByDate.orderedProductSales.amount',
      'salesByDate.orderedProductSales.currencyCode',
      'salesByDate.unitsOrdered',
      'trafficByDate.pageViews',
    ]);
    expect(dateSection?.rows[0]).toEqual({
      date: '2026-04-12',
      'salesByDate.orderedProductSales.amount': 127.94,
      'salesByDate.orderedProductSales.currencyCode': 'USD',
      'salesByDate.unitsOrdered': 6,
      'trafficByDate.pageViews': 0,
    });
    expect(dateSection?.rows[1]).toEqual({
      date: '2026-04-13',
      'salesByDate.orderedProductSales.amount': 75,
      'salesByDate.orderedProductSales.currencyCode': null,
      'salesByDate.unitsOrdered': null,
      'trafficByDate.pageViews': 3,
    });
    expect(Object.keys(dateSection?.rows[0] ?? {})).toHaveLength(
      dateSection?.headers.length ?? 0
    );
    expect(Object.keys(dateSection?.rows[1] ?? {})).toHaveLength(
      dateSection?.headers.length ?? 0
    );
  });

  it('raises a typed error for malformed non-object rows', async () => {
    const rawDir = makeTempDir();
    const rawPath = writeCompressedRawArtifact({
      dir: rawDir,
      reportId: 'report-123',
      contents: makeReportJson(['broken-row']),
    });

    await expect(
      parseFirstSalesAndTrafficReportContent({
        rawFilePath: rawPath,
      })
    ).rejects.toMatchObject({
      name: 'SpApiParseError',
      code: 'invalid_content',
    });
  });

  it('does not expose sensitive row contents in the safe summary', async () => {
    const rawDir = makeTempDir();
    const parsedDir = makeTempDir();
    const rawPath = writeCompressedRawArtifact({
      dir: rawDir,
      reportId: 'report-123',
      contents: makeReportJson([
        {
          date: '2026-04-12',
          salesByDate: {
            orderedProductSales: {
              amount: 999.99,
              currencyCode: 'USD',
            },
          },
          secretSku: 'SUPER-SENSITIVE-SKU',
        },
      ]),
    });

    const summary = await parseFirstSalesAndTrafficReportContent({
      rawFilePath: rawPath,
      parsedOutputRoot: parsedDir,
    });
    const serialized = JSON.stringify(summary);

    expect(serialized).toContain('"reportId":"report-123"');
    expect(serialized).toContain('"detectedFormat":"json"');
    expect(serialized).not.toContain('SUPER-SENSITIVE-SKU');
    expect(serialized).not.toContain('999.99');
  });

  it('writes the parsed artifact to the expected bounded output path', async () => {
    const parsedDir = makeTempDir();
    const artifact = {
      reportId: 'report-123',
      inputFilePath: '/tmp/report-report-123.document.raw.gz',
      detectedFormat: 'json' as const,
      decompressed: true,
      reportType: 'GET_SALES_AND_TRAFFIC_REPORT' as const,
      sections: [
        {
          sectionName: 'salesAndTrafficByDate',
          headers: ['date'],
          rowCount: 1,
          rows: [{ date: '2026-04-12' }],
        },
      ],
    };

    const parsedArtifactPath = await writeFirstSalesAndTrafficParsedArtifact({
      artifact,
      outputRoot: parsedDir,
    });

    expect(parsedArtifactPath).toBe(
      buildFirstSalesAndTrafficParsedArtifactPath({
        reportId: 'report-123',
        outputRoot: parsedDir,
      })
    );
    expect(fs.existsSync(parsedArtifactPath)).toBe(true);
  });
});
