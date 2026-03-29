import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('../apps/web/src/lib/bulksheets/fetchCurrent', () => ({
  fetchCurrentSpData: vi.fn(),
}));

import { buildAdsOptimizerManualOverrideCurrentContextMap } from '../apps/web/src/lib/ads-optimizer/manualOverrideCurrent';

const sourcePath = path.join(
  process.cwd(),
  'apps/web/src/lib/ads-optimizer/manualOverrideCurrent.ts'
);

const makeRow = (overrides: Partial<{
  targetSnapshotId: string;
  targetId: string;
  campaignId: string;
  currentTargetBid: number | null;
  currentTargetState: string | null;
  currentCampaignBiddingStrategy: string | null;
  placementTop: number | null;
  placementRos: number | null;
  placementPp: number | null;
}> = {}) => ({
  targetSnapshotId: 'target-snapshot-1',
  targetId: 'target-1',
  campaignId: 'campaign-1',
  currentTargetBid: 1.1,
  currentTargetState: 'paused',
  currentCampaignBiddingStrategy: 'snapshot strategy',
  placementBreakdown: {
    note: 'snapshot fallback',
    rows: [
      {
        placementCode: 'PLACEMENT_TOP',
        placementLabel: 'Top of search',
        modifierPct: overrides.placementTop ?? 10,
        impressions: null,
        clicks: null,
        orders: null,
        sales: null,
        spend: null,
      },
      {
        placementCode: 'PLACEMENT_REST_OF_SEARCH',
        placementLabel: 'Rest of search',
        modifierPct: overrides.placementRos ?? 5,
        impressions: null,
        clicks: null,
        orders: null,
        sales: null,
        spend: null,
      },
      {
        placementCode: 'PLACEMENT_PRODUCT_PAGE',
        placementLabel: 'Product pages',
        modifierPct: overrides.placementPp ?? null,
        impressions: null,
        clicks: null,
        orders: null,
        sales: null,
        spend: null,
      },
    ],
  },
  ...overrides,
});

const makeLiveCurrentData = (overrides: Partial<{
  snapshotDate: string;
  includeTarget: boolean;
  targetId: string;
  targetBid: number | null;
  targetState: string | null;
  campaignId: string;
  campaignStrategy: string | null;
  placementTop: number | null;
  placementRos: number | null;
  placementPp: number | null;
}> = {}) => ({
  snapshotDate: overrides.snapshotDate ?? '2026-03-21',
  campaignsById: new Map([
    [
      overrides.campaignId ?? 'campaign-1',
      {
        campaign_id: overrides.campaignId ?? 'campaign-1',
        campaign_name_raw: 'Campaign 1',
        state: 'enabled',
        daily_budget: null,
        bidding_strategy: overrides.campaignStrategy ?? 'live strategy',
        portfolio_id: null,
      },
    ],
  ]),
  adGroupsById: new Map(),
  targetsById: new Map(
    overrides.includeTarget === false
      ? []
      : [
          [
            overrides.targetId ?? 'target-1',
            {
              target_id: overrides.targetId ?? 'target-1',
              ad_group_id: 'ad-group-1',
              campaign_id: overrides.campaignId ?? 'campaign-1',
              expression_raw: 'blue widget',
              match_type: 'exact',
              is_negative: false,
              state: overrides.targetState ?? 'enabled',
              bid: overrides.targetBid ?? 1.2,
            },
          ],
        ]
  ),
  placementsByKey: new Map(
    [
      ['PLACEMENT_TOP', overrides.placementTop ?? 20],
      ['PLACEMENT_REST_OF_SEARCH', overrides.placementRos ?? 6],
      ['PLACEMENT_PRODUCT_PAGE', overrides.placementPp ?? null],
    ]
      .filter(([, value]) => value !== null)
      .map(([placementCode, percentage]) => [
        `${overrides.campaignId ?? 'campaign-1'}::${placementCode.toLowerCase()}`,
        {
          campaign_id: overrides.campaignId ?? 'campaign-1',
          placement_raw: placementCode,
          placement_code: placementCode,
          percentage: percentage as number,
        },
      ])
  ),
});

describe('ads optimizer manual override current context', () => {
  it('prefers live target and campaign values over snapshot fallback values', () => {
    const result = buildAdsOptimizerManualOverrideCurrentContextMap({
      rows: [makeRow()],
      liveCurrentData: makeLiveCurrentData(),
    });

    expect(result.get('target-snapshot-1')).toEqual({
      snapshotDate: '2026-03-21',
      targetBid: 1.2,
      targetState: 'enabled',
      campaignBiddingStrategy: 'live strategy',
      placementModifiers: {
        PLACEMENT_TOP: 20,
        PLACEMENT_REST_OF_SEARCH: 6,
        PLACEMENT_PRODUCT_PAGE: null,
      },
    });
  });

  it('falls back to snapshot target values when the target identity is unresolved while still using live campaign fields', () => {
    const result = buildAdsOptimizerManualOverrideCurrentContextMap({
      rows: [
        makeRow({
          targetSnapshotId: 'target-snapshot-unresolved',
          targetId: 'Unresolved target ID',
          currentTargetBid: 1.35,
          currentTargetState: 'enabled',
          currentCampaignBiddingStrategy: 'snapshot strategy',
          placementTop: 8,
          placementRos: 3,
        }),
      ],
      liveCurrentData: makeLiveCurrentData({
        includeTarget: false,
        campaignStrategy: 'dynamic up and down',
        placementTop: 25,
        placementRos: 4,
      }),
    });

    expect(result.get('target-snapshot-unresolved')).toEqual({
      snapshotDate: '2026-03-21',
      targetBid: 1.35,
      targetState: 'enabled',
      campaignBiddingStrategy: 'dynamic up and down',
      placementModifiers: {
        PLACEMENT_TOP: 25,
        PLACEMENT_REST_OF_SEARCH: 4,
        PLACEMENT_PRODUCT_PAGE: null,
      },
    });
  });

  it('does not fall back to CPC when neither live nor snapshot bid is available', () => {
    const result = buildAdsOptimizerManualOverrideCurrentContextMap({
      rows: [
        {
          ...makeRow({
            targetSnapshotId: 'target-snapshot-no-bid',
            currentTargetBid: null,
            currentTargetState: null,
            currentCampaignBiddingStrategy: null,
            placementTop: null,
            placementRos: null,
            placementPp: null,
          }),
          raw: {
            cpc: 0.77,
          },
        } as never,
      ],
      liveCurrentData: null,
    });

    expect(result.get('target-snapshot-no-bid')).toEqual({
      snapshotDate: null,
      targetBid: null,
      targetState: null,
      campaignBiddingStrategy: null,
      placementModifiers: {
        PLACEMENT_TOP: 10,
        PLACEMENT_REST_OF_SEARCH: 5,
        PLACEMENT_PRODUCT_PAGE: null,
      },
    });
  });

  it('keeps the builder free of any CPC fallback logic', () => {
    const source = fs.readFileSync(sourcePath, 'utf-8');

    expect(source).not.toContain('raw.cpc');
    expect(source).not.toContain('activeRow.raw.cpc');
  });
});
