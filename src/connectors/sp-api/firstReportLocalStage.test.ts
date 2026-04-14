import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  FIRST_REPORT_LOCAL_STAGE_VERSION,
  buildFirstSalesAndTrafficLocalStageArtifact,
  buildFirstSalesAndTrafficLocalStageArtifactPath,
  readFirstSalesAndTrafficHandoffArtifact,
  resolveFirstSalesAndTrafficHandoffArtifactPath,
  runFirstSpApiLocalStageIngestion,
  validateFirstSalesAndTrafficLocalStageArtifact,
  writeFirstSalesAndTrafficLocalStageArtifact,
} from './firstReportLocalStage';

const tempDirs: string[] = [];

const makeTempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spapi-local-stage-test-'));
  tempDirs.push(dir);
  return dir;
};

const makeHandoffArtifact = () => ({
  schemaVersion: 'sp-api-first-report-handoff/v1',
  reportFamily: 'sales_and_traffic' as const,
  reportType: 'GET_SALES_AND_TRAFFIC_REPORT' as const,
  reportId: 'report-123',
  generatedAt: '2026-04-14T00:00:00.000Z',
  sourceArtifacts: {
    parsedArtifactPath: '/tmp/report-report-123.parsed.json',
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
  payload: {
    sections: [
      {
        sectionName: 'salesAndTrafficByDate',
        headers: ['date', 'salesByDate.orderedProductSales.amount'],
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
        rows: [
          {
            parentAsin: 'B0SENSITIVE',
            'salesByAsin.orderedProductSales.amount': 50,
          },
        ],
      },
    ],
  },
});

const writeHandoffArtifact = (args: {
  dir: string;
  reportId?: string;
  artifact?: unknown;
}) => {
  const reportId = args.reportId ?? 'report-123';
  const filePath = path.join(args.dir, `report-${reportId}.handoff.json`);
  fs.writeFileSync(
    filePath,
    JSON.stringify(args.artifact ?? makeHandoffArtifact(), null, 2),
    'utf8'
  );
  return filePath;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('sp-api first report local staging boundary', () => {
  it('resolves the deterministic handoff artifact path from report id', async () => {
    const handoffDir = makeTempDir();
    const handoffArtifactPath = writeHandoffArtifact({ dir: handoffDir });

    await expect(
      resolveFirstSalesAndTrafficHandoffArtifactPath({
        reportId: 'report-123',
        handoffOutputRoot: handoffDir,
      })
    ).resolves.toEqual({
      reportId: 'report-123',
      handoffArtifactPath,
    });
  });

  it('builds the local staging artifact with lineage metadata and staged records', async () => {
    const handoffDir = makeTempDir();
    const handoffArtifactPath = writeHandoffArtifact({ dir: handoffDir });
    const handoffArtifact = await readFirstSalesAndTrafficHandoffArtifact({
      handoffArtifactPath,
    });

    const stagingArtifact = buildFirstSalesAndTrafficLocalStageArtifact({
      handoffArtifact,
      handoffArtifactPath,
    });

    expect(stagingArtifact).toMatchObject({
      stagingVersion: FIRST_REPORT_LOCAL_STAGE_VERSION,
      stageTarget: 'local_json_stage',
      reportFamily: 'sales_and_traffic',
      reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
      reportId: 'report-123',
      lineage: {
        handoffArtifactPath,
        handoffSchemaVersion: 'sp-api-first-report-handoff/v1',
        parsedArtifactPath: '/tmp/report-report-123.parsed.json',
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
    expect(stagingArtifact.stagedPayload.sections[0].records[0]).toEqual({
      recordIndex: 0,
      values: {
        date: '2026-04-12',
        'salesByDate.orderedProductSales.amount': 999.99,
      },
    });
  });

  it('enforces lineage metadata during staging validation', async () => {
    const handoffDir = makeTempDir();
    const handoffArtifactPath = writeHandoffArtifact({ dir: handoffDir });
    const handoffArtifact = await readFirstSalesAndTrafficHandoffArtifact({
      handoffArtifactPath,
    });
    const stagingArtifact = buildFirstSalesAndTrafficLocalStageArtifact({
      handoffArtifact,
      handoffArtifactPath,
    });

    stagingArtifact.lineage.handoffArtifactPath = '';

    try {
      validateFirstSalesAndTrafficLocalStageArtifact({
        handoffArtifact,
        stagingArtifact,
      });
      throw new Error('expected local stage validation to fail');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'SpApiLocalStageError',
        code: 'validation_failed',
      });
    }
  });

  it('enforces required top-level staging fields', async () => {
    const handoffDir = makeTempDir();
    const handoffArtifactPath = writeHandoffArtifact({ dir: handoffDir });
    const handoffArtifact = await readFirstSalesAndTrafficHandoffArtifact({
      handoffArtifactPath,
    });
    const stagingArtifact = buildFirstSalesAndTrafficLocalStageArtifact({
      handoffArtifact,
      handoffArtifactPath,
    });

    stagingArtifact.stagingVersion = '' as typeof FIRST_REPORT_LOCAL_STAGE_VERSION;

    try {
      validateFirstSalesAndTrafficLocalStageArtifact({
        handoffArtifact,
        stagingArtifact,
      });
      throw new Error('expected local stage validation to fail');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'SpApiLocalStageError',
        code: 'validation_failed',
      });
    }
  });

  it('keeps section names and row counts consistent with the handoff artifact', async () => {
    const handoffDir = makeTempDir();
    const handoffArtifactPath = writeHandoffArtifact({ dir: handoffDir });
    const handoffArtifact = await readFirstSalesAndTrafficHandoffArtifact({
      handoffArtifactPath,
    });
    const stagingArtifact = buildFirstSalesAndTrafficLocalStageArtifact({
      handoffArtifact,
      handoffArtifactPath,
    });

    stagingArtifact.sections[1].rowCount = 99;

    try {
      validateFirstSalesAndTrafficLocalStageArtifact({
        handoffArtifact,
        stagingArtifact,
      });
      throw new Error('expected local stage validation to fail');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'SpApiLocalStageError',
        code: 'validation_failed',
      });
    }
  });

  it('returns a safe summary without exposing staged business rows', async () => {
    const handoffDir = makeTempDir();
    const stagingDir = makeTempDir();
    writeHandoffArtifact({ dir: handoffDir });

    const summary = await runFirstSpApiLocalStageIngestion({
      reportId: 'report-123',
      handoffOutputRoot: handoffDir,
      stagingOutputRoot: stagingDir,
    });
    const serialized = JSON.stringify(summary);

    expect(serialized).toContain(
      '"stagingVersion":"sp-api-first-report-local-stage/v1"'
    );
    expect(serialized).toContain('"reportId":"report-123"');
    expect(serialized).not.toContain('B0SENSITIVE');
    expect(serialized).not.toContain('999.99');
  });

  it('writes the staging artifact to the expected bounded output path', async () => {
    const handoffDir = makeTempDir();
    const stagingDir = makeTempDir();
    const handoffArtifactPath = writeHandoffArtifact({ dir: handoffDir });
    const handoffArtifact = await readFirstSalesAndTrafficHandoffArtifact({
      handoffArtifactPath,
    });
    const stagingArtifact = buildFirstSalesAndTrafficLocalStageArtifact({
      handoffArtifact,
      handoffArtifactPath,
    });

    const stagingArtifactPath = await writeFirstSalesAndTrafficLocalStageArtifact({
      stagingArtifact,
      outputRoot: stagingDir,
    });

    expect(stagingArtifactPath).toBe(
      buildFirstSalesAndTrafficLocalStageArtifactPath({
        reportId: 'report-123',
        outputRoot: stagingDir,
      })
    );
    expect(fs.existsSync(stagingArtifactPath)).toBe(true);
  });

  it('raises a typed error for malformed handoff input', async () => {
    const handoffDir = makeTempDir();
    const handoffArtifactPath = writeHandoffArtifact({
      dir: handoffDir,
      artifact: {
        ...makeHandoffArtifact(),
        sections: [
          {
            sectionName: 'salesAndTrafficByDate',
            headerCount: 1,
            rowCount: 2,
          },
        ],
        totalRowCount: 1,
        payload: {
          sections: [
            {
              sectionName: 'salesAndTrafficByDate',
              headers: ['date'],
              rows: [{ date: '2026-04-12' }],
            },
          ],
        },
      },
    });

    await expect(
      readFirstSalesAndTrafficHandoffArtifact({
        handoffArtifactPath,
      })
    ).rejects.toMatchObject({
      name: 'SpApiLocalStageError',
      code: 'invalid_content',
    });
  });
});
