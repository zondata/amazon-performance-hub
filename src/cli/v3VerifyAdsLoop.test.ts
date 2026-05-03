import { describe, expect, it } from 'vitest';

import {
  evaluateAdsLoopVerification,
  findDuplicateActiveScopes,
  parseVerifyAdsLoopArgs,
} from './v3VerifyAdsLoop';

describe('parseVerifyAdsLoopArgs', () => {
  it('parses the verification command arguments', () => {
    const args = parseVerifyAdsLoopArgs([
      '--account-id=sourbear',
      '--marketplace=US',
      '--lookback-hours=24',
      '--max-pending-age-hours=72',
    ]);

    expect(args.accountId).toBe('sourbear');
    expect(args.marketplace).toBe('US');
    expect(args.lookbackHours).toBe(24);
    expect(args.maxPendingAgeHours).toBe(72);
  });
});

describe('findDuplicateActiveScopes', () => {
  it('detects duplicate active report ids for the same reuse scope', () => {
    const duplicates = findDuplicateActiveScopes([
      {
        id: '1',
        sourceType: 'ads_api_sp_campaign_daily',
        reportId: 'report-a',
        status: 'pending',
        startDate: '2026-04-20',
        endDate: '2026-04-20',
        createdAt: '2026-04-21T00:00:00.000Z',
        updatedAt: '2026-04-21T00:01:00.000Z',
        completedAt: null,
        retryAfterAt: null,
        notes: null,
        profileIdHash: 'profile-1',
        reportTypeId: 'campaign-daily',
      },
      {
        id: '2',
        sourceType: 'ads_api_sp_campaign_daily',
        reportId: 'report-b',
        status: 'polling',
        startDate: '2026-04-20',
        endDate: '2026-04-20',
        createdAt: '2026-04-21T00:02:00.000Z',
        updatedAt: '2026-04-21T00:03:00.000Z',
        completedAt: null,
        retryAfterAt: null,
        notes: null,
        profileIdHash: 'profile-1',
        reportTypeId: 'campaign-daily',
      },
    ]);

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].reportIds).toEqual(['report-a', 'report-b']);
  });
});

describe('evaluateAdsLoopVerification', () => {
  const nowIso = '2026-04-29T12:00:00.000Z';

  it('returns WARN when implemented sources are healthy and unsupported sources are still pending implementation', () => {
    const result = evaluateAdsLoopVerification({
      nowIso,
      lookbackHours: 36,
      maxPendingAgeHours: 72,
      pendingRows: [
        {
          id: '1',
          sourceType: 'ads_api_sp_campaign_daily',
          reportId: 'campaign-report',
          status: 'pending',
          startDate: '2026-04-28',
          endDate: '2026-04-28',
          createdAt: '2026-04-29T10:00:00.000Z',
          updatedAt: '2026-04-29T10:05:00.000Z',
          completedAt: null,
          retryAfterAt: null,
          notes: null,
          profileIdHash: 'profile-1',
          reportTypeId: 'campaign-daily',
        },
      ],
      coverageRows: [
        {
          sourceType: 'ads_api_sp_campaign_daily',
          tableName: 'sp_campaign_hourly_fact_gold',
          lastStatus: 'success',
          freshnessStatus: 'fresh',
          latestPeriodEnd: '2026-04-28T23:59:59.000Z',
          lastSuccessfulRunAt: '2026-04-29T11:30:00.000Z',
          notes: null,
        },
        {
          sourceType: 'ads_api_sp_target_daily',
          tableName: 'sp_targeting_daily_fact',
          lastStatus: 'success',
          freshnessStatus: 'fresh',
          latestPeriodEnd: '2026-04-28T23:59:59.000Z',
          lastSuccessfulRunAt: '2026-04-29T11:15:00.000Z',
          notes: null,
        },
        {
          sourceType: 'ads_api_sp_placement_daily',
          tableName: 'sp_placement_daily_fact',
          lastStatus: 'success',
          freshnessStatus: 'fresh',
          latestPeriodEnd: '2026-04-28T23:59:59.000Z',
          lastSuccessfulRunAt: '2026-04-29T11:10:00.000Z',
          notes: null,
        },
        {
          sourceType: 'ads_api_sp_advertised_product_daily',
          tableName: 'sp_advertised_product_daily_fact',
          lastStatus: 'success',
          freshnessStatus: 'fresh',
          latestPeriodEnd: '2026-04-28T23:59:59.000Z',
          lastSuccessfulRunAt: '2026-04-29T11:05:00.000Z',
          notes: null,
        },
        {
          sourceType: 'ads_api_sp_search_term_daily',
          tableName: 'sp_search_term_daily_fact',
          lastStatus: 'success',
          freshnessStatus: 'fresh',
          latestPeriodEnd: '2026-04-28T23:59:59.000Z',
          lastSuccessfulRunAt: '2026-04-29T11:00:00.000Z',
          notes: null,
        },
      ],
    });

    expect(result.status).toBe('WARN');
    expect(result.failures).toEqual([]);
    expect(result.activeRows).toHaveLength(1);
    expect(result.warnings[0]).toContain('not implemented yet');
  });

  it('fails on unhealthy pending rows', () => {
    const result = evaluateAdsLoopVerification({
      nowIso,
      lookbackHours: 36,
      maxPendingAgeHours: 72,
      pendingRows: [
        {
          id: '1',
          sourceType: 'ads_api_sp_target_daily',
          reportId: 'target-report',
          status: 'failed',
          startDate: '2026-04-28',
          endDate: '2026-04-28',
          createdAt: '2026-04-28T01:00:00.000Z',
          updatedAt: '2026-04-28T01:30:00.000Z',
          completedAt: null,
          retryAfterAt: null,
          notes: null,
          profileIdHash: 'profile-1',
          reportTypeId: 'target-daily',
        },
      ],
      coverageRows: [
        {
          sourceType: 'ads_api_sp_campaign_daily',
          tableName: 'sp_campaign_hourly_fact_gold',
          lastStatus: 'success',
          freshnessStatus: 'fresh',
          latestPeriodEnd: '2026-04-28T23:59:59.000Z',
          lastSuccessfulRunAt: '2026-04-29T11:30:00.000Z',
          notes: null,
        },
        {
          sourceType: 'ads_api_sp_target_daily',
          tableName: 'sp_targeting_daily_fact',
          lastStatus: 'success',
          freshnessStatus: 'fresh',
          latestPeriodEnd: '2026-04-28T23:59:59.000Z',
          lastSuccessfulRunAt: '2026-04-29T11:15:00.000Z',
          notes: null,
        },
      ],
    });

    expect(result.status).toBe('FAIL');
    expect(result.failures.join(' ')).toContain('terminal failure');
  });

  it('fails when implemented coverage is stale and no active recovery exists', () => {
    const result = evaluateAdsLoopVerification({
      nowIso,
      lookbackHours: 12,
      maxPendingAgeHours: 72,
      pendingRows: [],
      coverageRows: [
        {
          sourceType: 'ads_api_sp_campaign_daily',
          tableName: 'sp_campaign_hourly_fact_gold',
          lastStatus: 'success',
          freshnessStatus: 'stale',
          latestPeriodEnd: '2026-04-20T23:59:59.000Z',
          lastSuccessfulRunAt: '2026-04-20T23:59:59.000Z',
          notes: null,
        },
        {
          sourceType: 'ads_api_sp_target_daily',
          tableName: 'sp_targeting_daily_fact',
          lastStatus: 'success',
          freshnessStatus: 'fresh',
          latestPeriodEnd: '2026-04-28T23:59:59.000Z',
          lastSuccessfulRunAt: '2026-04-29T08:00:00.000Z',
          notes: null,
        },
      ],
    });

    expect(result.status).toBe('FAIL');
    expect(result.failures.join(' ')).toContain('SP campaign daily coverage is not healthy');
  });

  it('uses source-specific coverage rows instead of stale generic rows for the same table', () => {
    const result = evaluateAdsLoopVerification({
      nowIso,
      lookbackHours: 36,
      maxPendingAgeHours: 72,
      pendingRows: [],
      coverageRows: [
        {
          sourceType: 'ads_api',
          tableName: 'sp_advertised_product_daily_fact',
          lastStatus: 'blocked',
          freshnessStatus: 'blocked',
          latestPeriodEnd: '2026-04-04T00:00:00.000Z',
          lastSuccessfulRunAt: null,
          notes:
            '[sp_advertised_product_daily] SP advertised product automation is not implemented by the current Ads API pullers.',
        },
        {
          sourceType: 'ads_api_sp_advertised_product_daily',
          tableName: 'sp_advertised_product_daily_fact',
          lastStatus: 'success',
          freshnessStatus: 'fresh',
          latestPeriodEnd: '2026-04-29T00:00:00.000Z',
          lastSuccessfulRunAt: '2026-04-29T11:05:00.000Z',
          notes: '[sp_advertised_product_daily] SP Advertised Product Daily ingested successfully.',
        },
        {
          sourceType: 'ads_api_sp_campaign_daily',
          tableName: 'sp_campaign_hourly_fact_gold',
          lastStatus: 'success',
          freshnessStatus: 'fresh',
          latestPeriodEnd: '2026-04-28T23:59:59.000Z',
          lastSuccessfulRunAt: '2026-04-29T11:30:00.000Z',
          notes: null,
        },
        {
          sourceType: 'ads_api_sp_target_daily',
          tableName: 'sp_targeting_daily_fact',
          lastStatus: 'success',
          freshnessStatus: 'fresh',
          latestPeriodEnd: '2026-04-28T23:59:59.000Z',
          lastSuccessfulRunAt: '2026-04-29T11:15:00.000Z',
          notes: null,
        },
        {
          sourceType: 'ads_api_sp_placement_daily',
          tableName: 'sp_placement_daily_fact',
          lastStatus: 'success',
          freshnessStatus: 'fresh',
          latestPeriodEnd: '2026-04-28T23:59:59.000Z',
          lastSuccessfulRunAt: '2026-04-29T11:10:00.000Z',
          notes: null,
        },
        {
          sourceType: 'ads_api_sp_search_term_daily',
          tableName: 'sp_search_term_daily_fact',
          lastStatus: 'success',
          freshnessStatus: 'fresh',
          latestPeriodEnd: '2026-04-28T23:59:59.000Z',
          lastSuccessfulRunAt: '2026-04-29T11:00:00.000Z',
          notes: null,
        },
      ],
    });

    expect(result.failures.join(' ')).not.toContain('SP advertised product daily coverage is not healthy');
    const advertisedCoverage = result.implementedCoverage.find(
      (row) => row.sourceType === 'ads_api_sp_advertised_product_daily'
    );
    expect(advertisedCoverage?.coverageStatus).toBe('success/fresh');
  });
});
