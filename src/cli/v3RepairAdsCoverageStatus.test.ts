import { describe, expect, it } from 'vitest';

import {
  deriveRepairedCoverageRow,
  parseRepairAdsCoverageArgs,
} from './v3RepairAdsCoverageStatus';

describe('parseRepairAdsCoverageArgs', () => {
  it('parses account and marketplace from standard resume-style args', () => {
    const args = parseRepairAdsCoverageArgs([
      '--account-id=sourbear',
      '--marketplace=US',
    ]);

    expect(args).toEqual({
      accountId: 'sourbear',
      marketplace: 'US',
    });
  });
});

describe('deriveRepairedCoverageRow', () => {
  const salesSpec = {
    sourceType: 'sp_api_sales_traffic_daily' as const,
    sourceName: 'sales_traffic' as const,
    tableName: 'amazon_sales_traffic_timeseries' as const,
    granularity: 'daily' as const,
    periodStartExpr: 'date::timestamptz',
    periodEndExpr: 'date::timestamptz',
    expectedDelayHours: 48,
    successNote:
      'Sales & Traffic imported successfully for the latest available report day.',
    failedLabel: 'Sales & Traffic',
  };
  const campaignSpec = {
    sourceType: 'ads_api_sp_campaign_daily' as const,
    sourceName: 'sp_campaign_hourly' as const,
    tableName: 'sp_campaign_hourly_fact_gold' as const,
    granularity: 'hourly' as const,
    periodStartExpr: "(date::timestamp + coalesce(start_time, time '00:00'))::timestamptz",
    periodEndExpr:
      "(date::timestamp + coalesce(start_time, time '00:00') + interval '1 hour')::timestamptz",
    expectedDelayHours: 48,
    successNote:
      'SP Campaign Daily imported successfully for the latest available period.',
    failedLabel: 'SP Campaign Daily',
  };

  it('repairs imported campaign coverage as success with a populated success timestamp', () => {
    const row = deriveRepairedCoverageRow({
      spec: campaignSpec,
      stats: {
        rowCount: 2461,
        oldestPeriodStart: '2026-03-31T00:00:00.000Z',
        latestPeriodEnd: '2026-04-29T23:00:00.000Z',
        latestCompletePeriodEnd: '2026-04-29T23:00:00.000Z',
      },
      latestRequest: {
        reportId: 'campaign-report',
        status: 'imported',
        createdAt: '2026-04-29T08:33:22.000Z',
        updatedAt: '2026-04-29T14:40:44.000Z',
        completedAt: '2026-04-29T14:40:44.000Z',
        retryAfterAt: null,
        notes: 'Imported into sp_campaign_hourly_fact_gold by the V3 Ads sync batch.',
      },
      lastSyncRunId: 'sync-1',
      fallbackSuccessfulRunAt: null,
      nowIso: '2026-04-30T00:00:00.000Z',
    });

    expect(row.lastStatus).toBe('success');
    expect(row.lastSuccessfulRunAt).toBe('2026-04-29T14:40:44.000Z');
    expect(row.latestPeriodEnd).toBe('2026-04-29T23:00:00.000Z');
  });

  it('repairs existing fact coverage as success even when no scoped coverage row exists yet', () => {
    const row = deriveRepairedCoverageRow({
      spec: campaignSpec,
      stats: {
        rowCount: 2461,
        oldestPeriodStart: '2026-03-31T00:00:00.000Z',
        latestPeriodEnd: '2026-04-29T23:00:00.000Z',
        latestCompletePeriodEnd: '2026-04-29T23:00:00.000Z',
      },
      latestRequest: null,
      lastSyncRunId: 'sync-2',
      fallbackSuccessfulRunAt: null,
      nowIso: '2026-04-30T00:00:00.000Z',
    });

    expect(row.lastStatus).toBe('success');
    expect(row.notes).toContain('coverage was repaired from existing imported fact data');
  });

  it('repairs sales traffic coverage from existing fact data', () => {
    const row = deriveRepairedCoverageRow({
      spec: salesSpec,
      stats: {
        rowCount: 771,
        oldestPeriodStart: '2026-03-01T00:00:00.000Z',
        latestPeriodEnd: '2026-04-25T00:00:00.000Z',
        latestCompletePeriodEnd: '2026-04-25T00:00:00.000Z',
      },
      latestRequest: null,
      lastSyncRunId: null,
      fallbackSuccessfulRunAt: '2026-04-28T09:35:29.025Z',
      nowIso: '2026-04-30T00:00:00.000Z',
    });

    expect(row.lastStatus).toBe('success');
    expect(row.freshnessStatus).toBe('stale');
    expect(row.lastSuccessfulRunAt).toBe('2026-04-28T09:35:29.025Z');
    expect(row.notes).toContain('Sales & Traffic coverage was repaired');
  });
});
