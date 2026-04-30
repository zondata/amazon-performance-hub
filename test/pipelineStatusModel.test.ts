import { describe, expect, it } from 'vitest';

import {
  buildPipelineStatusRows,
  type PipelineCoverageRow,
  type PipelinePendingRow,
  type PipelineStatusSpec,
} from '../apps/web/src/lib/pipeline-status/model';

const buildRows = (args: {
  specs: PipelineStatusSpec[];
  coverageRows?: PipelineCoverageRow[];
  pendingRows?: PipelinePendingRow[];
}) =>
  buildPipelineStatusRows({
    specs: args.specs,
    coverageRows: args.coverageRows ?? [],
    pendingRows: args.pendingRows ?? [],
    nowIso: '2026-05-01T12:00:00.000Z',
  }).rows;

describe('buildPipelineStatusRows', () => {
  it('maps implemented fresh success to Complete and imported', () => {
    const rows = buildRows({
      specs: [
        {
          sourceGroup: 'SP campaign daily',
          sourceType: 'ads_api_sp_campaign_daily',
          targetTable: 'sp_campaign_hourly_fact_gold',
          implementationStatus: 'implemented',
          pendingSourceType: 'ads_api_sp_campaign_daily',
        },
      ],
      coverageRows: [
        {
          sourceType: 'ads_api_sp_campaign_daily',
          tableName: 'sp_campaign_hourly_fact_gold',
          lastStatus: 'success',
          freshnessStatus: 'fresh',
          oldestPeriodStart: '2026-04-01T00:00:00.000Z',
          latestPeriodEnd: '2026-04-30T23:59:59.000Z',
          lastSuccessfulRunAt: '2026-05-01T08:00:00.000Z',
          lastSyncRunId: null,
          notes: null,
        },
      ],
    });

    expect(rows[0].dataCompleteness).toBe('Complete');
    expect(rows[0].amazonApiState).toBe('imported');
  });

  it('maps delayed expected success to Expected Delay', () => {
    const rows = buildRows({
      specs: [
        {
          sourceGroup: 'SP target daily',
          sourceType: 'ads_api_sp_target_daily',
          targetTable: 'sp_targeting_daily_fact',
          implementationStatus: 'implemented',
          pendingSourceType: 'ads_api_sp_target_daily',
        },
      ],
      coverageRows: [
        {
          sourceType: 'ads_api_sp_target_daily',
          tableName: 'sp_targeting_daily_fact',
          lastStatus: 'success',
          freshnessStatus: 'delayed_expected',
          oldestPeriodStart: '2026-04-01',
          latestPeriodEnd: '2026-04-29',
          lastSuccessfulRunAt: '2026-05-01T08:00:00.000Z',
          lastSyncRunId: null,
          notes: null,
        },
      ],
    });

    expect(rows[0].dataCompleteness).toBe('Expected Delay');
  });

  it('maps stale success to Incomplete', () => {
    const rows = buildRows({
      specs: [
        {
          sourceGroup: 'SP placement daily',
          sourceType: 'ads_api_sp_placement_daily',
          targetTable: 'sp_placement_daily_fact',
          implementationStatus: 'implemented',
          pendingSourceType: 'ads_api_sp_placement_daily',
        },
      ],
      coverageRows: [
        {
          sourceType: 'ads_api_sp_placement_daily',
          tableName: 'sp_placement_daily_fact',
          lastStatus: 'success',
          freshnessStatus: 'stale',
          oldestPeriodStart: '2026-04-01',
          latestPeriodEnd: '2026-04-21',
          lastSuccessfulRunAt: '2026-05-01T08:00:00.000Z',
          lastSyncRunId: null,
          notes: null,
        },
      ],
    });

    expect(rows[0].dataCompleteness).toBe('Incomplete');
  });

  it('maps not implemented to Blocked with no amazon api state', () => {
    const rows = buildRows({
      specs: [
        {
          sourceGroup: 'SB campaign daily',
          sourceType: 'ads_api_sb_campaign_daily',
          targetTable: 'sb_campaign_daily_fact_gold',
          implementationStatus: 'not_implemented',
        },
      ],
    });

    expect(rows[0].dataCompleteness).toBe('Blocked');
    expect(rows[0].amazonApiState).toBe('—');
  });

  it('prefers active polling pending rows over imported coverage', () => {
    const rows = buildRows({
      specs: [
        {
          sourceGroup: 'SP search term daily',
          sourceType: 'ads_api_sp_search_term_daily',
          targetTable: 'sp_search_term_daily_fact',
          implementationStatus: 'implemented',
          pendingSourceType: 'ads_api_sp_search_term_daily',
        },
      ],
      coverageRows: [
        {
          sourceType: 'ads_api_sp_search_term_daily',
          tableName: 'sp_search_term_daily_fact',
          lastStatus: 'success',
          freshnessStatus: 'fresh',
          oldestPeriodStart: '2026-04-01',
          latestPeriodEnd: '2026-04-30',
          lastSuccessfulRunAt: '2026-05-01T08:00:00.000Z',
          lastSyncRunId: null,
          notes: null,
        },
      ],
      pendingRows: [
        {
          sourceType: 'ads_api_sp_search_term_daily',
          status: 'completed',
          createdAt: '2026-05-01T08:00:00.000Z',
          retryAfterAt: null,
        },
        {
          sourceType: 'ads_api_sp_search_term_daily',
          status: 'polling',
          createdAt: '2026-05-01T09:00:00.000Z',
          retryAfterAt: null,
        },
      ],
    });

    expect(rows[0].amazonApiState).toBe('polling');
  });

  it('shows failed when pending rows fail', () => {
    const rows = buildRows({
      specs: [
        {
          sourceGroup: 'SP advertised product daily',
          sourceType: 'ads_api_sp_advertised_product_daily',
          targetTable: 'sp_advertised_product_daily_fact',
          implementationStatus: 'implemented',
          pendingSourceType: 'ads_api_sp_advertised_product_daily',
        },
      ],
      pendingRows: [
        {
          sourceType: 'ads_api_sp_advertised_product_daily',
          status: 'failed',
          createdAt: '2026-05-01T09:00:00.000Z',
          retryAfterAt: null,
        },
      ],
    });

    expect(rows[0].amazonApiState).toBe('failed');
  });

  it('shows No Data when coverage is missing', () => {
    const rows = buildRows({
      specs: [
        {
          sourceGroup: 'SQP',
          sourceType: 'sp_api_sqp_weekly',
          targetTable: 'sqp_weekly_latest',
          implementationStatus: 'implemented',
        },
      ],
    });

    expect(rows[0].dataCompleteness).toBe('No Data');
  });

  it('maps oldest_period_start to earliestReportDay as YYYY-MM-DD', () => {
    const rows = buildRows({
      specs: [
        {
          sourceGroup: 'Sales & Traffic',
          sourceType: 'sp_api_sales_traffic_daily',
          targetTable: 'amazon_sales_traffic_timeseries',
          implementationStatus: 'implemented',
        },
      ],
      coverageRows: [
        {
          sourceType: 'sp_api_sales_traffic_daily',
          tableName: 'amazon_sales_traffic_timeseries',
          lastStatus: 'success',
          freshnessStatus: 'fresh',
          oldestPeriodStart: '2026-04-03T14:15:16.000Z',
          latestPeriodEnd: '2026-04-30T23:59:59.000Z',
          lastSuccessfulRunAt: '2026-05-01T08:00:00.000Z',
          lastSyncRunId: null,
          notes: null,
        },
      ],
    });

    expect(rows[0].earliestReportDay).toBe('2026-04-03');
    expect(rows[0].latestReportDay).toBe('2026-04-30');
  });
});
