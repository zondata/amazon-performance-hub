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
  readFirstSalesTrafficWarehouseAdapterMappingArtifact,
  writeFirstSalesTrafficWarehouseAdapterDryRun,
} from './firstSalesTrafficWarehouseDryRun';
import {
  buildFirstSalesTrafficWarehouseAdapterInterface,
  readFirstSalesTrafficWarehouseAdapterDryRunArtifact,
  writeFirstSalesTrafficWarehouseAdapterInterface,
} from './firstSalesTrafficWarehouseInterface';
import {
  FIRST_REPORT_WAREHOUSE_ADAPTER_NOOP_VERSION,
  buildFirstSalesTrafficWarehouseAdapterNoop,
  buildFirstSalesTrafficWarehouseAdapterNoopPath,
  readFirstSalesTrafficWarehouseAdapterInterfaceArtifact,
  resolveFirstSalesTrafficWarehouseInterfaceArtifactPath,
  runFirstSalesTrafficWarehouseAdapterNoopImplementation,
  validateFirstSalesTrafficWarehouseAdapterNoop,
  writeFirstSalesTrafficWarehouseAdapterNoop,
} from './firstSalesTrafficWarehouseNoop';

const tempDirs: string[] = [];

const makeTempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spapi-warehouse-noop-test-'));
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

  return { warehouseMappingArtifactPath };
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

  return { warehouseDryRunArtifactPath };
};

const writeWarehouseInterfaceArtifact = async (args: {
  warehouseDryRunArtifactPath: string;
  outputRoot: string;
}) => {
  const warehouseDryRunArtifact =
    await readFirstSalesTrafficWarehouseAdapterDryRunArtifact({
      warehouseDryRunArtifactPath: args.warehouseDryRunArtifactPath,
    });
  const interfaceArtifact = buildFirstSalesTrafficWarehouseAdapterInterface({
    warehouseDryRunArtifact,
    warehouseDryRunArtifactPath: args.warehouseDryRunArtifactPath,
  });

  const warehouseInterfaceArtifactPath =
    await writeFirstSalesTrafficWarehouseAdapterInterface({
      interfaceArtifact,
      outputRoot: args.outputRoot,
    });

  return { warehouseInterfaceArtifactPath };
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('first Sales and Traffic warehouse adapter noop boundary', () => {
  it('resolves the deterministic warehouse interface artifact path from report id', async () => {
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
    const { warehouseInterfaceArtifactPath } =
      await writeWarehouseInterfaceArtifact({
        warehouseDryRunArtifactPath,
        outputRoot: warehouseInterfaceDir,
      });

    await expect(
      resolveFirstSalesTrafficWarehouseInterfaceArtifactPath({
        reportId: 'report-123',
        warehouseInterfaceOutputRoot: warehouseInterfaceDir,
      })
    ).resolves.toEqual({
      reportId: 'report-123',
      warehouseInterfaceArtifactPath,
    });
  });

  it('builds the noop artifact with deterministic target handlers and lineage', async () => {
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
    const { warehouseInterfaceArtifactPath } =
      await writeWarehouseInterfaceArtifact({
        warehouseDryRunArtifactPath,
        outputRoot: warehouseInterfaceDir,
      });
    const interfaceArtifact =
      await readFirstSalesTrafficWarehouseAdapterInterfaceArtifact({
        warehouseInterfaceArtifactPath,
      });

    const noopArtifact = buildFirstSalesTrafficWarehouseAdapterNoop({
      interfaceArtifact,
      warehouseInterfaceArtifactPath,
    });

    expect(noopArtifact).toMatchObject({
      warehouseAdapterNoopVersion: FIRST_REPORT_WAREHOUSE_ADAPTER_NOOP_VERSION,
      reportFamily: 'sales_and_traffic',
      reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
      reportId: 'report-123',
      lineage: {
        warehouseInterfaceArtifactPath,
        warehouseAdapterInterfaceVersion:
          'sp-api-first-report-warehouse-adapter-interface/v1',
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
      noopPayload: {
        mode: 'noop',
        writesAttempted: false,
        realTransportPresent: false,
      },
    });
    expect(noopArtifact.noopPayload.targetHandlers[0]).toMatchObject({
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
      requestStub: {
        acceptedArtifactType: 'warehouse_adapter_interface_artifact',
        acceptedArtifactVersion:
          'sp-api-first-report-warehouse-adapter-interface/v1',
        acceptedMode: 'interface_only',
      },
      responseStub: {
        resultType: 'warehouse_adapter_noop_result',
        status: 'skipped_noop',
        writesAttempted: false,
        executionAllowed: false,
      },
      executionState: {
        mode: 'noop',
        writesAttempted: false,
        implementationPresent: true,
        executionAllowed: false,
        executionResult: 'skipped_noop',
        skipReason: 'no_real_write_allowed',
      },
    });
  });

  it('validates lineage metadata and required top-level fields', async () => {
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
    const { warehouseInterfaceArtifactPath } =
      await writeWarehouseInterfaceArtifact({
        warehouseDryRunArtifactPath,
        outputRoot: warehouseInterfaceDir,
      });
    const interfaceArtifact =
      await readFirstSalesTrafficWarehouseAdapterInterfaceArtifact({
        warehouseInterfaceArtifactPath,
      });
    const noopArtifact = buildFirstSalesTrafficWarehouseAdapterNoop({
      interfaceArtifact,
      warehouseInterfaceArtifactPath,
    });

    noopArtifact.lineage.warehouseInterfaceArtifactPath = '';

    try {
      validateFirstSalesTrafficWarehouseAdapterNoop({
        interfaceArtifact,
        noopArtifact,
      });
      throw new Error('expected warehouse adapter noop validation to fail');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'FirstReportWarehouseNoopError',
        code: 'validation_failed',
      });
    }
  });

  it('requires noop payload flags to remain skipped and no-write', async () => {
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
    const { warehouseInterfaceArtifactPath } =
      await writeWarehouseInterfaceArtifact({
        warehouseDryRunArtifactPath,
        outputRoot: warehouseInterfaceDir,
      });
    const interfaceArtifact =
      await readFirstSalesTrafficWarehouseAdapterInterfaceArtifact({
        warehouseInterfaceArtifactPath,
      });
    const noopArtifact = buildFirstSalesTrafficWarehouseAdapterNoop({
      interfaceArtifact,
      warehouseInterfaceArtifactPath,
    });

    noopArtifact.noopPayload.targetHandlers[0].executionState.executionAllowed =
      true as false;

    try {
      validateFirstSalesTrafficWarehouseAdapterNoop({
        interfaceArtifact,
        noopArtifact,
      });
      throw new Error('expected warehouse adapter noop validation to fail');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'FirstReportWarehouseNoopError',
        code: 'validation_failed',
      });
    }
  });

  it('returns a safe summary without exposing interface payload contents', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseMappingDir = makeTempDir();
    const warehouseDryRunDir = makeTempDir();
    const warehouseInterfaceDir = makeTempDir();
    const warehouseNoopDir = makeTempDir();
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
    await writeWarehouseInterfaceArtifact({
      warehouseDryRunArtifactPath,
      outputRoot: warehouseInterfaceDir,
    });

    const summary = await runFirstSalesTrafficWarehouseAdapterNoopImplementation({
      reportId: 'report-123',
      warehouseInterfaceOutputRoot: warehouseInterfaceDir,
      warehouseNoopOutputRoot: warehouseNoopDir,
    });
    const serialized = JSON.stringify(summary);

    expect(serialized).toContain(
      '"warehouseAdapterNoopVersion":"sp-api-first-report-warehouse-adapter-noop/v1"'
    );
    expect(serialized).toContain('"reportId":"report-123"');
    expect(serialized).toContain('"executionResult":"skipped_noop"');
    expect(serialized).not.toContain('B0SENSITIVE');
    expect(serialized).not.toContain('999.99');
  });

  it('writes the noop artifact to the expected bounded output path', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseMappingDir = makeTempDir();
    const warehouseDryRunDir = makeTempDir();
    const warehouseInterfaceDir = makeTempDir();
    const warehouseNoopDir = makeTempDir();
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
    const { warehouseInterfaceArtifactPath } =
      await writeWarehouseInterfaceArtifact({
        warehouseDryRunArtifactPath,
        outputRoot: warehouseInterfaceDir,
      });
    const interfaceArtifact =
      await readFirstSalesTrafficWarehouseAdapterInterfaceArtifact({
        warehouseInterfaceArtifactPath,
      });
    const noopArtifact = buildFirstSalesTrafficWarehouseAdapterNoop({
      interfaceArtifact,
      warehouseInterfaceArtifactPath,
    });

    const warehouseNoopArtifactPath =
      await writeFirstSalesTrafficWarehouseAdapterNoop({
        noopArtifact,
        outputRoot: warehouseNoopDir,
      });

    expect(warehouseNoopArtifactPath).toBe(
      buildFirstSalesTrafficWarehouseAdapterNoopPath({
        reportId: 'report-123',
        outputRoot: warehouseNoopDir,
      })
    );
    expect(fs.existsSync(warehouseNoopArtifactPath)).toBe(true);
  });

  it('raises a typed error for malformed interface input', async () => {
    const warehouseInterfaceDir = makeTempDir();
    const warehouseInterfaceArtifactPath = path.join(
      warehouseInterfaceDir,
      'report-report-123.warehouse-interface.json'
    );
    fs.writeFileSync(
      warehouseInterfaceArtifactPath,
      JSON.stringify(
        {
          warehouseAdapterInterfaceVersion:
            'sp-api-first-report-warehouse-adapter-interface/v1',
          reportId: 'report-123',
          reportFamily: 'sales_and_traffic',
          reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
          lineage: {
            warehouseDryRunArtifactPath: '/tmp/a.json',
            warehouseAdapterDryRunVersion:
              'sp-api-first-report-warehouse-adapter-dry-run/v1',
            warehouseMappingArtifactPath: '/tmp/b.json',
            warehouseAdapterMappingVersion:
              'sp-api-first-report-warehouse-adapter-mapping/v1',
            warehouseReadyArtifactPath: '/tmp/c.json',
            warehouseReadyContractVersion: 'sp-api-first-report-warehouse-ready/v1',
            canonicalIngestArtifactPath: '/tmp/d.json',
            canonicalIngestVersion: 'sp-api-first-report-canonical-ingest/v1',
            stagingArtifactPath: '/tmp/e.json',
            stagingVersion: 'sp-api-first-report-local-stage/v1',
            handoffArtifactPath: '/tmp/f.json',
            handoffSchemaVersion: 'sp-api-first-report-handoff/v1',
            parsedArtifactPath: '/tmp/g.json',
            rawArtifactPath: '/tmp/h.json',
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
          interfacePayload: {
            mode: 'interface_only',
            writesAttempted: false,
            implementationPresent: false,
            executionAllowed: false,
            targetInterfaces: [
              {
                sectionName: 'salesAndTrafficByDate',
                targetTableName: 'spapi_sales_and_traffic_by_date_report_rows',
                operationName:
                  'execute_spapi_sales_and_traffic_by_date_report_rows_warehouse_adapter_write',
                keyColumns: ['report_id'],
                mappedColumnCount: 1,
                requestContract: {
                  artifactType: 'warehouse_adapter_dry_run_artifact',
                  artifactVersion:
                    'sp-api-first-report-warehouse-adapter-dry-run/v1',
                  requiredTopLevelFields: ['reportId'],
                  requiredTargetOperationFields: ['sectionName'],
                  acceptedMode: 'dry_run',
                  acceptedTargetTableName:
                    'spapi_sales_and_traffic_by_date_report_rows',
                  acceptedSectionName: 'salesAndTrafficByDate',
                  acceptedSourceBatchPath:
                    'warehouseReadyPayload.recordBatches[0].rows',
                },
                responseContract: {
                  resultType: 'warehouse_adapter_interface_result',
                  requiredFields: ['status'],
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
      readFirstSalesTrafficWarehouseAdapterInterfaceArtifact({
        warehouseInterfaceArtifactPath,
      })
    ).rejects.toMatchObject({
      name: 'FirstReportWarehouseNoopError',
      code: 'invalid_content',
    });
  });
});
