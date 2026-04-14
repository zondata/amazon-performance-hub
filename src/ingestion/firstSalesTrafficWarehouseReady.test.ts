import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION,
  buildFirstSalesTrafficWarehouseReadyArtifact,
  buildFirstSalesTrafficWarehouseReadyArtifactPath,
  readFirstSalesTrafficCanonicalArtifact,
  resolveFirstSalesTrafficCanonicalArtifactPath,
  runFirstSalesTrafficWarehouseReadyContractPromotion,
  validateFirstSalesTrafficWarehouseReadyArtifact,
  writeFirstSalesTrafficWarehouseReadyArtifact,
} from './firstSalesTrafficWarehouseReady';

const tempDirs: string[] = [];

const makeTempDir = () => {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'spapi-warehouse-ready-test-')
  );
  tempDirs.push(dir);
  return dir;
};

const makeCanonicalArtifact = () => ({
  canonicalIngestVersion: 'sp-api-first-report-canonical-ingest/v1',
  ingestTarget: 'local_json_canonical_ingest' as const,
  ingestTargetDescription:
    'Deterministic local canonical ingest artifact for explicit ingestion-boundary proof only; not a warehouse target',
  reportFamily: 'sales_and_traffic' as const,
  reportType: 'GET_SALES_AND_TRAFFIC_REPORT' as const,
  reportId: 'report-123',
  lineage: {
    stagingArtifactPath: '/tmp/report-report-123.local-stage.json',
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
  canonicalPayload: {
    sections: [
      {
        sectionName: 'salesAndTrafficByDate',
        fieldNames: ['date', 'salesByDate.orderedProductSales.amount'],
        records: [
          {
            canonicalRecordId: 'report-123:salesAndTrafficByDate:0',
            sourceRecordIndex: 0,
            values: {
              date: '2026-04-12',
              'salesByDate.orderedProductSales.amount': 999.99,
            },
          },
        ],
      },
      {
        sectionName: 'salesAndTrafficByAsin',
        fieldNames: ['parentAsin', 'salesByAsin.orderedProductSales.amount'],
        records: [
          {
            canonicalRecordId: 'report-123:salesAndTrafficByAsin:0',
            sourceRecordIndex: 0,
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

const writeCanonicalArtifact = (args: {
  dir: string;
  reportId?: string;
  artifact?: unknown;
}) => {
  const reportId = args.reportId ?? 'report-123';
  const filePath = path.join(args.dir, `report-${reportId}.canonical-ingest.json`);
  fs.writeFileSync(
    filePath,
    JSON.stringify(args.artifact ?? makeCanonicalArtifact(), null, 2),
    'utf8'
  );
  return filePath;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('first Sales and Traffic warehouse-ready promotion boundary', () => {
  it('resolves the deterministic canonical ingest artifact path from report id', async () => {
    const canonicalDir = makeTempDir();
    const canonicalIngestArtifactPath = writeCanonicalArtifact({ dir: canonicalDir });

    await expect(
      resolveFirstSalesTrafficCanonicalArtifactPath({
        reportId: 'report-123',
        canonicalOutputRoot: canonicalDir,
      })
    ).resolves.toEqual({
      reportId: 'report-123',
      canonicalIngestArtifactPath,
    });
  });

  it('builds the warehouse-ready artifact with lineage metadata and record batches', async () => {
    const canonicalDir = makeTempDir();
    const canonicalIngestArtifactPath = writeCanonicalArtifact({ dir: canonicalDir });
    const canonicalArtifact = await readFirstSalesTrafficCanonicalArtifact({
      canonicalIngestArtifactPath,
    });

    const warehouseReadyArtifact = buildFirstSalesTrafficWarehouseReadyArtifact({
      canonicalArtifact,
      canonicalIngestArtifactPath,
    });

    expect(warehouseReadyArtifact).toMatchObject({
      warehouseReadyContractVersion: FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION,
      contractTarget: 'local_json_warehouse_ready_contract',
      reportFamily: 'sales_and_traffic',
      reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
      reportId: 'report-123',
      lineage: {
        canonicalIngestArtifactPath,
        canonicalIngestVersion: 'sp-api-first-report-canonical-ingest/v1',
        stagingArtifactPath: '/tmp/report-report-123.local-stage.json',
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
          targetTableName: 'spapi_sales_and_traffic_by_date_report_rows',
        },
        {
          sectionName: 'salesAndTrafficByAsin',
          headerCount: 2,
          rowCount: 1,
          targetTableName: 'spapi_sales_and_traffic_by_asin_report_rows',
        },
      ],
      totalRowCount: 2,
    });
    expect(
      warehouseReadyArtifact.warehouseReadyPayload.recordBatches[0].rows[0]
    ).toEqual({
      warehouseRecordId: 'report-123:salesAndTrafficByDate:0',
      canonicalRecordId: 'report-123:salesAndTrafficByDate:0',
      rowValues: {
        report_id: 'report-123',
        report_family: 'sales_and_traffic',
        report_type: 'GET_SALES_AND_TRAFFIC_REPORT',
        section_name: 'salesAndTrafficByDate',
        canonical_record_id: 'report-123:salesAndTrafficByDate:0',
        source_record_index: 0,
        date: '2026-04-12',
        'salesByDate.orderedProductSales.amount': 999.99,
      },
    });
  });

  it('enforces lineage metadata during warehouse-ready validation', async () => {
    const canonicalDir = makeTempDir();
    const canonicalIngestArtifactPath = writeCanonicalArtifact({ dir: canonicalDir });
    const canonicalArtifact = await readFirstSalesTrafficCanonicalArtifact({
      canonicalIngestArtifactPath,
    });
    const warehouseReadyArtifact = buildFirstSalesTrafficWarehouseReadyArtifact({
      canonicalArtifact,
      canonicalIngestArtifactPath,
    });

    warehouseReadyArtifact.lineage.rawArtifactPath = '';

    try {
      validateFirstSalesTrafficWarehouseReadyArtifact({
        canonicalArtifact,
        warehouseReadyArtifact,
      });
      throw new Error('expected warehouse-ready validation to fail');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'FirstReportWarehouseReadyError',
        code: 'validation_failed',
      });
    }
  });

  it('enforces required top-level warehouse-ready contract fields', async () => {
    const canonicalDir = makeTempDir();
    const canonicalIngestArtifactPath = writeCanonicalArtifact({ dir: canonicalDir });
    const canonicalArtifact = await readFirstSalesTrafficCanonicalArtifact({
      canonicalIngestArtifactPath,
    });
    const warehouseReadyArtifact = buildFirstSalesTrafficWarehouseReadyArtifact({
      canonicalArtifact,
      canonicalIngestArtifactPath,
    });

    warehouseReadyArtifact.warehouseReadyContractVersion =
      '' as typeof FIRST_REPORT_WAREHOUSE_READY_CONTRACT_VERSION;

    try {
      validateFirstSalesTrafficWarehouseReadyArtifact({
        canonicalArtifact,
        warehouseReadyArtifact,
      });
      throw new Error('expected warehouse-ready validation to fail');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'FirstReportWarehouseReadyError',
        code: 'validation_failed',
      });
    }
  });

  it('keeps section names and row counts consistent with the canonical ingest artifact', async () => {
    const canonicalDir = makeTempDir();
    const canonicalIngestArtifactPath = writeCanonicalArtifact({ dir: canonicalDir });
    const canonicalArtifact = await readFirstSalesTrafficCanonicalArtifact({
      canonicalIngestArtifactPath,
    });
    const warehouseReadyArtifact = buildFirstSalesTrafficWarehouseReadyArtifact({
      canonicalArtifact,
      canonicalIngestArtifactPath,
    });

    warehouseReadyArtifact.sections[1].rowCount = 99;

    try {
      validateFirstSalesTrafficWarehouseReadyArtifact({
        canonicalArtifact,
        warehouseReadyArtifact,
      });
      throw new Error('expected warehouse-ready validation to fail');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'FirstReportWarehouseReadyError',
        code: 'validation_failed',
      });
    }
  });

  it('returns a safe summary without exposing warehouse-ready dataset rows', async () => {
    const canonicalDir = makeTempDir();
    const warehouseReadyDir = makeTempDir();
    writeCanonicalArtifact({ dir: canonicalDir });

    const summary = await runFirstSalesTrafficWarehouseReadyContractPromotion({
      reportId: 'report-123',
      canonicalOutputRoot: canonicalDir,
      warehouseReadyOutputRoot: warehouseReadyDir,
    });
    const serialized = JSON.stringify(summary);

    expect(serialized).toContain(
      '"warehouseReadyContractVersion":"sp-api-first-report-warehouse-ready/v1"'
    );
    expect(serialized).toContain('"reportId":"report-123"');
    expect(serialized).not.toContain('B0SENSITIVE');
    expect(serialized).not.toContain('999.99');
  });

  it('writes the warehouse-ready artifact to the expected bounded output path', async () => {
    const canonicalDir = makeTempDir();
    const warehouseReadyDir = makeTempDir();
    const canonicalIngestArtifactPath = writeCanonicalArtifact({ dir: canonicalDir });
    const canonicalArtifact = await readFirstSalesTrafficCanonicalArtifact({
      canonicalIngestArtifactPath,
    });
    const warehouseReadyArtifact = buildFirstSalesTrafficWarehouseReadyArtifact({
      canonicalArtifact,
      canonicalIngestArtifactPath,
    });

    const warehouseReadyArtifactPath =
      await writeFirstSalesTrafficWarehouseReadyArtifact({
        warehouseReadyArtifact,
        outputRoot: warehouseReadyDir,
      });

    expect(warehouseReadyArtifactPath).toBe(
      buildFirstSalesTrafficWarehouseReadyArtifactPath({
        reportId: 'report-123',
        outputRoot: warehouseReadyDir,
      })
    );
    expect(fs.existsSync(warehouseReadyArtifactPath)).toBe(true);
  });

  it('raises a typed error for malformed canonical ingest input', async () => {
    const canonicalDir = makeTempDir();
    const canonicalIngestArtifactPath = writeCanonicalArtifact({
      dir: canonicalDir,
      artifact: {
        ...makeCanonicalArtifact(),
        sections: [
          {
            sectionName: 'salesAndTrafficByDate',
            headerCount: 1,
            rowCount: 2,
          },
        ],
        totalRowCount: 1,
        canonicalPayload: {
          sections: [
            {
              sectionName: 'salesAndTrafficByDate',
              fieldNames: ['date'],
              records: [
                {
                  canonicalRecordId: 'report-123:salesAndTrafficByDate:0',
                  sourceRecordIndex: 0,
                  values: { date: '2026-04-12' },
                },
              ],
            },
          ],
        },
      },
    });

    await expect(
      readFirstSalesTrafficCanonicalArtifact({
        canonicalIngestArtifactPath,
      })
    ).rejects.toMatchObject({
      name: 'FirstReportWarehouseReadyError',
      code: 'invalid_content',
    });
  });
});
