import { describe, expect, it, vi } from 'vitest';

vi.mock('../apps/web/src/lib/env', () => ({
  env: {
    supabaseUrl: 'https://example.supabase.co',
    supabaseServiceRoleKey: 'service-role-key',
    accountId: 'acct',
    marketplace: 'US',
  },
}));

vi.mock('../apps/web/src/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: () => {
      throw new Error('supabaseAdmin should not be called in adsOptimizerLastDetectedChange.test.ts');
    },
  },
}));

import { buildAdsOptimizerLastDetectedChangesForTargets } from '../apps/web/src/lib/ads-optimizer/lastDetectedChange';

const buildTargetRowRef = (overrides: Partial<{
  targetSnapshotId: string;
  targetId: string;
  campaignId: string;
}> = {}) => ({
  targetSnapshotId: 'snap-1',
  targetId: 'target-1',
  campaignId: 'campaign-1',
  ...overrides,
});

const getChange = (
  result: Map<
    string,
    {
      detectedDate: string | null;
      items: Array<{
        label: string;
        previousDisplay: string;
        currentDisplay: string;
        deltaPercentLabel: string | null;
      }>;
      overflowCount: number;
      emptyMessage: string | null;
    }
  >,
  targetSnapshotId = 'snap-1'
) => result.get(targetSnapshotId)!;

describe('ads optimizer last detected change', () => {
  it('detects the latest target bid change from descending bulk target history', () => {
    const result = buildAdsOptimizerLastDetectedChangesForTargets({
      rows: [buildTargetRowRef()],
      bulkTargetRows: [
        { target_id: 'target-1', snapshot_date: '2026-03-20', bid: 1.2, state: 'enabled' },
        { target_id: 'target-1', snapshot_date: '2026-03-19', bid: 1.2, state: 'enabled' },
        { target_id: 'target-1', snapshot_date: '2026-03-18', bid: 1, state: 'enabled' },
      ],
      bulkCampaignRows: [],
      placementChangeLogRows: [],
      bulkPlacementRows: [],
    });

    expect(getChange(result)).toMatchObject({
      detectedDate: '2026-03-19',
      overflowCount: 0,
      emptyMessage: null,
    });
    expect(getChange(result).items).toEqual([
      {
        key: 'target_bid:target-1:2026-03-19',
        kind: 'target_bid',
        label: 'Bid',
        previousDisplay: '$1.00',
        currentDisplay: '$1.20',
        deltaPercentLabel: '+20%',
        deltaDirection: 'positive',
      },
    ]);
  });

  it('detects the latest target state change from descending bulk target history', () => {
    const result = buildAdsOptimizerLastDetectedChangesForTargets({
      rows: [buildTargetRowRef()],
      bulkTargetRows: [
        { target_id: 'target-1', snapshot_date: '2026-03-20', bid: 1.2, state: 'paused' },
        { target_id: 'target-1', snapshot_date: '2026-03-19', bid: 1.2, state: 'paused' },
        { target_id: 'target-1', snapshot_date: '2026-03-18', bid: 1.2, state: 'enabled' },
      ],
      bulkCampaignRows: [],
      placementChangeLogRows: [],
      bulkPlacementRows: [],
    });

    expect(getChange(result).detectedDate).toBe('2026-03-19');
    expect(getChange(result).items).toEqual([
      {
        key: 'target_state:target-1:2026-03-19',
        kind: 'target_state',
        label: 'State',
        previousDisplay: 'enabled',
        currentDisplay: 'paused',
        deltaPercentLabel: null,
        deltaDirection: null,
      },
    ]);
  });

  it('detects the latest campaign bidding strategy change from descending campaign history', () => {
    const result = buildAdsOptimizerLastDetectedChangesForTargets({
      rows: [buildTargetRowRef()],
      bulkTargetRows: [],
      bulkCampaignRows: [
        {
          campaign_id: 'campaign-1',
          snapshot_date: '2026-03-20',
          bidding_strategy: 'dynamic down only',
        },
        {
          campaign_id: 'campaign-1',
          snapshot_date: '2026-03-19',
          bidding_strategy: 'fixed bids',
        },
      ],
      placementChangeLogRows: [],
      bulkPlacementRows: [],
    });

    expect(getChange(result).detectedDate).toBe('2026-03-20');
    expect(getChange(result).items).toEqual([
      {
        key: 'campaign_bidding_strategy:campaign-1:2026-03-20',
        kind: 'campaign_bidding_strategy',
        label: 'Strategy',
        previousDisplay: 'fixed bids',
        currentDisplay: 'dynamic down only',
        deltaPercentLabel: null,
        deltaDirection: null,
      },
    ]);
  });

  it('uses placement modifier change-log rows when they exist for a campaign and placement', () => {
    const result = buildAdsOptimizerLastDetectedChangesForTargets({
      rows: [buildTargetRowRef()],
      bulkTargetRows: [],
      bulkCampaignRows: [],
      placementChangeLogRows: [
        {
          campaign_id: 'campaign-1',
          snapshot_date: '2026-03-20',
          placement_code: 'PLACEMENT_TOP',
          old_pct: 0,
          new_pct: 50,
        },
      ],
      bulkPlacementRows: [
        {
          campaign_id: 'campaign-1',
          snapshot_date: '2026-03-20',
          placement_code: 'PLACEMENT_TOP',
          percentage: 50,
        },
        {
          campaign_id: 'campaign-1',
          snapshot_date: '2026-03-19',
          placement_code: 'PLACEMENT_TOP',
          percentage: 0,
        },
      ],
    });

    expect(getChange(result).detectedDate).toBe('2026-03-20');
    expect(getChange(result).items).toEqual([
      {
        key: 'placement_modifier:campaign-1:PLACEMENT_TOP:2026-03-20',
        kind: 'placement_modifier',
        label: 'TOS modifier',
        previousDisplay: '0%',
        currentDisplay: '50%',
        deltaPercentLabel: null,
        deltaDirection: null,
      },
    ]);
  });

  it('falls back to bulk placement snapshot diffs when no change-log rows exist', () => {
    const result = buildAdsOptimizerLastDetectedChangesForTargets({
      rows: [buildTargetRowRef()],
      bulkTargetRows: [],
      bulkCampaignRows: [],
      placementChangeLogRows: [],
      bulkPlacementRows: [
        {
          campaign_id: 'campaign-1',
          snapshot_date: '2026-03-20',
          placement_code: 'PLACEMENT_REST_OF_SEARCH',
          percentage: 25,
        },
        {
          campaign_id: 'campaign-1',
          snapshot_date: '2026-03-19',
          placement_code: 'PLACEMENT_REST_OF_SEARCH',
          percentage: 0,
        },
      ],
    });

    expect(getChange(result).detectedDate).toBe('2026-03-20');
    expect(getChange(result).items).toEqual([
      {
        key: 'placement_modifier:campaign-1:PLACEMENT_REST_OF_SEARCH:2026-03-20',
        kind: 'placement_modifier',
        label: 'ROS modifier',
        previousDisplay: '0%',
        currentDisplay: '25%',
        deltaPercentLabel: null,
        deltaDirection: null,
      },
    ]);
  });

  it('groups all same-date events from the newest detected date and orders them correctly', () => {
    const result = buildAdsOptimizerLastDetectedChangesForTargets({
      rows: [buildTargetRowRef()],
      bulkTargetRows: [
        { target_id: 'target-1', snapshot_date: '2026-03-21', bid: 1.25, state: 'paused' },
        { target_id: 'target-1', snapshot_date: '2026-03-20', bid: 1, state: 'enabled' },
      ],
      bulkCampaignRows: [
        {
          campaign_id: 'campaign-1',
          snapshot_date: '2026-03-21',
          bidding_strategy: 'dynamic down only',
        },
        {
          campaign_id: 'campaign-1',
          snapshot_date: '2026-03-20',
          bidding_strategy: 'fixed bids',
        },
      ],
      placementChangeLogRows: [
        {
          campaign_id: 'campaign-1',
          snapshot_date: '2026-03-21',
          placement_code: 'PLACEMENT_TOP',
          old_pct: 10,
          new_pct: 20,
        },
      ],
      bulkPlacementRows: [],
    });

    const change = getChange(result);

    expect(change.detectedDate).toBe('2026-03-21');
    expect(change.items.map((item) => item.label)).toEqual([
      'Bid',
      'State',
      'TOS modifier',
      'Strategy',
    ]);
    expect(change.overflowCount).toBe(2);
  });

  it('treats null-to-value and value-to-null transitions as changes', () => {
    const result = buildAdsOptimizerLastDetectedChangesForTargets({
      rows: [buildTargetRowRef()],
      bulkTargetRows: [
        { target_id: 'target-1', snapshot_date: '2026-03-20', bid: null, state: 'enabled' },
        { target_id: 'target-1', snapshot_date: '2026-03-19', bid: 1.2, state: 'enabled' },
      ],
      bulkCampaignRows: [
        {
          campaign_id: 'campaign-1',
          snapshot_date: '2026-03-20',
          bidding_strategy: 'fixed bids',
        },
        {
          campaign_id: 'campaign-1',
          snapshot_date: '2026-03-19',
          bidding_strategy: null,
        },
      ],
      placementChangeLogRows: [],
      bulkPlacementRows: [],
    });

    const change = getChange(result);

    expect(change.detectedDate).toBe('2026-03-20');
    expect(change.items).toEqual([
      {
        key: 'target_bid:target-1:2026-03-20',
        kind: 'target_bid',
        label: 'Bid',
        previousDisplay: '$1.20',
        currentDisplay: 'Not captured',
        deltaPercentLabel: null,
        deltaDirection: null,
      },
      {
        key: 'campaign_bidding_strategy:campaign-1:2026-03-20',
        kind: 'campaign_bidding_strategy',
        label: 'Strategy',
        previousDisplay: 'Not captured',
        currentDisplay: 'fixed bids',
        deltaPercentLabel: null,
        deltaDirection: null,
      },
    ]);
  });

  it('does not create false events when repeated snapshots are unchanged', () => {
    const result = buildAdsOptimizerLastDetectedChangesForTargets({
      rows: [buildTargetRowRef()],
      bulkTargetRows: [
        { target_id: 'target-1', snapshot_date: '2026-03-20', bid: 1.2, state: 'enabled' },
        { target_id: 'target-1', snapshot_date: '2026-03-19', bid: 1.2, state: 'enabled' },
        { target_id: 'target-1', snapshot_date: '2026-03-18', bid: 1.2, state: 'enabled' },
      ],
      bulkCampaignRows: [
        {
          campaign_id: 'campaign-1',
          snapshot_date: '2026-03-20',
          bidding_strategy: 'fixed bids',
        },
        {
          campaign_id: 'campaign-1',
          snapshot_date: '2026-03-19',
          bidding_strategy: 'fixed bids',
        },
      ],
      placementChangeLogRows: [],
      bulkPlacementRows: [
        {
          campaign_id: 'campaign-1',
          snapshot_date: '2026-03-20',
          placement_code: 'PLACEMENT_TOP',
          percentage: 10,
        },
        {
          campaign_id: 'campaign-1',
          snapshot_date: '2026-03-19',
          placement_code: 'PLACEMENT_TOP',
          percentage: 10,
        },
      ],
    });

    expect(getChange(result)).toEqual({
      detectedDate: null,
      items: [],
      overflowCount: 0,
      emptyMessage: 'No detected tracked change',
    });
  });
});
