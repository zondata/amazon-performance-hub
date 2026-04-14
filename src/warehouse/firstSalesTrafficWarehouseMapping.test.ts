import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  FIRST_REPORT_WAREHOUSE_ADAPTER_MAPPING_VERSION,
  buildFirstSalesTrafficWarehouseAdapterMapping,
  buildFirstSalesTrafficWarehouseAdapterMappingPath,
  readFirstSalesTrafficWarehouseReadyArtifact,
  resolveFirstSalesTrafficWarehouseReadyArtifactPath,
  runFirstSalesTrafficWarehouseAdapterPreparation,
  validateFirstSalesTrafficWarehouseAdapterMapping,
  writeFirstSalesTrafficWarehouseAdapterMapping,
} from './firstSalesTrafficWarehouseMapping';

const tempDirs: string[] = [];

const makeTempDir = () => {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'spapi-warehouse-mapping-test-')
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

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('first Sales and Traffic warehouse adapter preparation boundary', () => {
  it('resolves the deterministic warehouse-ready artifact path from report id', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseReadyArtifactPath = writeWarehouseReadyArtifact({
      dir: warehouseReadyDir,
    });

    await expect(
      resolveFirstSalesTrafficWarehouseReadyArtifactPath({
        reportId: 'report-123',
        warehouseReadyOutputRoot: warehouseReadyDir,
      })
    ).resolves.toEqual({
      reportId: 'report-123',
      warehouseReadyArtifactPath,
    });
  });

  it('builds the warehouse adapter mapping with lineage metadata and column mappings', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseReadyArtifactPath = writeWarehouseReadyArtifact({
      dir: warehouseReadyDir,
    });
    const warehouseReadyArtifact = await readFirstSalesTrafficWarehouseReadyArtifact({
      warehouseReadyArtifactPath,
    });

    const mappingArtifact = buildFirstSalesTrafficWarehouseAdapterMapping({
      warehouseReadyArtifact,
      warehouseReadyArtifactPath,
    });

    expect(mappingArtifact).toMatchObject({
      warehouseAdapterMappingVersion:
        FIRST_REPORT_WAREHOUSE_ADAPTER_MAPPING_VERSION,
      mappingTarget: 'local_json_warehouse_adapter_mapping',
      reportFamily: 'sales_and_traffic',
      reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
      reportId: 'report-123',
      lineage: {
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
    expect(mappingArtifact.mappingPayload.targetMappings[0]).toMatchObject({
      sectionName: 'salesAndTrafficByDate',
      targetTableName: 'spapi_sales_and_traffic_by_date_report_rows',
      sourceBatchPath: 'warehouseReadyPayload.recordBatches[0].rows',
      keyColumns: [
        'report_id',
        'report_family',
        'report_type',
        'section_name',
        'canonical_record_id',
      ],
      sourceRowCount: 1,
    });
    expect(mappingArtifact.mappingPayload.targetMappings[0].columnMappings[0]).toEqual({
      sourceField: 'report_id',
      targetColumn: 'report_id',
      sourceValuePath: 'rowValues["report_id"]',
      observedValueType: 'string',
      nullable: false,
    });
  });

  it('enforces lineage metadata during warehouse adapter validation', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseReadyArtifactPath = writeWarehouseReadyArtifact({
      dir: warehouseReadyDir,
    });
    const warehouseReadyArtifact = await readFirstSalesTrafficWarehouseReadyArtifact({
      warehouseReadyArtifactPath,
    });
    const mappingArtifact = buildFirstSalesTrafficWarehouseAdapterMapping({
      warehouseReadyArtifact,
      warehouseReadyArtifactPath,
    });

    mappingArtifact.lineage.rawArtifactPath = '';

    try {
      validateFirstSalesTrafficWarehouseAdapterMapping({
        warehouseReadyArtifact,
        mappingArtifact,
      });
      throw new Error('expected warehouse adapter mapping validation to fail');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'FirstReportWarehouseMappingError',
        code: 'validation_failed',
      });
    }
  });

  it('enforces required top-level warehouse adapter mapping fields', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseReadyArtifactPath = writeWarehouseReadyArtifact({
      dir: warehouseReadyDir,
    });
    const warehouseReadyArtifact = await readFirstSalesTrafficWarehouseReadyArtifact({
      warehouseReadyArtifactPath,
    });
    const mappingArtifact = buildFirstSalesTrafficWarehouseAdapterMapping({
      warehouseReadyArtifact,
      warehouseReadyArtifactPath,
    });

    mappingArtifact.warehouseAdapterMappingVersion =
      '' as typeof FIRST_REPORT_WAREHOUSE_ADAPTER_MAPPING_VERSION;

    try {
      validateFirstSalesTrafficWarehouseAdapterMapping({
        warehouseReadyArtifact,
        mappingArtifact,
      });
      throw new Error('expected warehouse adapter mapping validation to fail');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'FirstReportWarehouseMappingError',
        code: 'validation_failed',
      });
    }
  });

  it('keeps section names and row counts consistent with the warehouse-ready artifact', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseReadyArtifactPath = writeWarehouseReadyArtifact({
      dir: warehouseReadyDir,
    });
    const warehouseReadyArtifact = await readFirstSalesTrafficWarehouseReadyArtifact({
      warehouseReadyArtifactPath,
    });
    const mappingArtifact = buildFirstSalesTrafficWarehouseAdapterMapping({
      warehouseReadyArtifact,
      warehouseReadyArtifactPath,
    });

    mappingArtifact.sections[1].rowCount = 99;

    try {
      validateFirstSalesTrafficWarehouseAdapterMapping({
        warehouseReadyArtifact,
        mappingArtifact,
      });
      throw new Error('expected warehouse adapter mapping validation to fail');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'FirstReportWarehouseMappingError',
        code: 'validation_failed',
      });
    }
  });

  it('validates target table names, key columns, and column mappings', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseReadyArtifactPath = writeWarehouseReadyArtifact({
      dir: warehouseReadyDir,
    });
    const warehouseReadyArtifact = await readFirstSalesTrafficWarehouseReadyArtifact({
      warehouseReadyArtifactPath,
    });
    const mappingArtifact = buildFirstSalesTrafficWarehouseAdapterMapping({
      warehouseReadyArtifact,
      warehouseReadyArtifactPath,
    });

    mappingArtifact.mappingPayload.targetMappings[0].keyColumns = ['missing_key'];

    try {
      validateFirstSalesTrafficWarehouseAdapterMapping({
        warehouseReadyArtifact,
        mappingArtifact,
      });
      throw new Error('expected warehouse adapter mapping validation to fail');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'FirstReportWarehouseMappingError',
        code: 'validation_failed',
      });
    }
  });

  it('returns a safe summary without exposing mapping payload rows', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseMappingDir = makeTempDir();
    writeWarehouseReadyArtifact({ dir: warehouseReadyDir });

    const summary = await runFirstSalesTrafficWarehouseAdapterPreparation({
      reportId: 'report-123',
      warehouseReadyOutputRoot: warehouseReadyDir,
      warehouseMappingOutputRoot: warehouseMappingDir,
    });
    const serialized = JSON.stringify(summary);

    expect(serialized).toContain(
      '"warehouseAdapterMappingVersion":"sp-api-first-report-warehouse-adapter-mapping/v1"'
    );
    expect(serialized).toContain('"reportId":"report-123"');
    expect(serialized).toContain('spapi_sales_and_traffic_by_date_report_rows');
    expect(serialized).not.toContain('B0SENSITIVE');
    expect(serialized).not.toContain('999.99');
  });

  it('writes the warehouse adapter mapping artifact to the expected bounded output path', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseMappingDir = makeTempDir();
    const warehouseReadyArtifactPath = writeWarehouseReadyArtifact({
      dir: warehouseReadyDir,
    });
    const warehouseReadyArtifact = await readFirstSalesTrafficWarehouseReadyArtifact({
      warehouseReadyArtifactPath,
    });
    const mappingArtifact = buildFirstSalesTrafficWarehouseAdapterMapping({
      warehouseReadyArtifact,
      warehouseReadyArtifactPath,
    });

    const warehouseMappingArtifactPath =
      await writeFirstSalesTrafficWarehouseAdapterMapping({
        mappingArtifact,
        outputRoot: warehouseMappingDir,
      });

    expect(warehouseMappingArtifactPath).toBe(
      buildFirstSalesTrafficWarehouseAdapterMappingPath({
        reportId: 'report-123',
        outputRoot: warehouseMappingDir,
      })
    );
    expect(fs.existsSync(warehouseMappingArtifactPath)).toBe(true);
  });

  it('raises a typed error for malformed warehouse-ready input', async () => {
    const warehouseReadyDir = makeTempDir();
    const warehouseReadyArtifactPath = writeWarehouseReadyArtifact({
      dir: warehouseReadyDir,
      artifact: {
        ...makeWarehouseReadyArtifact(),
        sections: [
          {
            sectionName: 'salesAndTrafficByDate',
            headerCount: 1,
            rowCount: 2,
            targetTableName: 'spapi_sales_and_traffic_by_date_report_rows',
          },
        ],
        totalRowCount: 1,
        warehouseReadyPayload: {
          recordBatches: [
            {
              sectionName: 'salesAndTrafficByDate',
              targetTableName: 'spapi_sales_and_traffic_by_date_report_rows',
              keyColumns: ['report_id'],
              columnNames: ['report_id'],
              rows: [
                {
                  warehouseRecordId: 'report-123:salesAndTrafficByDate:0',
                  canonicalRecordId: 'report-123:salesAndTrafficByDate:0',
                  rowValues: {
                    report_id: 'report-123',
                  },
                },
              ],
            },
          ],
        },
      },
    });

    await expect(
      readFirstSalesTrafficWarehouseReadyArtifact({
        warehouseReadyArtifactPath,
      })
    ).rejects.toMatchObject({
      name: 'FirstReportWarehouseMappingError',
      code: 'invalid_content',
    });
  });
});
