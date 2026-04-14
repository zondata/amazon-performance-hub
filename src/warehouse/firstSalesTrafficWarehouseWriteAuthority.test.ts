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
  buildFirstSalesTrafficWarehouseAdapterInvocation,
  readFirstSalesTrafficWarehouseAdapterNoopArtifact,
  writeFirstSalesTrafficWarehouseAdapterInvocation,
} from './firstSalesTrafficWarehouseInvocation';
import {
  buildFirstSalesTrafficWarehouseAdapterResultContract,
  readFirstSalesTrafficWarehouseAdapterInvocationArtifact,
  writeFirstSalesTrafficWarehouseAdapterResultContract,
} from './firstSalesTrafficWarehouseResultContract';
import {
  FIRST_REPORT_WAREHOUSE_WRITE_AUTHORITY_VERSION,
  buildFirstSalesTrafficWarehouseWriteAuthority,
  buildFirstSalesTrafficWarehouseWriteAuthorityPath,
  readFirstSalesTrafficWarehouseAdapterResultContractArtifact,
  resolveFirstSalesTrafficWarehouseResultContractArtifactPath,
  runFirstSalesTrafficWarehouseWriteAuthorityGate,
  validateFirstSalesTrafficWarehouseWriteAuthority,
  writeFirstSalesTrafficWarehouseWriteAuthority,
} from './firstSalesTrafficWarehouseWriteAuthority';

const tempDirs: string[] = [];

const makeTempDir = () => {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'spapi-warehouse-write-authority-test-')
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

const writeWarehouseInvocationArtifact = async (args: {
  warehouseNoopArtifactPath: string;
  outputRoot: string;
}) => {
  const noopArtifact = await readFirstSalesTrafficWarehouseAdapterNoopArtifact({
    warehouseNoopArtifactPath: args.warehouseNoopArtifactPath,
  });
  const invocationArtifact = buildFirstSalesTrafficWarehouseAdapterInvocation({
    noopArtifact,
    warehouseNoopArtifactPath: args.warehouseNoopArtifactPath,
  });
  const warehouseInvocationArtifactPath =
    await writeFirstSalesTrafficWarehouseAdapterInvocation({
      invocationArtifact,
      outputRoot: args.outputRoot,
    });
  return { warehouseInvocationArtifactPath };
};

const writeWarehouseResultContractArtifact = async (args: {
  warehouseInvocationArtifactPath: string;
  outputRoot: string;
}) => {
  const invocationArtifact =
    await readFirstSalesTrafficWarehouseAdapterInvocationArtifact({
      warehouseInvocationArtifactPath: args.warehouseInvocationArtifactPath,
    });
  const resultContractArtifact =
    buildFirstSalesTrafficWarehouseAdapterResultContract({
      invocationArtifact,
      warehouseInvocationArtifactPath: args.warehouseInvocationArtifactPath,
    });
  const warehouseResultContractArtifactPath =
    await writeFirstSalesTrafficWarehouseAdapterResultContract({
      resultContractArtifact,
      outputRoot: args.outputRoot,
    });
  return { warehouseResultContractArtifactPath };
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('first Sales and Traffic warehouse write-authority gate boundary', () => {
  it('resolves the deterministic warehouse result-contract artifact path from report id', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseMappingDir = makeTempDir();
    const warehouseDryRunDir = makeTempDir();
    const warehouseInterfaceDir = makeTempDir();
    const warehouseNoopDir = makeTempDir();
    const warehouseInvocationDir = makeTempDir();
    const warehouseResultContractDir = makeTempDir();
    const warehouseReadyArtifactPath = writeWarehouseReadyArtifact({ dir: warehouseReadyDir });
    const { warehouseMappingArtifactPath } = await writeWarehouseMappingArtifact({
      warehouseReadyArtifactPath,
      outputRoot: warehouseMappingDir,
    });
    const { warehouseDryRunArtifactPath } = await writeWarehouseDryRunArtifact({
      warehouseReadyArtifactPath,
      warehouseMappingArtifactPath,
      outputRoot: warehouseDryRunDir,
    });
    const { warehouseInterfaceArtifactPath } = await writeWarehouseInterfaceArtifact({
      warehouseDryRunArtifactPath,
      outputRoot: warehouseInterfaceDir,
    });
    const { warehouseNoopArtifactPath } = await writeWarehouseNoopArtifact({
      warehouseInterfaceArtifactPath,
      outputRoot: warehouseNoopDir,
    });
    const { warehouseInvocationArtifactPath } = await writeWarehouseInvocationArtifact({
      warehouseNoopArtifactPath,
      outputRoot: warehouseInvocationDir,
    });
    const { warehouseResultContractArtifactPath } =
      await writeWarehouseResultContractArtifact({
        warehouseInvocationArtifactPath,
        outputRoot: warehouseResultContractDir,
      });

    await expect(
      resolveFirstSalesTrafficWarehouseResultContractArtifactPath({
        reportId: 'report-123',
        warehouseResultContractOutputRoot: warehouseResultContractDir,
      })
    ).resolves.toEqual({
      reportId: 'report-123',
      warehouseResultContractArtifactPath,
    });
  });

  it('builds the write-authority artifact with deterministic gate decisions and lineage', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseMappingDir = makeTempDir();
    const warehouseDryRunDir = makeTempDir();
    const warehouseInterfaceDir = makeTempDir();
    const warehouseNoopDir = makeTempDir();
    const warehouseInvocationDir = makeTempDir();
    const warehouseResultContractDir = makeTempDir();
    const warehouseReadyArtifactPath = writeWarehouseReadyArtifact({ dir: warehouseReadyDir });
    const { warehouseMappingArtifactPath } = await writeWarehouseMappingArtifact({
      warehouseReadyArtifactPath,
      outputRoot: warehouseMappingDir,
    });
    const { warehouseDryRunArtifactPath } = await writeWarehouseDryRunArtifact({
      warehouseReadyArtifactPath,
      warehouseMappingArtifactPath,
      outputRoot: warehouseDryRunDir,
    });
    const { warehouseInterfaceArtifactPath } = await writeWarehouseInterfaceArtifact({
      warehouseDryRunArtifactPath,
      outputRoot: warehouseInterfaceDir,
    });
    const { warehouseNoopArtifactPath } = await writeWarehouseNoopArtifact({
      warehouseInterfaceArtifactPath,
      outputRoot: warehouseNoopDir,
    });
    const { warehouseInvocationArtifactPath } = await writeWarehouseInvocationArtifact({
      warehouseNoopArtifactPath,
      outputRoot: warehouseInvocationDir,
    });
    const { warehouseResultContractArtifactPath } =
      await writeWarehouseResultContractArtifact({
        warehouseInvocationArtifactPath,
        outputRoot: warehouseResultContractDir,
      });
    const resultContractArtifact =
      await readFirstSalesTrafficWarehouseAdapterResultContractArtifact({
        warehouseResultContractArtifactPath,
      });

    const writeAuthorityArtifact = buildFirstSalesTrafficWarehouseWriteAuthority({
      resultContractArtifact,
      warehouseResultContractArtifactPath,
    });

    expect(writeAuthorityArtifact).toMatchObject({
      warehouseWriteAuthorityVersion: FIRST_REPORT_WAREHOUSE_WRITE_AUTHORITY_VERSION,
      reportFamily: 'sales_and_traffic',
      reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
      reportId: 'report-123',
      lineage: {
        warehouseResultContractArtifactPath,
        warehouseAdapterResultContractVersion:
          'sp-api-first-report-warehouse-adapter-result-contract/v1',
      },
      totalRowCount: 2,
      writeAuthorityPayload: {
        mode: 'write_authority_gate_only',
        writesAttempted: false,
        transportCalled: false,
      },
    });
    expect(writeAuthorityArtifact.writeAuthorityPayload.targetGateDecisions).toHaveLength(2);
    expect(
      writeAuthorityArtifact.writeAuthorityPayload.targetGateDecisions[0]
    ).toMatchObject({
      sectionName: 'salesAndTrafficByDate',
      targetTableName: 'spapi_sales_and_traffic_by_date_report_rows',
      operationName:
        'execute_spapi_sales_and_traffic_by_date_report_rows_warehouse_adapter_write',
      mappedColumnCount: 8,
      decision: 'denied',
      decisionReason: 'no_real_write_allowed',
      gateState: {
        mode: 'write_authority_gate_only',
        writesAttempted: false,
        transportCalled: false,
        executionAllowed: false,
        writeAuthorityDecision: 'denied',
        decisionReason: 'no_real_write_allowed',
        authoritySource: 'local_gate_only',
      },
    });
  });

  it('validates required top-level fields and denied gate flags', async () => {
    const writeAuthorityArtifact = buildFirstSalesTrafficWarehouseWriteAuthority({
      resultContractArtifact: {
        warehouseAdapterResultContractVersion:
          'sp-api-first-report-warehouse-adapter-result-contract/v1',
        reportId: 'report-123',
        reportFamily: 'sales_and_traffic',
        reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
        lineage: {
          warehouseInvocationArtifactPath: '/tmp/invocation.json',
          warehouseAdapterInvocationVersion:
            'sp-api-first-report-warehouse-adapter-invocation/v1',
          warehouseNoopArtifactPath: '/tmp/noop.json',
          warehouseAdapterNoopVersion: 'sp-api-first-report-warehouse-adapter-noop/v1',
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
        resultContractPayload: {
          mode: 'result_contract_only',
          writesAttempted: false,
          transportCalled: false,
          targetResults: [
            {
              sectionName: 'salesAndTrafficByDate',
              targetTableName: 'spapi_sales_and_traffic_by_date_report_rows',
              operationName:
                'execute_spapi_sales_and_traffic_by_date_report_rows_warehouse_adapter_write',
              keyColumns: ['report_id'],
              mappedColumnCount: 1,
              expectedSuccessResult: {
                resultType: 'warehouse_adapter_result_contract_success',
                requiredFields: ['status'],
                writesAttempted: false,
                transportCalled: false,
                executionAllowed: false,
              },
              expectedBlockedResult: {
                resultType: 'warehouse_adapter_result_contract_blocked',
                requiredFields: ['status'],
                resultStatus: 'blocked_no_write',
                statusReason: 'no_real_write_allowed',
                writesAttempted: false,
                transportCalled: false,
                executionAllowed: false,
              },
              resultState: {
                mode: 'result_contract_only',
                writesAttempted: false,
                transportCalled: false,
                executionAllowed: false,
                resultStatus: 'blocked_no_write',
                statusReason: 'no_real_write_allowed',
              },
            },
          ],
        },
      },
      warehouseResultContractArtifactPath:
        '/tmp/report-report-123.warehouse-result-contract.json',
    });

    expect(() =>
      validateFirstSalesTrafficWarehouseWriteAuthority({
        writeAuthorityArtifact: {
          ...writeAuthorityArtifact,
          writeAuthorityPayload: {
            ...writeAuthorityArtifact.writeAuthorityPayload,
            targetGateDecisions:
              writeAuthorityArtifact.writeAuthorityPayload.targetGateDecisions.map(
                (targetGateDecision) => ({
                  ...targetGateDecision,
                  gateState: {
                    ...targetGateDecision.gateState,
                    transportCalled: true as never,
                  },
                })
              ),
          },
        },
      })
    ).toThrow(/denied no-write gate flags/);
  });

  it('summarizes safely without exposing contract payload contents', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseMappingDir = makeTempDir();
    const warehouseDryRunDir = makeTempDir();
    const warehouseInterfaceDir = makeTempDir();
    const warehouseNoopDir = makeTempDir();
    const warehouseInvocationDir = makeTempDir();
    const warehouseResultContractDir = makeTempDir();
    const warehouseWriteAuthorityDir = makeTempDir();
    const warehouseReadyArtifactPath = writeWarehouseReadyArtifact({ dir: warehouseReadyDir });
    const { warehouseMappingArtifactPath } = await writeWarehouseMappingArtifact({
      warehouseReadyArtifactPath,
      outputRoot: warehouseMappingDir,
    });
    const { warehouseDryRunArtifactPath } = await writeWarehouseDryRunArtifact({
      warehouseReadyArtifactPath,
      warehouseMappingArtifactPath,
      outputRoot: warehouseDryRunDir,
    });
    const { warehouseInterfaceArtifactPath } = await writeWarehouseInterfaceArtifact({
      warehouseDryRunArtifactPath,
      outputRoot: warehouseInterfaceDir,
    });
    const { warehouseNoopArtifactPath } = await writeWarehouseNoopArtifact({
      warehouseInterfaceArtifactPath,
      outputRoot: warehouseNoopDir,
    });
    const { warehouseInvocationArtifactPath } = await writeWarehouseInvocationArtifact({
      warehouseNoopArtifactPath,
      outputRoot: warehouseInvocationDir,
    });
    const { warehouseResultContractArtifactPath } =
      await writeWarehouseResultContractArtifact({
        warehouseInvocationArtifactPath,
        outputRoot: warehouseResultContractDir,
      });

    const summary = await runFirstSalesTrafficWarehouseWriteAuthorityGate({
      warehouseResultContractArtifactPath,
      warehouseWriteAuthorityOutputRoot: warehouseWriteAuthorityDir,
    });

    expect(summary).toMatchObject({
      endpoint: 'runFirstSalesTrafficWarehouseWriteAuthorityGate',
      reportId: 'report-123',
      warehouseResultContractArtifactPath,
      warehouseWriteAuthorityVersion: FIRST_REPORT_WAREHOUSE_WRITE_AUTHORITY_VERSION,
      sectionCount: 2,
      totalRowCount: 2,
      decisions: ['denied', 'denied'],
    });
    expect(summary.operationNames).toEqual([
      'execute_spapi_sales_and_traffic_by_date_report_rows_warehouse_adapter_write',
      'execute_spapi_sales_and_traffic_by_asin_report_rows_warehouse_adapter_write',
    ]);
    expect(JSON.stringify(summary)).not.toContain('B0SENSITIVE');
    expect(JSON.stringify(summary)).not.toContain('expectedSuccessResult');
  });

  it('writes the write-authority artifact to the deterministic bounded output path', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseMappingDir = makeTempDir();
    const warehouseDryRunDir = makeTempDir();
    const warehouseInterfaceDir = makeTempDir();
    const warehouseNoopDir = makeTempDir();
    const warehouseInvocationDir = makeTempDir();
    const warehouseResultContractDir = makeTempDir();
    const warehouseWriteAuthorityDir = makeTempDir();
    const warehouseReadyArtifactPath = writeWarehouseReadyArtifact({ dir: warehouseReadyDir });
    const { warehouseMappingArtifactPath } = await writeWarehouseMappingArtifact({
      warehouseReadyArtifactPath,
      outputRoot: warehouseMappingDir,
    });
    const { warehouseDryRunArtifactPath } = await writeWarehouseDryRunArtifact({
      warehouseReadyArtifactPath,
      warehouseMappingArtifactPath,
      outputRoot: warehouseDryRunDir,
    });
    const { warehouseInterfaceArtifactPath } = await writeWarehouseInterfaceArtifact({
      warehouseDryRunArtifactPath,
      outputRoot: warehouseInterfaceDir,
    });
    const { warehouseNoopArtifactPath } = await writeWarehouseNoopArtifact({
      warehouseInterfaceArtifactPath,
      outputRoot: warehouseNoopDir,
    });
    const { warehouseInvocationArtifactPath } = await writeWarehouseInvocationArtifact({
      warehouseNoopArtifactPath,
      outputRoot: warehouseInvocationDir,
    });
    const { warehouseResultContractArtifactPath } =
      await writeWarehouseResultContractArtifact({
        warehouseInvocationArtifactPath,
        outputRoot: warehouseResultContractDir,
      });
    const resultContractArtifact =
      await readFirstSalesTrafficWarehouseAdapterResultContractArtifact({
        warehouseResultContractArtifactPath,
      });
    const writeAuthorityArtifact = buildFirstSalesTrafficWarehouseWriteAuthority({
      resultContractArtifact,
      warehouseResultContractArtifactPath,
    });

    const warehouseWriteAuthorityArtifactPath =
      await writeFirstSalesTrafficWarehouseWriteAuthority({
        writeAuthorityArtifact,
        outputRoot: warehouseWriteAuthorityDir,
      });

    expect(warehouseWriteAuthorityArtifactPath).toBe(
      buildFirstSalesTrafficWarehouseWriteAuthorityPath({
        reportId: 'report-123',
        outputRoot: warehouseWriteAuthorityDir,
      })
    );
    expect(fs.existsSync(warehouseWriteAuthorityArtifactPath)).toBe(true);
  });

  it('raises typed errors for malformed or mismatched inputs', async () => {
    const warehouseResultContractDir = makeTempDir();
    const malformedArtifactPath = path.join(
      warehouseResultContractDir,
      'report-report-123.warehouse-result-contract.json'
    );
    fs.writeFileSync(
      malformedArtifactPath,
      JSON.stringify({ reportId: 'report-123' }, null, 2),
      'utf8'
    );

    await expect(
      readFirstSalesTrafficWarehouseAdapterResultContractArtifact({
        warehouseResultContractArtifactPath: malformedArtifactPath,
      })
    ).rejects.toMatchObject({
      name: 'FirstReportWarehouseWriteAuthorityError',
      code: 'invalid_content',
    });

    await expect(
      resolveFirstSalesTrafficWarehouseResultContractArtifactPath({
        reportId: 'report-other',
        warehouseResultContractArtifactPath: malformedArtifactPath,
      })
    ).rejects.toMatchObject({
      name: 'FirstReportWarehouseWriteAuthorityError',
      code: 'invalid_input',
    });
  });
});
