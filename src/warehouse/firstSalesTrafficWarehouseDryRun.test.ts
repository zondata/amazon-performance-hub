import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  buildFirstSalesTrafficWarehouseAdapterMapping,
  readFirstSalesTrafficWarehouseReadyArtifact,
  writeFirstSalesTrafficWarehouseAdapterMapping,
} from './firstSalesTrafficWarehouseMapping';
import {
  FIRST_REPORT_WAREHOUSE_ADAPTER_DRY_RUN_VERSION,
  buildFirstSalesTrafficWarehouseAdapterDryRun,
  buildFirstSalesTrafficWarehouseAdapterDryRunPath,
  readFirstSalesTrafficWarehouseAdapterMappingArtifact,
  resolveFirstSalesTrafficWarehouseMappingArtifactPath,
  runFirstSalesTrafficWarehouseAdapterDryRun,
  validateFirstSalesTrafficWarehouseAdapterDryRun,
  validateFirstSalesTrafficWarehouseAdapterDryRunInputs,
  writeFirstSalesTrafficWarehouseAdapterDryRun,
} from './firstSalesTrafficWarehouseDryRun';

const tempDirs: string[] = [];

const makeTempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spapi-warehouse-dry-run-test-'));
  tempDirs.push(dir);
  return dir;
};

const makeWarehouseReadyArtifact = () => ({
  warehouseReadyContractVersion: 'sp-api-first-report-warehouse-ready/v1',
  contractTarget: 'local_json_warehouse_ready_contract' as const,
  contractTargetDescription:
    'Deterministic local warehouse-ready contract artifact for promotion proof only; not a warehouse write',
  reportFamily: 'sales_and_traffic' as const,
  reportType: 'GET_SALES_AND_TRAFFIC_REPORT' as const,
  reportId: 'report-123',
  lineage: {
    canonicalIngestArtifactPath: '/tmp/report-report-123.canonical-ingest.json',
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
  warehouseReadyPayload: {
    recordBatches: [
      {
        sectionName: 'salesAndTrafficByDate',
        targetTableName: 'spapi_sales_and_traffic_by_date_report_rows',
        keyColumns: [
          'report_id',
          'report_family',
          'report_type',
          'section_name',
          'canonical_record_id',
        ],
        columnNames: [
          'report_id',
          'report_family',
          'report_type',
          'section_name',
          'canonical_record_id',
          'source_record_index',
          'date',
          'salesByDate.orderedProductSales.amount',
        ],
        rows: [
          {
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
          },
        ],
      },
      {
        sectionName: 'salesAndTrafficByAsin',
        targetTableName: 'spapi_sales_and_traffic_by_asin_report_rows',
        keyColumns: [
          'report_id',
          'report_family',
          'report_type',
          'section_name',
          'canonical_record_id',
        ],
        columnNames: [
          'report_id',
          'report_family',
          'report_type',
          'section_name',
          'canonical_record_id',
          'source_record_index',
          'parentAsin',
          'salesByAsin.orderedProductSales.amount',
        ],
        rows: [
          {
            warehouseRecordId: 'report-123:salesAndTrafficByAsin:0',
            canonicalRecordId: 'report-123:salesAndTrafficByAsin:0',
            rowValues: {
              report_id: 'report-123',
              report_family: 'sales_and_traffic',
              report_type: 'GET_SALES_AND_TRAFFIC_REPORT',
              section_name: 'salesAndTrafficByAsin',
              canonical_record_id: 'report-123:salesAndTrafficByAsin:0',
              source_record_index: 0,
              parentAsin: 'B0SENSITIVE',
              'salesByAsin.orderedProductSales.amount': 50,
            },
          },
        ],
      },
    ],
  },
});

const writeWarehouseReadyArtifact = (args: {
  dir: string;
  reportId?: string;
  artifact?: unknown;
}) => {
  const reportId = args.reportId ?? 'report-123';
  const filePath = path.join(args.dir, `report-${reportId}.warehouse-ready.json`);
  fs.writeFileSync(
    filePath,
    JSON.stringify(args.artifact ?? makeWarehouseReadyArtifact(), null, 2),
    'utf8'
  );
  return filePath;
};

const writeWarehouseMappingArtifact = async (args: {
  warehouseReadyArtifactPath: string;
  outputRoot: string;
}) => {
  const warehouseReadyArtifact = await readFirstSalesTrafficWarehouseReadyArtifact({
    warehouseReadyArtifactPath: args.warehouseReadyArtifactPath,
  });
  const mappingArtifact = buildFirstSalesTrafficWarehouseAdapterMapping({
    warehouseReadyArtifact,
    warehouseReadyArtifactPath: args.warehouseReadyArtifactPath,
  });

  const warehouseMappingArtifactPath =
    await writeFirstSalesTrafficWarehouseAdapterMapping({
      mappingArtifact,
      outputRoot: args.outputRoot,
    });

  return {
    mappingArtifact,
    warehouseMappingArtifactPath,
  };
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('first Sales and Traffic warehouse adapter dry-run boundary', () => {
  it('resolves the deterministic warehouse-mapping artifact path from report id', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseMappingDir = makeTempDir();
    const warehouseReadyArtifactPath = writeWarehouseReadyArtifact({
      dir: warehouseReadyDir,
    });
    const { warehouseMappingArtifactPath } = await writeWarehouseMappingArtifact({
      warehouseReadyArtifactPath,
      outputRoot: warehouseMappingDir,
    });

    await expect(
      resolveFirstSalesTrafficWarehouseMappingArtifactPath({
        reportId: 'report-123',
        warehouseMappingOutputRoot: warehouseMappingDir,
      })
    ).resolves.toEqual({
      reportId: 'report-123',
      warehouseMappingArtifactPath,
    });
  });

  it('cross-validates warehouse-ready and warehouse-mapping artifacts before dry-run planning', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseMappingDir = makeTempDir();
    const warehouseReadyArtifactPath = writeWarehouseReadyArtifact({
      dir: warehouseReadyDir,
    });
    const warehouseReadyArtifact = await readFirstSalesTrafficWarehouseReadyArtifact({
      warehouseReadyArtifactPath,
    });
    const { warehouseMappingArtifactPath } = await writeWarehouseMappingArtifact({
      warehouseReadyArtifactPath,
      outputRoot: warehouseMappingDir,
    });
    const warehouseMappingArtifact =
      await readFirstSalesTrafficWarehouseAdapterMappingArtifact({
        warehouseMappingArtifactPath,
      });

    warehouseMappingArtifact.sections[0].rowCount = 99;

    try {
      validateFirstSalesTrafficWarehouseAdapterDryRunInputs({
        warehouseReadyArtifact,
        warehouseMappingArtifact,
      });
      throw new Error('expected warehouse adapter dry-run input validation to fail');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'FirstReportWarehouseDryRunError',
        code: 'validation_failed',
      });
    }
  });

  it('builds the dry-run artifact with deterministic operation summaries and lineage', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseMappingDir = makeTempDir();
    const warehouseReadyArtifactPath = writeWarehouseReadyArtifact({
      dir: warehouseReadyDir,
    });
    const warehouseReadyArtifact = await readFirstSalesTrafficWarehouseReadyArtifact({
      warehouseReadyArtifactPath,
    });
    const { warehouseMappingArtifactPath } = await writeWarehouseMappingArtifact({
      warehouseReadyArtifactPath,
      outputRoot: warehouseMappingDir,
    });
    const warehouseMappingArtifact =
      await readFirstSalesTrafficWarehouseAdapterMappingArtifact({
        warehouseMappingArtifactPath,
      });

    const dryRunArtifact = buildFirstSalesTrafficWarehouseAdapterDryRun({
      warehouseReadyArtifact,
      warehouseReadyArtifactPath,
      warehouseMappingArtifact,
      warehouseMappingArtifactPath,
    });

    expect(dryRunArtifact).toMatchObject({
      warehouseAdapterDryRunVersion:
        FIRST_REPORT_WAREHOUSE_ADAPTER_DRY_RUN_VERSION,
      dryRunTarget: 'local_json_warehouse_adapter_dry_run',
      reportFamily: 'sales_and_traffic',
      reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
      reportId: 'report-123',
      lineage: {
        warehouseReadyArtifactPath,
        warehouseMappingArtifactPath,
        warehouseReadyContractVersion: 'sp-api-first-report-warehouse-ready/v1',
        warehouseAdapterMappingVersion:
          'sp-api-first-report-warehouse-adapter-mapping/v1',
        canonicalIngestArtifactPath: '/tmp/report-report-123.canonical-ingest.json',
        canonicalIngestVersion: 'sp-api-first-report-canonical-ingest/v1',
        stagingArtifactPath: '/tmp/report-report-123.local-stage.json',
        stagingVersion: 'sp-api-first-report-local-stage/v1',
        handoffArtifactPath: '/tmp/report-report-123.handoff.json',
        handoffSchemaVersion: 'sp-api-first-report-handoff/v1',
        parsedArtifactPath: '/tmp/report-report-123.parsed.json',
        rawArtifactPath: '/tmp/report-report-123.document.raw.gz',
      },
      totalRowCount: 2,
      dryRunPayload: {
        mode: 'dry_run',
        writesAttempted: false,
        writesAttemptedCount: 0,
      },
    });
    expect(dryRunArtifact.dryRunPayload.targetOperations[0]).toMatchObject({
      sectionName: 'salesAndTrafficByDate',
      targetTableName: 'spapi_sales_and_traffic_by_date_report_rows',
      sourceBatchPath: 'warehouseReadyPayload.recordBatches[0].rows',
      plannedOperation: 'prepare_local_dry_run_warehouse_adapter_batch',
      operationStatus: 'dry_run_only',
      keyColumns: [
        'report_id',
        'report_family',
        'report_type',
        'section_name',
        'canonical_record_id',
      ],
      mappedColumnCount: 8,
      sourceRowCount: 1,
      writesAttempted: false,
      writesAttemptedCount: 0,
      dryRunPreview: {
        sampleWarehouseRecordIds: ['report-123:salesAndTrafficByDate:0'],
        sampleCanonicalRecordIds: ['report-123:salesAndTrafficByDate:0'],
      },
    });
  });

  it('enforces lineage metadata during dry-run validation', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseMappingDir = makeTempDir();
    const warehouseReadyArtifactPath = writeWarehouseReadyArtifact({
      dir: warehouseReadyDir,
    });
    const warehouseReadyArtifact = await readFirstSalesTrafficWarehouseReadyArtifact({
      warehouseReadyArtifactPath,
    });
    const { warehouseMappingArtifactPath } = await writeWarehouseMappingArtifact({
      warehouseReadyArtifactPath,
      outputRoot: warehouseMappingDir,
    });
    const warehouseMappingArtifact =
      await readFirstSalesTrafficWarehouseAdapterMappingArtifact({
        warehouseMappingArtifactPath,
      });
    const dryRunArtifact = buildFirstSalesTrafficWarehouseAdapterDryRun({
      warehouseReadyArtifact,
      warehouseReadyArtifactPath,
      warehouseMappingArtifact,
      warehouseMappingArtifactPath,
    });

    dryRunArtifact.lineage.warehouseMappingArtifactPath = '';

    try {
      validateFirstSalesTrafficWarehouseAdapterDryRun({
        warehouseReadyArtifact,
        warehouseMappingArtifact,
        dryRunArtifact,
      });
      throw new Error('expected warehouse adapter dry-run validation to fail');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'FirstReportWarehouseDryRunError',
        code: 'validation_failed',
      });
    }
  });

  it('enforces required top-level warehouse adapter dry-run fields', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseMappingDir = makeTempDir();
    const warehouseReadyArtifactPath = writeWarehouseReadyArtifact({
      dir: warehouseReadyDir,
    });
    const warehouseReadyArtifact = await readFirstSalesTrafficWarehouseReadyArtifact({
      warehouseReadyArtifactPath,
    });
    const { warehouseMappingArtifactPath } = await writeWarehouseMappingArtifact({
      warehouseReadyArtifactPath,
      outputRoot: warehouseMappingDir,
    });
    const warehouseMappingArtifact =
      await readFirstSalesTrafficWarehouseAdapterMappingArtifact({
        warehouseMappingArtifactPath,
      });
    const dryRunArtifact = buildFirstSalesTrafficWarehouseAdapterDryRun({
      warehouseReadyArtifact,
      warehouseReadyArtifactPath,
      warehouseMappingArtifact,
      warehouseMappingArtifactPath,
    });

    dryRunArtifact.warehouseAdapterDryRunVersion =
      '' as typeof FIRST_REPORT_WAREHOUSE_ADAPTER_DRY_RUN_VERSION;

    try {
      validateFirstSalesTrafficWarehouseAdapterDryRun({
        warehouseReadyArtifact,
        warehouseMappingArtifact,
        dryRunArtifact,
      });
      throw new Error('expected warehouse adapter dry-run validation to fail');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'FirstReportWarehouseDryRunError',
        code: 'validation_failed',
      });
    }
  });

  it('returns a safe summary without exposing source payload row contents', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseMappingDir = makeTempDir();
    const warehouseDryRunDir = makeTempDir();
    const warehouseReadyArtifactPath = writeWarehouseReadyArtifact({
      dir: warehouseReadyDir,
    });
    await writeWarehouseMappingArtifact({
      warehouseReadyArtifactPath,
      outputRoot: warehouseMappingDir,
    });

    const summary = await runFirstSalesTrafficWarehouseAdapterDryRun({
      reportId: 'report-123',
      warehouseReadyOutputRoot: warehouseReadyDir,
      warehouseMappingOutputRoot: warehouseMappingDir,
      warehouseDryRunOutputRoot: warehouseDryRunDir,
    });
    const serialized = JSON.stringify(summary);

    expect(serialized).toContain(
      '"warehouseAdapterDryRunVersion":"sp-api-first-report-warehouse-adapter-dry-run/v1"'
    );
    expect(serialized).toContain('"reportId":"report-123"');
    expect(serialized).toContain('spapi_sales_and_traffic_by_date_report_rows');
    expect(serialized).not.toContain('B0SENSITIVE');
    expect(serialized).not.toContain('999.99');
  });

  it('writes the dry-run artifact to the expected bounded output path', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseMappingDir = makeTempDir();
    const warehouseDryRunDir = makeTempDir();
    const warehouseReadyArtifactPath = writeWarehouseReadyArtifact({
      dir: warehouseReadyDir,
    });
    const warehouseReadyArtifact = await readFirstSalesTrafficWarehouseReadyArtifact({
      warehouseReadyArtifactPath,
    });
    const { warehouseMappingArtifactPath } = await writeWarehouseMappingArtifact({
      warehouseReadyArtifactPath,
      outputRoot: warehouseMappingDir,
    });
    const warehouseMappingArtifact =
      await readFirstSalesTrafficWarehouseAdapterMappingArtifact({
        warehouseMappingArtifactPath,
      });
    const dryRunArtifact = buildFirstSalesTrafficWarehouseAdapterDryRun({
      warehouseReadyArtifact,
      warehouseReadyArtifactPath,
      warehouseMappingArtifact,
      warehouseMappingArtifactPath,
    });

    const warehouseDryRunArtifactPath =
      await writeFirstSalesTrafficWarehouseAdapterDryRun({
        dryRunArtifact,
        outputRoot: warehouseDryRunDir,
      });

    expect(warehouseDryRunArtifactPath).toBe(
      buildFirstSalesTrafficWarehouseAdapterDryRunPath({
        reportId: 'report-123',
        outputRoot: warehouseDryRunDir,
      })
    );
    expect(fs.existsSync(warehouseDryRunArtifactPath)).toBe(true);
  });

  it('raises a typed error for malformed or mismatched warehouse-mapping input', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseMappingDir = makeTempDir();
    const warehouseReadyArtifactPath = writeWarehouseReadyArtifact({
      dir: warehouseReadyDir,
    });
    const { warehouseMappingArtifactPath } = await writeWarehouseMappingArtifact({
      warehouseReadyArtifactPath,
      outputRoot: warehouseMappingDir,
    });
    const malformedArtifact = JSON.parse(
      fs.readFileSync(warehouseMappingArtifactPath, 'utf8')
    ) as Record<string, unknown>;
    malformedArtifact.sections = [
      {
        sectionName: 'salesAndTrafficByDate',
        headerCount: 1,
        rowCount: 5,
        targetTableName: 'spapi_sales_and_traffic_by_date_report_rows',
      },
    ];
    fs.writeFileSync(
      warehouseMappingArtifactPath,
      JSON.stringify(malformedArtifact, null, 2),
      'utf8'
    );

    await expect(
      readFirstSalesTrafficWarehouseAdapterMappingArtifact({
        warehouseMappingArtifactPath,
      })
    ).rejects.toMatchObject({
      name: 'FirstReportWarehouseDryRunError',
      code: 'invalid_content',
    });
  });
});
