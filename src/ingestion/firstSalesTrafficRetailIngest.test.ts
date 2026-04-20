import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { InMemoryIngestionJobRepository } from './jobRunner';
import {
  runFirstSalesTrafficRetailIngest,
  summarizeFirstSalesTrafficRetailIngest,
} from './firstSalesTrafficRetailIngest';
import {
  SPAPI_SALES_TRAFFIC_BY_ASIN_TABLE,
  SPAPI_SALES_TRAFFIC_BY_DATE_TABLE,
  type FirstSalesTrafficByAsinWarehouseRow,
  type FirstSalesTrafficByDateWarehouseRow,
  type FirstSalesTrafficWarehouseSink,
} from '../warehouse/firstSalesTrafficWarehouseWrite';

const tempDirs: string[] = [];

const makeTempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ft01-retail-ingest-'));
  tempDirs.push(dir);
  return dir;
};

class TestSink implements FirstSalesTrafficWarehouseSink {
  readonly dateRows: FirstSalesTrafficByDateWarehouseRow[] = [];
  readonly asinRows: FirstSalesTrafficByAsinWarehouseRow[] = [];

  constructor(private readonly fail = false) {}

  async upsertAccount(): Promise<void> {
    if (this.fail) throw new Error('Injected sink failure');
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
        headerCount: 1,
        rowCount: 1,
        targetTableName: SPAPI_SALES_TRAFFIC_BY_DATE_TABLE,
      },
      {
        sectionName: 'salesAndTrafficByAsin',
        headerCount: 0,
        rowCount: 0,
        targetTableName: SPAPI_SALES_TRAFFIC_BY_ASIN_TABLE,
      },
    ],
    totalRowCount: 1,
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
          ],
          rows: [],
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

describe('FT-01 retail Sales and Traffic ingest runner', () => {
  it('runs the warehouse write through the ingestion job and watermark model', async () => {
    const artifactPath = writeWarehouseReadyArtifact(makeTempDir());
    const repository = new InMemoryIngestionJobRepository();
    const sink = new TestSink();

    const result = await runFirstSalesTrafficRetailIngest({
      request: {
        accountId: 'sourbear',
        marketplace: 'us',
        startDate: '2026-04-12',
        endDate: '2026-04-12',
        warehouseReadyArtifactPath: artifactPath,
      },
      repository,
      sink,
      now: () => '2026-04-20T00:00:00.000Z',
      createJobId: () => 'ft01-job-001',
    });

    expect(result.ok).toBe(true);
    expect(result.job.processing_status).toBe('available');
    expect(result.job.account_id).toBe('sourbear');
    expect(result.job.marketplace).toBe('US');
    expect(result.job.row_count).toBe(1);
    expect(result.watermark?.status).toBe('available');
    expect(result.watermark?.watermark_start).toBe('2026-04-12');
    expect(result.watermark?.watermark_end).toBe('2026-04-12');
    expect(sink.dateRows).toHaveLength(1);
    expect(sink.dateRows[0].account_id).toBe('sourbear');
    expect(sink.dateRows[0].marketplace).toBe('US');
    expect(summarizeFirstSalesTrafficRetailIngest(result)).toContain(
      'legacy_sales_trend_fallback=no'
    );
  });

  it('reuses the same available job on duplicate rerun without writing again', async () => {
    const artifactPath = writeWarehouseReadyArtifact(makeTempDir());
    const repository = new InMemoryIngestionJobRepository();
    const firstSink = new TestSink();
    const secondSink = new TestSink();

    const request = {
      accountId: 'sourbear',
      marketplace: 'US',
      startDate: '2026-04-12',
      endDate: '2026-04-12',
      warehouseReadyArtifactPath: artifactPath,
    };

    const first = await runFirstSalesTrafficRetailIngest({
      request,
      repository,
      sink: firstSink,
      now: () => '2026-04-20T00:00:00.000Z',
      createJobId: () => 'ft01-job-001',
    });
    const second = await runFirstSalesTrafficRetailIngest({
      request,
      repository,
      sink: secondSink,
      now: () => '2026-04-20T00:00:01.000Z',
      createJobId: () => 'ft01-job-002',
    });

    expect(first.executorInvoked).toBe(true);
    expect(second.jobResult).toBe('reused_existing');
    expect(second.executorInvoked).toBe(false);
    expect(second.job.id).toBe(first.job.id);
    expect(secondSink.dateRows).toHaveLength(0);
  });

  it('normalizes sink failures and does not update the watermark on failure', async () => {
    const artifactPath = writeWarehouseReadyArtifact(makeTempDir());
    const result = await runFirstSalesTrafficRetailIngest({
      request: {
        accountId: 'sourbear',
        marketplace: 'US',
        startDate: '2026-04-12',
        endDate: '2026-04-12',
        warehouseReadyArtifactPath: artifactPath,
      },
      repository: new InMemoryIngestionJobRepository(),
      sink: new TestSink(true),
      now: () => '2026-04-20T00:00:00.000Z',
      createJobId: () => 'ft01-job-001',
    });

    expect(result.ok).toBe(false);
    expect(result.job.processing_status).toBe('failed');
    expect(result.error?.code).toBe('retail_sales_traffic_ingest_failed');
    expect(result.error?.message).toBe('Injected sink failure');
    expect(result.watermark).toBeNull();
  });
});
