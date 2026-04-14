import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  FIRST_REPORT_CANONICAL_INGEST_VERSION,
  buildFirstSalesTrafficCanonicalIngestArtifact,
  buildFirstSalesTrafficCanonicalIngestArtifactPath,
  readFirstSalesTrafficStageArtifact,
  resolveFirstSalesTrafficStageArtifactPath,
  runFirstSalesTrafficCanonicalIngestBoundary,
  validateFirstSalesTrafficCanonicalIngestArtifact,
  writeFirstSalesTrafficCanonicalIngestArtifact,
} from './firstSalesTrafficCanonical';

const tempDirs: string[] = [];

const makeTempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spapi-canonical-ingest-test-'));
  tempDirs.push(dir);
  return dir;
};

const makeStageArtifact = () => ({
  stagingVersion: 'sp-api-first-report-local-stage/v1',
  stageTarget: 'local_json_stage' as const,
  stageTargetDescription:
    'Deterministic local JSON staging artifact for bounded ingestion proof only; not a warehouse target',
  reportFamily: 'sales_and_traffic' as const,
  reportType: 'GET_SALES_AND_TRAFFIC_REPORT' as const,
  reportId: 'report-123',
  lineage: {
    handoffArtifactPath: '/tmp/report-report-123.handoff.json',
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
  stagedPayload: {
    sections: [
      {
        sectionName: 'salesAndTrafficByDate',
        headers: ['date', 'salesByDate.orderedProductSales.amount'],
        records: [
          {
            recordIndex: 0,
            values: {
              date: '2026-04-12',
              'salesByDate.orderedProductSales.amount': 999.99,
            },
          },
        ],
      },
      {
        sectionName: 'salesAndTrafficByAsin',
        headers: ['parentAsin', 'salesByAsin.orderedProductSales.amount'],
        records: [
          {
            recordIndex: 0,
            values: {
              parentAsin: 'B0SENSITIVE',
              'salesByAsin.orderedProductSales.amount': 50,
            },
          },
        ],
      },
    ],
  },
});

const writeStageArtifact = (args: {
  dir: string;
  reportId?: string;
  artifact?: unknown;
}) => {
  const reportId = args.reportId ?? 'report-123';
  const filePath = path.join(args.dir, `report-${reportId}.local-stage.json`);
  fs.writeFileSync(
    filePath,
    JSON.stringify(args.artifact ?? makeStageArtifact(), null, 2),
    'utf8'
  );
  return filePath;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('first Sales and Traffic canonical ingest boundary', () => {
  it('resolves the deterministic staging artifact path from report id', async () => {
    const stagingDir = makeTempDir();
    const stagingArtifactPath = writeStageArtifact({ dir: stagingDir });

    await expect(
      resolveFirstSalesTrafficStageArtifactPath({
        reportId: 'report-123',
        stagingOutputRoot: stagingDir,
      })
    ).resolves.toEqual({
      reportId: 'report-123',
      stagingArtifactPath,
    });
  });

  it('builds the canonical ingest artifact with lineage metadata and canonical records', async () => {
    const stagingDir = makeTempDir();
    const stagingArtifactPath = writeStageArtifact({ dir: stagingDir });
    const stagingArtifact = await readFirstSalesTrafficStageArtifact({
      stagingArtifactPath,
    });

    const canonicalArtifact = buildFirstSalesTrafficCanonicalIngestArtifact({
      stagingArtifact,
      stagingArtifactPath,
    });

    expect(canonicalArtifact).toMatchObject({
      canonicalIngestVersion: FIRST_REPORT_CANONICAL_INGEST_VERSION,
      ingestTarget: 'local_json_canonical_ingest',
      reportFamily: 'sales_and_traffic',
      reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
      reportId: 'report-123',
      lineage: {
        stagingArtifactPath,
        stagingVersion: 'sp-api-first-report-local-stage/v1',
        handoffArtifactPath: '/tmp/report-report-123.handoff.json',
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
    expect(canonicalArtifact.canonicalPayload.sections[0].records[0]).toEqual({
      canonicalRecordId: 'report-123:salesAndTrafficByDate:0',
      sourceRecordIndex: 0,
      values: {
        date: '2026-04-12',
        'salesByDate.orderedProductSales.amount': 999.99,
      },
    });
  });

  it('enforces lineage metadata during canonical validation', async () => {
    const stagingDir = makeTempDir();
    const stagingArtifactPath = writeStageArtifact({ dir: stagingDir });
    const stagingArtifact = await readFirstSalesTrafficStageArtifact({
      stagingArtifactPath,
    });
    const canonicalArtifact = buildFirstSalesTrafficCanonicalIngestArtifact({
      stagingArtifact,
      stagingArtifactPath,
    });

    canonicalArtifact.lineage.parsedArtifactPath = '';

    try {
      validateFirstSalesTrafficCanonicalIngestArtifact({
        stagingArtifact,
        canonicalArtifact,
      });
      throw new Error('expected canonical ingest validation to fail');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'FirstReportCanonicalIngestError',
        code: 'validation_failed',
      });
    }
  });

  it('enforces required top-level canonical ingest fields', async () => {
    const stagingDir = makeTempDir();
    const stagingArtifactPath = writeStageArtifact({ dir: stagingDir });
    const stagingArtifact = await readFirstSalesTrafficStageArtifact({
      stagingArtifactPath,
    });
    const canonicalArtifact = buildFirstSalesTrafficCanonicalIngestArtifact({
      stagingArtifact,
      stagingArtifactPath,
    });

    canonicalArtifact.canonicalIngestVersion =
      '' as typeof FIRST_REPORT_CANONICAL_INGEST_VERSION;

    try {
      validateFirstSalesTrafficCanonicalIngestArtifact({
        stagingArtifact,
        canonicalArtifact,
      });
      throw new Error('expected canonical ingest validation to fail');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'FirstReportCanonicalIngestError',
        code: 'validation_failed',
      });
    }
  });

  it('keeps section names and row counts consistent with the staging artifact', async () => {
    const stagingDir = makeTempDir();
    const stagingArtifactPath = writeStageArtifact({ dir: stagingDir });
    const stagingArtifact = await readFirstSalesTrafficStageArtifact({
      stagingArtifactPath,
    });
    const canonicalArtifact = buildFirstSalesTrafficCanonicalIngestArtifact({
      stagingArtifact,
      stagingArtifactPath,
    });

    canonicalArtifact.sections[1].rowCount = 99;

    try {
      validateFirstSalesTrafficCanonicalIngestArtifact({
        stagingArtifact,
        canonicalArtifact,
      });
      throw new Error('expected canonical ingest validation to fail');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'FirstReportCanonicalIngestError',
        code: 'validation_failed',
      });
    }
  });

  it('returns a safe summary without exposing canonical dataset rows', async () => {
    const stagingDir = makeTempDir();
    const canonicalDir = makeTempDir();
    writeStageArtifact({ dir: stagingDir });

    const summary = await runFirstSalesTrafficCanonicalIngestBoundary({
      reportId: 'report-123',
      stagingOutputRoot: stagingDir,
      canonicalOutputRoot: canonicalDir,
    });
    const serialized = JSON.stringify(summary);

    expect(serialized).toContain(
      '"canonicalIngestVersion":"sp-api-first-report-canonical-ingest/v1"'
    );
    expect(serialized).toContain('"reportId":"report-123"');
    expect(serialized).not.toContain('B0SENSITIVE');
    expect(serialized).not.toContain('999.99');
  });

  it('writes the canonical ingest artifact to the expected bounded output path', async () => {
    const stagingDir = makeTempDir();
    const canonicalDir = makeTempDir();
    const stagingArtifactPath = writeStageArtifact({ dir: stagingDir });
    const stagingArtifact = await readFirstSalesTrafficStageArtifact({
      stagingArtifactPath,
    });
    const canonicalArtifact = buildFirstSalesTrafficCanonicalIngestArtifact({
      stagingArtifact,
      stagingArtifactPath,
    });

    const canonicalIngestArtifactPath =
      await writeFirstSalesTrafficCanonicalIngestArtifact({
        canonicalArtifact,
        outputRoot: canonicalDir,
      });

    expect(canonicalIngestArtifactPath).toBe(
      buildFirstSalesTrafficCanonicalIngestArtifactPath({
        reportId: 'report-123',
        outputRoot: canonicalDir,
      })
    );
    expect(fs.existsSync(canonicalIngestArtifactPath)).toBe(true);
  });

  it('raises a typed error for malformed staging input', async () => {
    const stagingDir = makeTempDir();
    const stagingArtifactPath = writeStageArtifact({
      dir: stagingDir,
      artifact: {
        ...makeStageArtifact(),
        sections: [
          {
            sectionName: 'salesAndTrafficByDate',
            headerCount: 1,
            rowCount: 2,
          },
        ],
        totalRowCount: 1,
        stagedPayload: {
          sections: [
            {
              sectionName: 'salesAndTrafficByDate',
              headers: ['date'],
              records: [
                {
                  recordIndex: 0,
                  values: { date: '2026-04-12' },
                },
              ],
            },
          ],
        },
      },
    });

    await expect(
      readFirstSalesTrafficStageArtifact({
        stagingArtifactPath,
      })
    ).rejects.toMatchObject({
      name: 'FirstReportCanonicalIngestError',
      code: 'invalid_content',
    });
  });
});
