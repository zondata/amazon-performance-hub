import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  FIRST_REPORT_HANDOFF_SCHEMA_VERSION,
  buildFirstSalesAndTrafficReportHandoff,
  buildFirstSalesAndTrafficReportHandoffPath,
  readFirstSalesAndTrafficParsedArtifact,
  resolveFirstSalesAndTrafficParsedArtifactPath,
  runFirstSpApiReportHandoff,
  validateFirstSalesAndTrafficReportHandoff,
  writeFirstSalesAndTrafficReportHandoff,
} from './firstReportHandoff';

const tempDirs: string[] = [];

const makeTempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spapi-handoff-test-'));
  tempDirs.push(dir);
  return dir;
};

const makeParsedArtifact = () => ({
  reportId: 'report-123',
  inputFilePath: '/tmp/report-report-123.document.raw.gz',
  detectedFormat: 'json' as const,
  decompressed: true,
  reportType: 'GET_SALES_AND_TRAFFIC_REPORT' as const,
  sections: [
    {
      sectionName: 'salesAndTrafficByDate',
      headers: ['date', 'salesByDate.orderedProductSales.amount'],
      rowCount: 1,
      rows: [
        {
          date: '2026-04-12',
          'salesByDate.orderedProductSales.amount': 999.99,
        },
      ],
    },
    {
      sectionName: 'salesAndTrafficByAsin',
      headers: ['parentAsin', 'salesByAsin.orderedProductSales.amount'],
      rowCount: 1,
      rows: [
        {
          parentAsin: 'B0SENSITIVE',
          'salesByAsin.orderedProductSales.amount': 50,
        },
      ],
    },
  ],
});

const writeParsedArtifact = (args: {
  dir: string;
  reportId?: string;
  artifact?: unknown;
}) => {
  const reportId = args.reportId ?? 'report-123';
  const filePath = path.join(args.dir, `report-${reportId}.parsed.json`);
  fs.writeFileSync(
    filePath,
    JSON.stringify(args.artifact ?? makeParsedArtifact(), null, 2),
    'utf8'
  );
  return filePath;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('sp-api first report handoff boundary', () => {
  it('resolves the deterministic parsed artifact path from report id', async () => {
    const parsedDir = makeTempDir();
    const parsedArtifactPath = writeParsedArtifact({ dir: parsedDir });

    await expect(
      resolveFirstSalesAndTrafficParsedArtifactPath({
        reportId: 'report-123',
        parsedOutputRoot: parsedDir,
      })
    ).resolves.toEqual({
      reportId: 'report-123',
      parsedArtifactPath,
    });
  });

  it('builds the handoff contract with stable metadata and payload sections', async () => {
    const parsedDir = makeTempDir();
    const parsedArtifactPath = writeParsedArtifact({ dir: parsedDir });
    const parsedArtifact = await readFirstSalesAndTrafficParsedArtifact({
      parsedArtifactPath,
    });

    const handoff = buildFirstSalesAndTrafficReportHandoff({
      parsedArtifact,
      parsedArtifactPath,
      generatedAt: '2026-04-14T00:00:00.000Z',
    });

    expect(handoff).toMatchObject({
      schemaVersion: FIRST_REPORT_HANDOFF_SCHEMA_VERSION,
      reportFamily: 'sales_and_traffic',
      reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
      reportId: 'report-123',
      generatedAt: '2026-04-14T00:00:00.000Z',
      sourceArtifacts: {
        parsedArtifactPath,
        rawArtifactPath: '/tmp/report-report-123.document.raw.gz',
      },
      sections: [
        {
          sectionName: 'salesAndTrafficByDate',
          headerCount: 2,
          rowCount: 1,
        },
        {
          sectionName: 'salesAndTrafficByAsin',
          headerCount: 2,
          rowCount: 1,
        },
      ],
      totalRowCount: 2,
    });
    expect(handoff.payload.sections[0].rows[0]).toEqual({
      date: '2026-04-12',
      'salesByDate.orderedProductSales.amount': 999.99,
    });
  });

  it('requires schemaVersion during handoff validation', async () => {
    const parsedDir = makeTempDir();
    const parsedArtifactPath = writeParsedArtifact({ dir: parsedDir });
    const parsedArtifact = await readFirstSalesAndTrafficParsedArtifact({
      parsedArtifactPath,
    });

    const handoff = buildFirstSalesAndTrafficReportHandoff({
      parsedArtifact,
      parsedArtifactPath,
      generatedAt: '2026-04-14T00:00:00.000Z',
    });

    handoff.schemaVersion = '' as typeof FIRST_REPORT_HANDOFF_SCHEMA_VERSION;

    try {
      validateFirstSalesAndTrafficReportHandoff({
        parsedArtifact,
        handoffArtifact: handoff,
      });
      throw new Error('expected handoff validation to fail');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'SpApiHandoffError',
        code: 'validation_failed',
      });
    }
  });

  it('enforces required top-level fields before writing the handoff artifact', async () => {
    const parsedDir = makeTempDir();
    const parsedArtifactPath = writeParsedArtifact({ dir: parsedDir });
    const parsedArtifact = await readFirstSalesAndTrafficParsedArtifact({
      parsedArtifactPath,
    });

    const handoff = buildFirstSalesAndTrafficReportHandoff({
      parsedArtifact,
      parsedArtifactPath,
      generatedAt: '2026-04-14T00:00:00.000Z',
    });

    handoff.sourceArtifacts.parsedArtifactPath = '';

    try {
      validateFirstSalesAndTrafficReportHandoff({
        parsedArtifact,
        handoffArtifact: handoff,
      });
      throw new Error('expected handoff validation to fail');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'SpApiHandoffError',
        code: 'validation_failed',
      });
    }
  });

  it('keeps section names and row counts consistent with the parsed artifact', async () => {
    const parsedDir = makeTempDir();
    const parsedArtifactPath = writeParsedArtifact({ dir: parsedDir });
    const parsedArtifact = await readFirstSalesAndTrafficParsedArtifact({
      parsedArtifactPath,
    });

    const handoff = buildFirstSalesAndTrafficReportHandoff({
      parsedArtifact,
      parsedArtifactPath,
      generatedAt: '2026-04-14T00:00:00.000Z',
    });

    handoff.sections[1].sectionName = 'wrongSectionName';

    try {
      validateFirstSalesAndTrafficReportHandoff({
        parsedArtifact,
        handoffArtifact: handoff,
      });
      throw new Error('expected handoff validation to fail');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'SpApiHandoffError',
        code: 'validation_failed',
      });
    }
  });

  it('returns a safe summary without exposing parsed business rows', async () => {
    const parsedDir = makeTempDir();
    const handoffDir = makeTempDir();
    writeParsedArtifact({ dir: parsedDir });

    const summary = await runFirstSpApiReportHandoff({
      reportId: 'report-123',
      parsedOutputRoot: parsedDir,
      handoffOutputRoot: handoffDir,
      generatedAt: '2026-04-14T00:00:00.000Z',
    });
    const serialized = JSON.stringify(summary);

    expect(serialized).toContain('"schemaVersion":"sp-api-first-report-handoff/v1"');
    expect(serialized).toContain('"reportId":"report-123"');
    expect(serialized).not.toContain('B0SENSITIVE');
    expect(serialized).not.toContain('999.99');
  });

  it('writes the handoff artifact to the expected bounded output path', async () => {
    const parsedDir = makeTempDir();
    const handoffDir = makeTempDir();
    const parsedArtifactPath = writeParsedArtifact({ dir: parsedDir });
    const parsedArtifact = await readFirstSalesAndTrafficParsedArtifact({
      parsedArtifactPath,
    });
    const handoff = buildFirstSalesAndTrafficReportHandoff({
      parsedArtifact,
      parsedArtifactPath,
      generatedAt: '2026-04-14T00:00:00.000Z',
    });

    const handoffArtifactPath = await writeFirstSalesAndTrafficReportHandoff({
      handoffArtifact: handoff,
      outputRoot: handoffDir,
    });

    expect(handoffArtifactPath).toBe(
      buildFirstSalesAndTrafficReportHandoffPath({
        reportId: 'report-123',
        outputRoot: handoffDir,
      })
    );
    expect(fs.existsSync(handoffArtifactPath)).toBe(true);
  });

  it('raises a typed error for malformed parsed input', async () => {
    const parsedDir = makeTempDir();
    const parsedArtifactPath = writeParsedArtifact({
      dir: parsedDir,
      artifact: {
        ...makeParsedArtifact(),
        sections: [
          {
            sectionName: 'salesAndTrafficByDate',
            headers: ['date'],
            rowCount: 2,
            rows: [{ date: '2026-04-12' }],
          },
        ],
      },
    });

    await expect(
      readFirstSalesAndTrafficParsedArtifact({
        parsedArtifactPath,
      })
    ).rejects.toMatchObject({
      name: 'SpApiHandoffError',
      code: 'invalid_content',
    });
  });
});
