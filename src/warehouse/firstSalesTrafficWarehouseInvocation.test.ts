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
  buildFirstSalesTrafficWarehouseAdapterNoop,
  readFirstSalesTrafficWarehouseAdapterInterfaceArtifact,
  writeFirstSalesTrafficWarehouseAdapterNoop,
} from './firstSalesTrafficWarehouseNoop';
import {
  FIRST_REPORT_WAREHOUSE_ADAPTER_INVOCATION_VERSION,
  buildFirstSalesTrafficWarehouseAdapterInvocation,
  buildFirstSalesTrafficWarehouseAdapterInvocationPath,
  readFirstSalesTrafficWarehouseAdapterNoopArtifact,
  resolveFirstSalesTrafficWarehouseNoopArtifactPath,
  runFirstSalesTrafficWarehouseAdapterInvocation,
  validateFirstSalesTrafficWarehouseAdapterInvocation,
  writeFirstSalesTrafficWarehouseAdapterInvocation,
} from './firstSalesTrafficWarehouseInvocation';

const tempDirs: string[] = [];

const makeTempDir = () => {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'spapi-warehouse-invocation-test-')
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

const writeWarehouseNoopArtifact = async (args: {
  warehouseInterfaceArtifactPath: string;
  outputRoot: string;
}) => {
  const interfaceArtifact =
    await readFirstSalesTrafficWarehouseAdapterInterfaceArtifact({
      warehouseInterfaceArtifactPath: args.warehouseInterfaceArtifactPath,
    });
  const noopArtifact = buildFirstSalesTrafficWarehouseAdapterNoop({
    interfaceArtifact,
    warehouseInterfaceArtifactPath: args.warehouseInterfaceArtifactPath,
  });

  const warehouseNoopArtifactPath = await writeFirstSalesTrafficWarehouseAdapterNoop({
    noopArtifact,
    outputRoot: args.outputRoot,
  });

  return { warehouseNoopArtifactPath };
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('first Sales and Traffic warehouse adapter invocation boundary', () => {
  it('resolves the deterministic warehouse no-op artifact path from report id', async () => {
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
    const { warehouseNoopArtifactPath } = await writeWarehouseNoopArtifact({
      warehouseInterfaceArtifactPath,
      outputRoot: warehouseNoopDir,
    });

    await expect(
      resolveFirstSalesTrafficWarehouseNoopArtifactPath({
        reportId: 'report-123',
        warehouseNoopOutputRoot: warehouseNoopDir,
      })
    ).resolves.toEqual({
      reportId: 'report-123',
      warehouseNoopArtifactPath,
    });
  });

  it('builds the invocation artifact with deterministic target invocations and lineage', async () => {
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
    const { warehouseNoopArtifactPath } = await writeWarehouseNoopArtifact({
      warehouseInterfaceArtifactPath,
      outputRoot: warehouseNoopDir,
    });
    const noopArtifact = await readFirstSalesTrafficWarehouseAdapterNoopArtifact({
      warehouseNoopArtifactPath,
    });

    const invocationArtifact = buildFirstSalesTrafficWarehouseAdapterInvocation({
      noopArtifact,
      warehouseNoopArtifactPath,
    });

    expect(invocationArtifact).toMatchObject({
      warehouseAdapterInvocationVersion:
        FIRST_REPORT_WAREHOUSE_ADAPTER_INVOCATION_VERSION,
      reportFamily: 'sales_and_traffic',
      reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
      reportId: 'report-123',
      lineage: {
        warehouseNoopArtifactPath,
        warehouseAdapterNoopVersion: 'sp-api-first-report-warehouse-adapter-noop/v1',
        warehouseInterfaceArtifactPath,
        warehouseAdapterInterfaceVersion:
          'sp-api-first-report-warehouse-adapter-interface/v1',
      },
      sections: [
        {
          sectionName: 'salesAndTrafficByDate',
          rowCount: 1,
          targetTableName: 'spapi_sales_and_traffic_by_date_report_rows',
        },
        {
          sectionName: 'salesAndTrafficByAsin',
          rowCount: 1,
          targetTableName: 'spapi_sales_and_traffic_by_asin_report_rows',
        },
      ],
      totalRowCount: 2,
      invocationPayload: {
        mode: 'invocation_boundary_only',
        writesAttempted: false,
        transportCalled: false,
      },
    });
    expect(invocationArtifact.invocationPayload.targetInvocations).toHaveLength(2);
    expect(invocationArtifact.invocationPayload.targetInvocations[0]).toMatchObject({
      sectionName: 'salesAndTrafficByDate',
      targetTableName: 'spapi_sales_and_traffic_by_date_report_rows',
      operationName:
        'execute_spapi_sales_and_traffic_by_date_report_rows_warehouse_adapter_write',
      mappedColumnCount: 8,
      invocationState: {
        mode: 'invocation_boundary_only',
        writesAttempted: false,
        transportCalled: false,
        executionAllowed: false,
        invocationResult: 'blocked_no_write',
        blockReason: 'no_real_write_allowed',
      },
    });
  });

  it('validates required top-level fields and invocation flags', async () => {
    const invocationArtifact = buildFirstSalesTrafficWarehouseAdapterInvocation({
      noopArtifact: {
        warehouseAdapterNoopVersion: 'sp-api-first-report-warehouse-adapter-noop/v1',
        reportId: 'report-123',
        reportFamily: 'sales_and_traffic',
        reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
        lineage: {
          warehouseInterfaceArtifactPath: '/tmp/interface.json',
          warehouseAdapterInterfaceVersion:
            'sp-api-first-report-warehouse-adapter-interface/v1',
          warehouseDryRunArtifactPath: '/tmp/dry-run.json',
          warehouseAdapterDryRunVersion:
            'sp-api-first-report-warehouse-adapter-dry-run/v1',
          warehouseMappingArtifactPath: '/tmp/mapping.json',
          warehouseAdapterMappingVersion:
            'sp-api-first-report-warehouse-adapter-mapping/v1',
          warehouseReadyArtifactPath: '/tmp/warehouse-ready.json',
          warehouseReadyContractVersion: 'sp-api-first-report-warehouse-ready/v1',
          canonicalIngestArtifactPath: '/tmp/canonical.json',
          canonicalIngestVersion: 'sp-api-first-report-canonical-ingest/v1',
          stagingArtifactPath: '/tmp/staging.json',
          stagingVersion: 'sp-api-first-report-local-stage/v1',
          handoffArtifactPath: '/tmp/handoff.json',
          handoffSchemaVersion: 'sp-api-first-report-handoff/v1',
          parsedArtifactPath: '/tmp/parsed.json',
          rawArtifactPath: '/tmp/raw.gz',
        },
        sections: [
          {
            sectionName: 'salesAndTrafficByDate',
            headerCount: 2,
            rowCount: 1,
            targetTableName: 'spapi_sales_and_traffic_by_date_report_rows',
          },
        ],
        totalRowCount: 1,
        noopPayload: {
          mode: 'noop',
          writesAttempted: false,
          realTransportPresent: false,
          targetHandlers: [
            {
              sectionName: 'salesAndTrafficByDate',
              targetTableName: 'spapi_sales_and_traffic_by_date_report_rows',
              operationName:
                'execute_spapi_sales_and_traffic_by_date_report_rows_warehouse_adapter_write',
              keyColumns: ['report_id'],
              mappedColumnCount: 1,
              requestStub: {
                acceptedArtifactType: 'warehouse_adapter_interface_artifact',
                acceptedArtifactVersion:
                  'sp-api-first-report-warehouse-adapter-interface/v1',
                requiredFields: ['reportId'],
                acceptedMode: 'interface_only',
                acceptedOperationName:
                  'execute_spapi_sales_and_traffic_by_date_report_rows_warehouse_adapter_write',
              },
              responseStub: {
                resultType: 'warehouse_adapter_noop_result',
                status: 'skipped_noop',
                requiredFields: ['status'],
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
            },
          ],
        },
      },
      warehouseNoopArtifactPath: '/tmp/report-report-123.warehouse-noop.json',
    });

    expect(() =>
      validateFirstSalesTrafficWarehouseAdapterInvocation({
        invocationArtifact: {
          ...invocationArtifact,
          invocationPayload: {
            ...invocationArtifact.invocationPayload,
            targetInvocations: invocationArtifact.invocationPayload.targetInvocations.map(
              (targetInvocation) => ({
                ...targetInvocation,
                invocationState: {
                  ...targetInvocation.invocationState,
                  transportCalled: true as never,
                },
              })
            ),
          },
        },
      })
    ).toThrow(/blocked no-write invocation flags/);
  });

  it('summarizes safely without exposing request or response payload contents', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseMappingDir = makeTempDir();
    const warehouseDryRunDir = makeTempDir();
    const warehouseInterfaceDir = makeTempDir();
    const warehouseNoopDir = makeTempDir();
    const warehouseInvocationDir = makeTempDir();
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
    const { warehouseNoopArtifactPath } = await writeWarehouseNoopArtifact({
      warehouseInterfaceArtifactPath,
      outputRoot: warehouseNoopDir,
    });

    const summary = await runFirstSalesTrafficWarehouseAdapterInvocation({
      warehouseNoopArtifactPath,
      warehouseInvocationOutputRoot: warehouseInvocationDir,
    });

    expect(summary).toMatchObject({
      endpoint: 'runFirstSalesTrafficWarehouseAdapterInvocation',
      reportId: 'report-123',
      warehouseNoopArtifactPath,
      warehouseAdapterInvocationVersion:
        FIRST_REPORT_WAREHOUSE_ADAPTER_INVOCATION_VERSION,
      sectionCount: 2,
      totalRowCount: 2,
    });
    expect(summary.operationNames).toEqual([
      'execute_spapi_sales_and_traffic_by_date_report_rows_warehouse_adapter_write',
      'execute_spapi_sales_and_traffic_by_asin_report_rows_warehouse_adapter_write',
    ]);
    expect(JSON.stringify(summary)).not.toContain('B0SENSITIVE');
    expect(JSON.stringify(summary)).not.toContain('acceptedArtifactVersion');
  });

  it('writes the invocation artifact to the deterministic bounded output path', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseMappingDir = makeTempDir();
    const warehouseDryRunDir = makeTempDir();
    const warehouseInterfaceDir = makeTempDir();
    const warehouseNoopDir = makeTempDir();
    const warehouseInvocationDir = makeTempDir();
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
    const { warehouseNoopArtifactPath } = await writeWarehouseNoopArtifact({
      warehouseInterfaceArtifactPath,
      outputRoot: warehouseNoopDir,
    });
    const noopArtifact = await readFirstSalesTrafficWarehouseAdapterNoopArtifact({
      warehouseNoopArtifactPath,
    });
    const invocationArtifact = buildFirstSalesTrafficWarehouseAdapterInvocation({
      noopArtifact,
      warehouseNoopArtifactPath,
    });

    const warehouseInvocationArtifactPath =
      await writeFirstSalesTrafficWarehouseAdapterInvocation({
        invocationArtifact,
        outputRoot: warehouseInvocationDir,
      });

    expect(warehouseInvocationArtifactPath).toBe(
      buildFirstSalesTrafficWarehouseAdapterInvocationPath({
        reportId: 'report-123',
        outputRoot: warehouseInvocationDir,
      })
    );
    expect(fs.existsSync(warehouseInvocationArtifactPath)).toBe(true);
  });

  it('raises typed errors for malformed or mismatched inputs', async () => {
    const warehouseNoopDir = makeTempDir();
    const malformedArtifactPath = path.join(
      warehouseNoopDir,
      'report-report-123.warehouse-noop.json'
    );
    fs.writeFileSync(
      malformedArtifactPath,
      JSON.stringify({ reportId: 'report-123' }, null, 2),
      'utf8'
    );

    await expect(
      readFirstSalesTrafficWarehouseAdapterNoopArtifact({
        warehouseNoopArtifactPath: malformedArtifactPath,
      })
    ).rejects.toMatchObject({
      name: 'FirstReportWarehouseInvocationError',
      code: 'invalid_content',
    });

    await expect(
      resolveFirstSalesTrafficWarehouseNoopArtifactPath({
        reportId: 'report-other',
        warehouseNoopArtifactPath: malformedArtifactPath,
      })
    ).rejects.toMatchObject({
      name: 'FirstReportWarehouseInvocationError',
      code: 'invalid_input',
    });
  });
});
