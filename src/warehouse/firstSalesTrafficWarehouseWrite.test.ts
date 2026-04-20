import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  SPAPI_SALES_TRAFFIC_BY_ASIN_TABLE,
  SPAPI_SALES_TRAFFIC_BY_DATE_TABLE,
  writeFirstSalesTrafficWarehouseRows,
  type FirstSalesTrafficByAsinWarehouseRow,
  type FirstSalesTrafficByDateWarehouseRow,
  type FirstSalesTrafficWarehouseSink,
} from './firstSalesTrafficWarehouseWrite';

const tempDirs: string[] = [];

const makeTempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ft01-warehouse-write-'));
  tempDirs.push(dir);
  return dir;
};

class CapturingSink implements FirstSalesTrafficWarehouseSink {
  account: { accountId: string; marketplace: string } | null = null;
  dateRows: FirstSalesTrafficByDateWarehouseRow[] = [];
  asinRows: FirstSalesTrafficByAsinWarehouseRow[] = [];
  schemaApplied = false;

  async applySchema(): Promise<void> {
    this.schemaApplied = true;
  }

  async upsertAccount(args: {
    accountId: string;
    marketplace: string;
  }): Promise<void> {
    this.account = args;
  }

  async upsertByDateRows(
    rows: FirstSalesTrafficByDateWarehouseRow[]
  ): Promise<number> {
    this.dateRows.push(...rows);
    return rows.length;
  }

  async upsertByAsinRows(
    rows: FirstSalesTrafficByAsinWarehouseRow[]
  ): Promise<number> {
    this.asinRows.push(...rows);
    return rows.length;
  }
}

const writeWarehouseReadyArtifact = (dir: string) => {
  const artifact = {
    warehouseReadyContractVersion: 'sp-api-first-report-warehouse-ready/v1',
    contractTarget: 'local_json_warehouse_ready_contract',
    contractTargetDescription:
      'Deterministic local warehouse-ready contract artifact for promotion proof only; not a warehouse write',
    reportFamily: 'sales_and_traffic',
    reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
    reportId: 'report-123',
    lineage: {
      canonicalIngestArtifactPath: '/tmp/report-123.canonical-ingest.json',
      canonicalIngestVersion: 'sp-api-first-report-canonical-ingest/v1',
      stagingArtifactPath: '/tmp/report-123.local-stage.json',
      stagingVersion: 'sp-api-first-report-local-stage/v1',
      handoffArtifactPath: '/tmp/report-123.handoff.json',
      handoffSchemaVersion: 'sp-api-first-report-handoff/v1',
      parsedArtifactPath: '/tmp/report-123.parsed.json',
      rawArtifactPath: '/tmp/report-123.document.raw.gz',
    },
    sections: [
      {
        sectionName: 'salesAndTrafficByDate',
        headerCount: 3,
        rowCount: 1,
        targetTableName: SPAPI_SALES_TRAFFIC_BY_DATE_TABLE,
      },
      {
        sectionName: 'salesAndTrafficByAsin',
        headerCount: 4,
        rowCount: 1,
        targetTableName: SPAPI_SALES_TRAFFIC_BY_ASIN_TABLE,
      },
    ],
    totalRowCount: 2,
    warehouseReadyPayload: {
      recordBatches: [
        {
          sectionName: 'salesAndTrafficByDate',
          targetTableName: SPAPI_SALES_TRAFFIC_BY_DATE_TABLE,
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
            'salesByDate.orderedProductSales.currencyCode',
            'salesByDate.unitsOrdered',
            'salesByDate.totalOrderItems',
            'trafficByDate.sessions',
            'trafficByDate.pageViews',
            'trafficByDate.buyBoxPercentage',
            'trafficByDate.unitSessionPercentage',
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
                'salesByDate.orderedProductSales.amount': 127.94,
                'salesByDate.orderedProductSales.currencyCode': 'USD',
                'salesByDate.unitsOrdered': 6,
                'salesByDate.totalOrderItems': 6,
                'trafficByDate.sessions': 10,
                'trafficByDate.pageViews': 20,
                'trafficByDate.buyBoxPercentage': 91.5,
                'trafficByDate.unitSessionPercentage': 60,
              },
            },
          ],
        },
        {
          sectionName: 'salesAndTrafficByAsin',
          targetTableName: SPAPI_SALES_TRAFFIC_BY_ASIN_TABLE,
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
            'salesByAsin.orderedProductSales.currencyCode',
            'salesByAsin.unitsOrdered',
            'salesByAsin.totalOrderItems',
            'trafficByAsin.sessions',
            'trafficByAsin.pageViews',
            'trafficByAsin.buyBoxPercentage',
            'trafficByAsin.unitSessionPercentage',
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
                parentAsin: 'B0TESTASIN',
                'salesByAsin.orderedProductSales.amount': 50,
                'salesByAsin.orderedProductSales.currencyCode': 'USD',
                'salesByAsin.unitsOrdered': 2,
                'salesByAsin.totalOrderItems': 2,
                'trafficByAsin.sessions': 4,
                'trafficByAsin.pageViews': 8,
                'trafficByAsin.buyBoxPercentage': 95,
                'trafficByAsin.unitSessionPercentage': 50,
              },
            },
          ],
        },
      ],
    },
  };
  const artifactPath = path.join(dir, 'report-report-123.warehouse-ready.json');
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
  return artifactPath;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('FT-01 Sales and Traffic warehouse write', () => {
  it('shapes by-date and by-ASIN rows with account and marketplace identity', async () => {
    const dir = makeTempDir();
    const artifactPath = writeWarehouseReadyArtifact(dir);
    const sink = new CapturingSink();

    const summary = await writeFirstSalesTrafficWarehouseRows({
      accountId: 'sourbear',
      marketplace: 'us',
      ingestionJobId: '00000000-0000-0000-0000-000000000001',
      reportWindowStart: '2026-04-12',
      reportWindowEnd: '2026-04-12',
      exportedAt: '2026-04-20T00:00:00.000Z',
      warehouseReadyArtifactPath: artifactPath,
      sink,
      applySchema: true,
    });

    expect(sink.schemaApplied).toBe(true);
    expect(sink.account).toEqual({ accountId: 'sourbear', marketplace: 'US' });
    expect(summary.totalRowCount).toBe(2);
    expect(summary.legacySalesTrendFallback).toBe(false);
    expect(summary.targetTableNames).toEqual([
      SPAPI_SALES_TRAFFIC_BY_DATE_TABLE,
      SPAPI_SALES_TRAFFIC_BY_ASIN_TABLE,
    ]);
    expect(sink.dateRows[0]).toMatchObject({
      account_id: 'sourbear',
      marketplace: 'US',
      date: '2026-04-12',
      ordered_product_sales_amount: 127.94,
      units_ordered: 6,
      sessions: 10,
    });
    expect(sink.asinRows[0]).toMatchObject({
      account_id: 'sourbear',
      marketplace: 'US',
      asin: 'B0TESTASIN',
      parent_asin: 'B0TESTASIN',
      ordered_product_sales_amount: 50,
    });
  });

  it('returns a deterministic checksum for the same write inputs', async () => {
    const dir = makeTempDir();
    const artifactPath = writeWarehouseReadyArtifact(dir);

    const first = await writeFirstSalesTrafficWarehouseRows({
      accountId: 'sourbear',
      marketplace: 'US',
      ingestionJobId: '00000000-0000-0000-0000-000000000001',
      reportWindowStart: '2026-04-12',
      reportWindowEnd: '2026-04-12',
      exportedAt: '2026-04-20T00:00:00.000Z',
      warehouseReadyArtifactPath: artifactPath,
      sink: new CapturingSink(),
    });
    const second = await writeFirstSalesTrafficWarehouseRows({
      accountId: 'sourbear',
      marketplace: 'US',
      ingestionJobId: '00000000-0000-0000-0000-000000000001',
      reportWindowStart: '2026-04-12',
      reportWindowEnd: '2026-04-12',
      exportedAt: '2026-04-20T00:00:00.000Z',
      warehouseReadyArtifactPath: artifactPath,
      sink: new CapturingSink(),
    });

    expect(second.checksum).toBe(first.checksum);
  });
});
