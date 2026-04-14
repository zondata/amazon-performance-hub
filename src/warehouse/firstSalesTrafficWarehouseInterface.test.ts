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
  buildFirstSalesTrafficWarehouseAdapterDryRun,
  writeFirstSalesTrafficWarehouseAdapterDryRun,
  readFirstSalesTrafficWarehouseAdapterMappingArtifact,
} from './firstSalesTrafficWarehouseDryRun';
import {
  FIRST_REPORT_WAREHOUSE_ADAPTER_INTERFACE_VERSION,
  buildFirstSalesTrafficWarehouseAdapterInterface,
  buildFirstSalesTrafficWarehouseAdapterInterfacePath,
  readFirstSalesTrafficWarehouseAdapterDryRunArtifact,
  resolveFirstSalesTrafficWarehouseDryRunArtifactPath,
  runFirstSalesTrafficWarehouseAdapterInterfaceDefinition,
  validateFirstSalesTrafficWarehouseAdapterInterface,
  writeFirstSalesTrafficWarehouseAdapterInterface,
} from './firstSalesTrafficWarehouseInterface';

const tempDirs: string[] = [];

const makeTempDir = () => {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'spapi-warehouse-interface-test-')
  );
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
    warehouseMappingArtifactPath,
  };
};

const writeWarehouseDryRunArtifact = async (args: {
  warehouseReadyArtifactPath: string;
  warehouseMappingArtifactPath: string;
  outputRoot: string;
}) => {
  const warehouseReadyArtifact = await readFirstSalesTrafficWarehouseReadyArtifact({
    warehouseReadyArtifactPath: args.warehouseReadyArtifactPath,
  });
  const warehouseMappingArtifact =
    await readFirstSalesTrafficWarehouseAdapterMappingArtifact({
      warehouseMappingArtifactPath: args.warehouseMappingArtifactPath,
    });
  const dryRunArtifact = buildFirstSalesTrafficWarehouseAdapterDryRun({
    warehouseReadyArtifact,
    warehouseReadyArtifactPath: args.warehouseReadyArtifactPath,
    warehouseMappingArtifact,
    warehouseMappingArtifactPath: args.warehouseMappingArtifactPath,
  });

  const warehouseDryRunArtifactPath =
    await writeFirstSalesTrafficWarehouseAdapterDryRun({
      dryRunArtifact,
      outputRoot: args.outputRoot,
    });

  return {
    warehouseDryRunArtifactPath,
  };
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('first Sales and Traffic warehouse adapter interface boundary', () => {
  it('resolves the deterministic warehouse dry-run artifact path from report id', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseMappingDir = makeTempDir();
    const warehouseDryRunDir = makeTempDir();
    const warehouseReadyArtifactPath = writeWarehouseReadyArtifact({
      dir: warehouseReadyDir,
    });
    const { warehouseMappingArtifactPath } = await writeWarehouseMappingArtifact({
      warehouseReadyArtifactPath,
      outputRoot: warehouseMappingDir,
    });
    const { warehouseDryRunArtifactPath } = await writeWarehouseDryRunArtifact({
      warehouseReadyArtifactPath,
      warehouseMappingArtifactPath,
      outputRoot: warehouseDryRunDir,
    });

    await expect(
      resolveFirstSalesTrafficWarehouseDryRunArtifactPath({
        reportId: 'report-123',
        warehouseDryRunOutputRoot: warehouseDryRunDir,
      })
    ).resolves.toEqual({
      reportId: 'report-123',
      warehouseDryRunArtifactPath,
    });
  });

  it('builds the interface artifact with deterministic target interfaces and lineage', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseMappingDir = makeTempDir();
    const warehouseDryRunDir = makeTempDir();
    const warehouseReadyArtifactPath = writeWarehouseReadyArtifact({
      dir: warehouseReadyDir,
    });
    const { warehouseMappingArtifactPath } = await writeWarehouseMappingArtifact({
      warehouseReadyArtifactPath,
      outputRoot: warehouseMappingDir,
    });
    const { warehouseDryRunArtifactPath } = await writeWarehouseDryRunArtifact({
      warehouseReadyArtifactPath,
      warehouseMappingArtifactPath,
      outputRoot: warehouseDryRunDir,
    });
    const warehouseDryRunArtifact =
      await readFirstSalesTrafficWarehouseAdapterDryRunArtifact({
        warehouseDryRunArtifactPath,
      });

    const interfaceArtifact = buildFirstSalesTrafficWarehouseAdapterInterface({
      warehouseDryRunArtifact,
      warehouseDryRunArtifactPath,
    });

    expect(interfaceArtifact).toMatchObject({
      warehouseAdapterInterfaceVersion:
        FIRST_REPORT_WAREHOUSE_ADAPTER_INTERFACE_VERSION,
      reportFamily: 'sales_and_traffic',
      reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
      reportId: 'report-123',
      lineage: {
        warehouseDryRunArtifactPath,
        warehouseAdapterDryRunVersion:
          'sp-api-first-report-warehouse-adapter-dry-run/v1',
        warehouseMappingArtifactPath,
        warehouseAdapterMappingVersion:
          'sp-api-first-report-warehouse-adapter-mapping/v1',
        warehouseReadyArtifactPath,
        warehouseReadyContractVersion: 'sp-api-first-report-warehouse-ready/v1',
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
      interfacePayload: {
        mode: 'interface_only',
        writesAttempted: false,
        implementationPresent: false,
        executionAllowed: false,
      },
    });
    expect(interfaceArtifact.interfacePayload.targetInterfaces[0]).toMatchObject({
      sectionName: 'salesAndTrafficByDate',
      targetTableName: 'spapi_sales_and_traffic_by_date_report_rows',
      operationName:
        'execute_spapi_sales_and_traffic_by_date_report_rows_warehouse_adapter_write',
      keyColumns: [
        'report_id',
        'report_family',
        'report_type',
        'section_name',
        'canonical_record_id',
      ],
      mappedColumnCount: 8,
      requestContract: {
        artifactType: 'warehouse_adapter_dry_run_artifact',
        artifactVersion: 'sp-api-first-report-warehouse-adapter-dry-run/v1',
        acceptedMode: 'dry_run',
        acceptedTargetTableName: 'spapi_sales_and_traffic_by_date_report_rows',
      },
      responseContract: {
        resultType: 'warehouse_adapter_interface_result',
        successStatus: 'interface_only',
        writesAttempted: false,
        implementationPresent: false,
        executionAllowed: false,
      },
      executionFlags: {
        mode: 'interface_only',
        writesAttempted: false,
        implementationPresent: false,
        executionAllowed: false,
      },
    });
  });

  it('validates lineage metadata and required top-level fields', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseMappingDir = makeTempDir();
    const warehouseDryRunDir = makeTempDir();
    const warehouseReadyArtifactPath = writeWarehouseReadyArtifact({
      dir: warehouseReadyDir,
    });
    const { warehouseMappingArtifactPath } = await writeWarehouseMappingArtifact({
      warehouseReadyArtifactPath,
      outputRoot: warehouseMappingDir,
    });
    const { warehouseDryRunArtifactPath } = await writeWarehouseDryRunArtifact({
      warehouseReadyArtifactPath,
      warehouseMappingArtifactPath,
      outputRoot: warehouseDryRunDir,
    });
    const warehouseDryRunArtifact =
      await readFirstSalesTrafficWarehouseAdapterDryRunArtifact({
        warehouseDryRunArtifactPath,
      });
    const interfaceArtifact = buildFirstSalesTrafficWarehouseAdapterInterface({
      warehouseDryRunArtifact,
      warehouseDryRunArtifactPath,
    });

    interfaceArtifact.lineage.warehouseDryRunArtifactPath = '';

    try {
      validateFirstSalesTrafficWarehouseAdapterInterface({
        warehouseDryRunArtifact,
        interfaceArtifact,
      });
      throw new Error('expected warehouse adapter interface validation to fail');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'FirstReportWarehouseInterfaceError',
        code: 'validation_failed',
      });
    }
  });

  it('requires interface payload flags to remain no-write and no-implementation', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseMappingDir = makeTempDir();
    const warehouseDryRunDir = makeTempDir();
    const warehouseReadyArtifactPath = writeWarehouseReadyArtifact({
      dir: warehouseReadyDir,
    });
    const { warehouseMappingArtifactPath } = await writeWarehouseMappingArtifact({
      warehouseReadyArtifactPath,
      outputRoot: warehouseMappingDir,
    });
    const { warehouseDryRunArtifactPath } = await writeWarehouseDryRunArtifact({
      warehouseReadyArtifactPath,
      warehouseMappingArtifactPath,
      outputRoot: warehouseDryRunDir,
    });
    const warehouseDryRunArtifact =
      await readFirstSalesTrafficWarehouseAdapterDryRunArtifact({
        warehouseDryRunArtifactPath,
      });
    const interfaceArtifact = buildFirstSalesTrafficWarehouseAdapterInterface({
      warehouseDryRunArtifact,
      warehouseDryRunArtifactPath,
    });

    interfaceArtifact.interfacePayload.implementationPresent =
      true as false;

    try {
      validateFirstSalesTrafficWarehouseAdapterInterface({
        warehouseDryRunArtifact,
        interfaceArtifact,
      });
      throw new Error('expected warehouse adapter interface validation to fail');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'FirstReportWarehouseInterfaceError',
        code: 'validation_failed',
      });
    }
  });

  it('returns a safe summary without exposing dry-run payload contents', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseMappingDir = makeTempDir();
    const warehouseDryRunDir = makeTempDir();
    const warehouseInterfaceDir = makeTempDir();
    const warehouseReadyArtifactPath = writeWarehouseReadyArtifact({
      dir: warehouseReadyDir,
    });
    const { warehouseMappingArtifactPath } = await writeWarehouseMappingArtifact({
      warehouseReadyArtifactPath,
      outputRoot: warehouseMappingDir,
    });
    await writeWarehouseDryRunArtifact({
      warehouseReadyArtifactPath,
      warehouseMappingArtifactPath,
      outputRoot: warehouseDryRunDir,
    });

    const summary = await runFirstSalesTrafficWarehouseAdapterInterfaceDefinition({
      reportId: 'report-123',
      warehouseDryRunOutputRoot: warehouseDryRunDir,
      warehouseInterfaceOutputRoot: warehouseInterfaceDir,
    });
    const serialized = JSON.stringify(summary);

    expect(serialized).toContain(
      '"warehouseAdapterInterfaceVersion":"sp-api-first-report-warehouse-adapter-interface/v1"'
    );
    expect(serialized).toContain('"reportId":"report-123"');
    expect(serialized).toContain(
      'execute_spapi_sales_and_traffic_by_date_report_rows_warehouse_adapter_write'
    );
    expect(serialized).not.toContain('B0SENSITIVE');
    expect(serialized).not.toContain('999.99');
  });

  it('writes the interface artifact to the expected bounded output path', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseMappingDir = makeTempDir();
    const warehouseDryRunDir = makeTempDir();
    const warehouseInterfaceDir = makeTempDir();
    const warehouseReadyArtifactPath = writeWarehouseReadyArtifact({
      dir: warehouseReadyDir,
    });
    const { warehouseMappingArtifactPath } = await writeWarehouseMappingArtifact({
      warehouseReadyArtifactPath,
      outputRoot: warehouseMappingDir,
    });
    const { warehouseDryRunArtifactPath } = await writeWarehouseDryRunArtifact({
      warehouseReadyArtifactPath,
      warehouseMappingArtifactPath,
      outputRoot: warehouseDryRunDir,
    });
    const warehouseDryRunArtifact =
      await readFirstSalesTrafficWarehouseAdapterDryRunArtifact({
        warehouseDryRunArtifactPath,
      });
    const interfaceArtifact = buildFirstSalesTrafficWarehouseAdapterInterface({
      warehouseDryRunArtifact,
      warehouseDryRunArtifactPath,
    });

    const warehouseInterfaceArtifactPath =
      await writeFirstSalesTrafficWarehouseAdapterInterface({
        interfaceArtifact,
        outputRoot: warehouseInterfaceDir,
      });

    expect(warehouseInterfaceArtifactPath).toBe(
      buildFirstSalesTrafficWarehouseAdapterInterfacePath({
        reportId: 'report-123',
        outputRoot: warehouseInterfaceDir,
      })
    );
    expect(fs.existsSync(warehouseInterfaceArtifactPath)).toBe(true);
  });

  it('raises a typed error for malformed dry-run input', async () => {
    const warehouseDryRunDir = makeTempDir();
    const warehouseDryRunArtifactPath = path.join(
      warehouseDryRunDir,
      'report-report-123.warehouse-dry-run.json'
    );
    fs.writeFileSync(
      warehouseDryRunArtifactPath,
      JSON.stringify(
        {
          warehouseAdapterDryRunVersion:
            'sp-api-first-report-warehouse-adapter-dry-run/v1',
          dryRunTarget: 'local_json_warehouse_adapter_dry_run',
          dryRunTargetDescription: 'bad',
          reportFamily: 'sales_and_traffic',
          reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
          reportId: 'report-123',
          lineage: {
            warehouseReadyArtifactPath: '/tmp/a.json',
            warehouseReadyContractVersion: 'sp-api-first-report-warehouse-ready/v1',
            warehouseMappingArtifactPath: '/tmp/b.json',
            warehouseAdapterMappingVersion:
              'sp-api-first-report-warehouse-adapter-mapping/v1',
            canonicalIngestArtifactPath: '/tmp/c.json',
            canonicalIngestVersion: 'sp-api-first-report-canonical-ingest/v1',
            stagingArtifactPath: '/tmp/d.json',
            stagingVersion: 'sp-api-first-report-local-stage/v1',
            handoffArtifactPath: '/tmp/e.json',
            handoffSchemaVersion: 'sp-api-first-report-handoff/v1',
            parsedArtifactPath: '/tmp/f.json',
            rawArtifactPath: '/tmp/g.json',
          },
          sections: [
            {
              sectionName: 'salesAndTrafficByDate',
              headerCount: 1,
              rowCount: 2,
              targetTableName: 'spapi_sales_and_traffic_by_date_report_rows',
            },
          ],
          totalRowCount: 1,
          dryRunPayload: {
            mode: 'dry_run',
            writesAttempted: false,
            writesAttemptedCount: 0,
            targetOperations: [
              {
                sectionName: 'salesAndTrafficByDate',
                targetTableName: 'spapi_sales_and_traffic_by_date_report_rows',
                sourceBatchPath: 'warehouseReadyPayload.recordBatches[0].rows',
                plannedOperation:
                  'prepare_local_dry_run_warehouse_adapter_batch',
                operationStatus: 'dry_run_only',
                keyColumns: ['report_id'],
                mappedColumnCount: 1,
                sourceRowCount: 1,
                writesAttempted: false,
                writesAttemptedCount: 0,
                writesSkippedReason: 'skip',
                dryRunPreview: {
                  sampleWarehouseRecordIds: ['report-123:salesAndTrafficByDate:0'],
                  sampleCanonicalRecordIds: ['report-123:salesAndTrafficByDate:0'],
                },
              },
            ],
          },
        },
        null,
        2
      ),
      'utf8'
    );

    await expect(
      readFirstSalesTrafficWarehouseAdapterDryRunArtifact({
        warehouseDryRunArtifactPath,
      })
    ).rejects.toMatchObject({
      name: 'FirstReportWarehouseInterfaceError',
      code: 'invalid_content',
    });
  });
});
