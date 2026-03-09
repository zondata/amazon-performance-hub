import { describe, expect, it } from 'vitest';

import {
  buildCampaignTrendData,
  buildTargetTrendData,
  buildTrendMarkers,
} from '../apps/web/src/lib/ads/spWorkspaceTrendModel';

describe('spWorkspaceTrendModel', () => {
  it('falls back to placement units for campaign trend rows and keeps campaign diagnostics null-safe', () => {
    const { markers, markersByDate } = buildTrendMarkers([
      {
        change_id: 'chg-1',
        occurred_at: '2026-03-02T11:00:00Z',
        change_type: 'bulk_update_campaign',
        entity_type: 'campaign',
        summary: 'SP campaign update: campaign_id=c1 budget 25 -> 30',
        why: 'Protect spend ceiling',
        source: 'bulkgen',
        validation_status: 'validated',
        validated_snapshot_date: '2026-03-04',
        before_json: { daily_budget: 25 },
        after_json: { daily_budget: 30, run_id: 'run-1' },
      },
    ]);

    const trend = buildCampaignTrendData({
      entityCountLabel: 'Campaigns',
      entities: [{ id: 'c1', label: 'Campaign A', subtitle: 'Portfolio A', badge: null }],
      selectedEntityId: 'c1',
      selectedEntityLabel: 'Campaign A',
      start: '2026-03-01',
      end: '2026-03-02',
      campaignRows: [
        {
          date: '2026-03-01',
          campaign_id: 'c1',
          impressions: 100,
          clicks: 10,
          spend: 20,
          sales: 50,
          orders: 2,
          units: null,
        },
      ],
      placementUnitRows: [{ campaign_id: 'c1', date: '2026-03-01', units: 3 }],
      markers,
      markersByDate,
    });

    const unitsRow = trend.metricRows.find((row) => row.key === 'units');
    const stisRow = trend.metricRows.find((row) => row.key === 'stis');
    const stirRow = trend.metricRows.find((row) => row.key === 'stir');
    const tosIsRow = trend.metricRows.find((row) => row.key === 'tos_is');

    expect(unitsRow?.cells[0]?.value).toBe(3);
    expect(unitsRow?.cells[1]?.value).toBe(0);
    expect(stisRow?.cells[0]?.value).toBeNull();
    expect(stirRow?.cells[0]?.value).toBeNull();
    expect(tosIsRow?.cells[0]?.value).toBeNull();
    expect(trend.markersByDate['2026-03-02']).toEqual(['chg-1']);
    expect(trend.markers[0]?.fields).toEqual([
      {
        key: 'daily_budget',
        label: 'Daily Budget',
        before: '25',
        after: '30',
      },
    ]);
  });

  it('keeps campaign-row units when the trusted daily source already provides them', () => {
    const { markers, markersByDate } = buildTrendMarkers([]);

    const trend = buildCampaignTrendData({
      entityCountLabel: 'Campaigns',
      entities: [{ id: 'c1', label: 'Campaign A', subtitle: 'Portfolio A', badge: null }],
      selectedEntityId: 'c1',
      selectedEntityLabel: 'Campaign A',
      start: '2026-03-01',
      end: '2026-03-01',
      campaignRows: [
        {
          date: '2026-03-01',
          campaign_id: 'c1',
          impressions: 100,
          clicks: 10,
          spend: 20,
          sales: 50,
          orders: 2,
          units: 4,
        },
      ],
      placementUnitRows: [{ campaign_id: 'c1', date: '2026-03-01', units: 9 }],
      markers,
      markersByDate,
    });

    expect(trend.metricRows.find((row) => row.key === 'units')?.cells[0]?.value).toBe(4);
  });

  it('uses the same representative child for target trend STIS/STIR and keeps TOS IS on targeting rows', () => {
    const { markers, markersByDate } = buildTrendMarkers([]);

    const trend = buildTargetTrendData({
      entityCountLabel: 'Targets',
      entities: [{ id: 't1', label: 'blue shoes', subtitle: 'Campaign A · Exact', badge: null }],
      selectedEntityId: 't1',
      selectedEntityLabel: 'blue shoes',
      start: '2026-03-01',
      end: '2026-03-01',
      targetRows: [
        {
          date: '2026-03-01',
          target_id: 't1',
          impressions: 80,
          clicks: 8,
          spend: 16,
          sales: 40,
          orders: 2,
          units: 2,
          top_of_search_impression_share: 0.22,
          exported_at: '2026-03-02T00:00:00Z',
        },
      ],
      stirRows: [
        {
          date: '2026-03-01',
          target_id: 't1',
          targeting_norm: 'blue shoes',
          customer_search_term_raw: 'blue shoes',
          customer_search_term_norm: 'blue shoes',
          search_term_impression_share: 0.33,
          search_term_impression_rank: 4,
          impressions: 25,
          clicks: 3,
          spend: 7,
          exported_at: '2026-03-02T00:00:00Z',
        },
        {
          date: '2026-03-01',
          target_id: 't1',
          targeting_norm: 'blue shoes',
          customer_search_term_raw: 'buy blue shoes',
          customer_search_term_norm: 'buy blue shoes',
          search_term_impression_share: 0.61,
          search_term_impression_rank: 1,
          impressions: 40,
          clicks: 4,
          spend: 9,
          exported_at: '2026-03-02T00:00:00Z',
        },
      ],
      markers,
      markersByDate,
    });

    expect(trend.metricRows.find((row) => row.key === 'stis')?.cells[0]?.value).toBeCloseTo(0.33, 6);
    expect(trend.metricRows.find((row) => row.key === 'stir')?.cells[0]?.value).toBe(4);
    expect(trend.metricRows.find((row) => row.key === 'tos_is')?.cells[0]?.value).toBeCloseTo(0.22, 6);
    expect(trend.metricRows.find((row) => row.key === 'stis')?.support_note).toMatch(
      /search-term impression-share coverage/i
    );
    expect(trend.metricRows.find((row) => row.key === 'stir')?.support_note).toMatch(
      /same representative child/i
    );
    expect(trend.metricRows.find((row) => row.key === 'tos_is')?.support_note).toMatch(
      /target targeting-report coverage/i
    );
  });

  it('uses impressions, clicks, spend, and recency to pick one non-same-text target trend diagnostic child', () => {
    const { markers, markersByDate } = buildTrendMarkers([]);

    const trend = buildTargetTrendData({
      entityCountLabel: 'Targets',
      entities: [{ id: 't2', label: 'brown boots', subtitle: 'Campaign B · Phrase', badge: null }],
      selectedEntityId: 't2',
      selectedEntityLabel: 'brown boots',
      start: '2026-03-02',
      end: '2026-03-02',
      targetRows: [
        {
          date: '2026-03-02',
          target_id: 't2',
          impressions: 120,
          clicks: 12,
          spend: 24,
          sales: 72,
          orders: 3,
          units: 3,
          top_of_search_impression_share: 0.18,
          exported_at: '2026-03-03T00:00:00Z',
        },
      ],
      stirRows: [
        {
          date: '2026-03-02',
          target_id: 't2',
          targeting_norm: 'brown boots',
          customer_search_term_raw: 'winter boots',
          customer_search_term_norm: 'winter boots',
          search_term_impression_share: 0.27,
          search_term_impression_rank: 8,
          impressions: 50,
          clicks: 6,
          spend: 12,
          exported_at: '2026-03-03T00:00:00Z',
        },
        {
          date: '2026-03-02',
          target_id: 't2',
          targeting_norm: 'brown boots',
          customer_search_term_raw: 'boots for winter',
          customer_search_term_norm: 'boots for winter',
          search_term_impression_share: 0.19,
          search_term_impression_rank: 5,
          impressions: 50,
          clicks: 6,
          spend: 12,
          exported_at: '2026-03-04T00:00:00Z',
        },
      ],
      markers,
      markersByDate,
    });

    expect(trend.metricRows.find((row) => row.key === 'stis')?.cells[0]?.value).toBeCloseTo(0.19, 6);
    expect(trend.metricRows.find((row) => row.key === 'stir')?.cells[0]?.value).toBe(5);
    expect(trend.metricRows.find((row) => row.key === 'tos_is')?.cells[0]?.value).toBeCloseTo(0.18, 6);
  });

  it('renders Organic Rank and Sponsored Rank as separate target trend rows', () => {
    const { markers, markersByDate } = buildTrendMarkers([]);

    const trend = buildTargetTrendData({
      entityCountLabel: 'Targets',
      entities: [{ id: 't1', label: 'blue shoes', subtitle: 'Campaign A · Exact', badge: null }],
      selectedEntityId: 't1',
      selectedEntityLabel: 'blue shoes',
      start: '2026-03-01',
      end: '2026-03-02',
      targetRows: [
        {
          date: '2026-03-01',
          target_id: 't1',
          impressions: 80,
          clicks: 8,
          spend: 16,
          sales: 40,
          orders: 2,
          units: 2,
          top_of_search_impression_share: 0.22,
          exported_at: '2026-03-02T00:00:00Z',
        },
      ],
      stirRows: [],
      rankRows: [
        {
          observed_date: '2026-03-01',
          organic_rank_value: 6,
          sponsored_pos_value: 2,
        },
        {
          observed_date: '2026-03-02',
          organic_rank_value: 4,
          sponsored_pos_value: 1,
        },
      ],
      rankSupportNote:
        'Rank is contextual to the selected ASIN and exact keyword coverage. It is not a target-owned performance fact.',
      markers,
      markersByDate,
    });

    const organicRankRow = trend.metricRows.find((row) => row.key === 'organic_rank');
    const sponsoredRankRow = trend.metricRows.find((row) => row.key === 'sponsored_rank');

    expect(organicRankRow?.label).toBe('Organic Rank');
    expect(organicRankRow?.cells.map((cell) => cell.value)).toEqual([6, 4]);
    expect(sponsoredRankRow?.label).toBe('Sponsored Rank');
    expect(sponsoredRankRow?.cells.map((cell) => cell.value)).toEqual([2, 1]);
  });

  it('keeps rank trend rows null-safe when rank coverage is unavailable', () => {
    const { markers, markersByDate } = buildTrendMarkers([]);

    const trend = buildTargetTrendData({
      entityCountLabel: 'Targets',
      entities: [{ id: 't1', label: 'blue shoes', subtitle: 'Campaign A · Exact', badge: null }],
      selectedEntityId: 't1',
      selectedEntityLabel: 'blue shoes',
      start: '2026-03-01',
      end: '2026-03-01',
      targetRows: [
        {
          date: '2026-03-01',
          target_id: 't1',
          impressions: 80,
          clicks: 8,
          spend: 16,
          sales: 40,
          orders: 2,
          units: 2,
          top_of_search_impression_share: 0.22,
          exported_at: '2026-03-02T00:00:00Z',
        },
      ],
      stirRows: [],
      rankRows: [],
      rankSupportNote: 'Rank stays null-safe here until a single ASIN is selected.',
      markers,
      markersByDate,
    });

    expect(trend.metricRows.find((row) => row.key === 'organic_rank')?.cells[0]?.value).toBeNull();
    expect(trend.metricRows.find((row) => row.key === 'sponsored_rank')?.cells[0]?.value).toBeNull();
    expect(trend.metricRows.find((row) => row.key === 'organic_rank')?.support_note).toMatch(
      /single ASIN/i
    );
    expect(trend.metricRows.find((row) => row.key === 'sponsored_rank')?.support_note).toMatch(
      /single ASIN/i
    );
  });
});
