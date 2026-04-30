import { describe, expect, it } from 'vitest';

import {
  buildPipelineStatusRows,
  type PipelineCoverageRow,
  type PipelinePendingRow,
  type PipelineStatusSpec,
} from '../apps/web/src/lib/pipeline-status/model';

const implementedSpec: PipelineStatusSpec = {
  sourceGroup: 'SP target daily',
  sourceType: 'ads_api_sp_target_daily',
  targetTable: 'sp_targeting_daily_fact',
  implementationStatus: 'implemented',
  pendingSourceType: 'ads_api_sp_target_daily',
};

const notImplementedSpec: PipelineStatusSpec = {
  sourceGroup: 'SB campaign daily',
  sourceType: 'ads_api_sb_campaign_daily',
  targetTable: 'sb_campaign_daily_fact_gold',
  implementationStatus: 'not_implemented',
};

const baseCoverage = (
  overrides: Partial<PipelineCoverageRow> = {}
): PipelineCoverageRow => ({
  sourceType: 'ads_api_sp_target_daily',
  tableName: 'sp_targeting_daily_fact',
  lastStatus: 'success',
  freshnessStatus: 'fresh',
  oldestPeriodStart: '2026-04-01T00:00:00.000Z',
  latestPeriodEnd: '2026-04-29T23:59:59.000Z',
  lastSuccessfulRunAt: '2026-04-30T08:00:00.000Z',
  lastSyncRunId: null,
  notes: null,
  ...overrides,
});

const pendingRow = (
  overrides: Partial<PipelinePendingRow> = {}
): PipelinePendingRow => ({
  sourceType: 'ads_api_sp_target_daily',
  status: 'pending',
  createdAt: '2026-04-30T09:00:00.000Z',
  retryAfterAt: null,
  ...overrides,
});

const buildSingleRow = (args: {
  spec?: PipelineStatusSpec;
  coverageRows?: PipelineCoverageRow[];
  pendingRows?: PipelinePendingRow[];
}) =>
  buildPipelineStatusRows({
    specs: [args.spec ?? implementedSpec],
    coverageRows: args.coverageRows ?? [],
    pendingRows: args.pendingRows ?? [],
    nowIso: '2026-04-30T12:00:00.000Z',
  }).rows[0];

describe('buildPipelineStatusRows operator fields', () => {
  it('maps implemented fresh success to Complete and imported', () => {
    const row = buildSingleRow({
      coverageRows: [baseCoverage()],
    });

    expect(row.dataCompleteness).toBe('Complete');
    expect(row.amazonApiState).toBe('imported');
  });

  it('maps implemented delayed expected success to Expected Delay', () => {
    const row = buildSingleRow({
      coverageRows: [baseCoverage({ freshnessStatus: 'delayed_expected' })],
    });

    expect(row.dataCompleteness).toBe('Expected Delay');
  });

  it('maps implemented stale success to Incomplete', () => {
    const row = buildSingleRow({
      coverageRows: [baseCoverage({ freshnessStatus: 'stale' })],
    });

    expect(row.dataCompleteness).toBe('Incomplete');
  });

  it('maps not implemented to Blocked and no Amazon state', () => {
    const row = buildSingleRow({
      spec: notImplementedSpec,
    });

    expect(row.implementationStatus).toBe('not_implemented');
    expect(row.dataCompleteness).toBe('Blocked');
    expect(row.amazonApiState).toBe('—');
  });

  it('prefers active polling pending rows over imported coverage state', () => {
    const row = buildSingleRow({
      coverageRows: [baseCoverage()],
      pendingRows: [
        pendingRow({ status: 'created', createdAt: '2026-04-30T08:00:00.000Z' }),
        pendingRow({ status: 'polling', createdAt: '2026-04-30T10:00:00.000Z' }),
      ],
    });

    expect(row.amazonApiState).toBe('polling');
  });

  it('shows failed when the related pending row failed', () => {
    const row = buildSingleRow({
      coverageRows: [baseCoverage()],
      pendingRows: [pendingRow({ status: 'failed', createdAt: '2026-04-30T10:00:00.000Z' })],
    });

    expect(row.amazonApiState).toBe('failed');
  });

  it('maps missing coverage to No Data', () => {
    const row = buildSingleRow({});

    expect(row.dataCompleteness).toBe('No Data');
    expect(row.amazonApiState).toBe('—');
  });

  it('maps oldest_period_start to earliestReportDay as YYYY-MM-DD', () => {
    const row = buildSingleRow({
      coverageRows: [
        baseCoverage({
          oldestPeriodStart: '2026-03-15T00:00:00.000Z',
          latestPeriodEnd: '2026-04-28T23:59:59.000Z',
        }),
      ],
    });

    expect(row.earliestReportDay).toBe('2026-03-15');
    expect(row.latestReportDay).toBe('2026-04-28');
  });
});
