import { describe, expect, it } from 'vitest';

import {
  buildAdsOptimizerOutcomeReviewWindowSummaries,
  filterAdsOptimizerOutcomeReviewSegments,
  getAdsOptimizerOutcomeReviewSegmentFilterKey,
  scoreAdsOptimizerOutcomeReview,
} from '../apps/web/src/lib/ads-optimizer/outcomeReviewScoring';
import type { AdsOptimizerOutcomeReviewSegmentSummary, AdsOptimizerOutcomeReviewTrendPoint } from '../apps/web/src/lib/ads-optimizer/outcomeReviewTypes';

const makePoint = (
  date: string,
  values: Partial<AdsOptimizerOutcomeReviewTrendPoint> = {}
): AdsOptimizerOutcomeReviewTrendPoint => ({
  date,
  contribution_after_ads: values.contribution_after_ads ?? 0,
  tacos: values.tacos ?? 0.2,
  ad_spend: values.ad_spend ?? 100,
  ad_sales: values.ad_sales ?? 300,
  total_sales: values.total_sales ?? 600,
  orders: values.orders ?? 10,
});

describe('ads optimizer outcome review scoring', () => {
  it('caps the post window before the next validated phase and keeps latest on the selected end date', () => {
    const trendPoints = [
      makePoint('2026-03-03'),
      makePoint('2026-03-04'),
      makePoint('2026-03-05'),
      makePoint('2026-03-06'),
      makePoint('2026-03-07'),
      makePoint('2026-03-08'),
      makePoint('2026-03-09'),
      makePoint('2026-03-10'),
      makePoint('2026-03-11'),
      makePoint('2026-03-12'),
      makePoint('2026-03-13'),
      makePoint('2026-03-14'),
      makePoint('2026-03-15'),
      makePoint('2026-03-16'),
      makePoint('2026-03-17'),
      makePoint('2026-03-18'),
    ];

    const result = buildAdsOptimizerOutcomeReviewWindowSummaries({
      trendPoints,
      validatedEffectiveDate: '2026-03-10',
      horizon: '7',
      selectedEndDate: '2026-03-18',
      nextPhaseValidatedEffectiveDate: '2026-03-13',
    });

    expect(result.postWindowCappedByNextPhase).toBe(true);
    expect(result.windows).toMatchObject([
      {
        key: 'before',
        startDate: '2026-03-03',
        endDate: '2026-03-09',
        observedDays: 7,
      },
      {
        key: 'after',
        startDate: '2026-03-10',
        endDate: '2026-03-12',
        observedDays: 3,
      },
      {
        key: 'latest',
        startDate: '2026-03-12',
        endDate: '2026-03-18',
        observedDays: 7,
      },
    ]);
  });

  it('classifies a validated break-even phase as a confirmed win when economics improve strongly', () => {
    const result = scoreAdsOptimizerOutcomeReview({
      objective: 'Break Even',
      phaseStatus: 'validated',
      horizon: '7',
      visibilitySignal: {
        available: false,
        keyword: null,
        beforeRank: null,
        afterRank: null,
        latestRank: null,
        detail: 'No comparable visibility signal.',
      },
      windows: [
        {
          key: 'before',
          label: 'Before',
          startDate: '2026-03-01',
          endDate: '2026-03-07',
          expectedDays: 7,
          observedDays: 7,
          hasData: true,
          metrics: {
            contribution_after_ads: -280,
            tacos: 0.34,
            ad_spend: 700,
            ad_sales: 1200,
            total_sales: 2200,
            orders: 21,
          },
        },
        {
          key: 'after',
          label: 'After',
          startDate: '2026-03-08',
          endDate: '2026-03-14',
          expectedDays: 7,
          observedDays: 7,
          hasData: true,
          metrics: {
            contribution_after_ads: 140,
            tacos: 0.18,
            ad_spend: 420,
            ad_sales: 1350,
            total_sales: 2350,
            orders: 24,
          },
        },
        {
          key: 'latest',
          label: 'Latest',
          startDate: '2026-03-12',
          endDate: '2026-03-18',
          expectedDays: 7,
          observedDays: 7,
          hasData: true,
          metrics: {
            contribution_after_ads: 180,
            tacos: 0.16,
            ad_spend: 390,
            ad_sales: 1400,
            total_sales: 2450,
            orders: 25,
          },
        },
      ],
    });

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.label).toBe('confirmed_win');
    expect(result.confidence).toBe('high');
  });

  it('lowers confidence for rank-defense scoring when comparable rank data is missing', () => {
    const result = scoreAdsOptimizerOutcomeReview({
      objective: 'Rank Defense',
      phaseStatus: 'validated',
      horizon: '7',
      visibilitySignal: {
        available: false,
        keyword: null,
        beforeRank: null,
        afterRank: null,
        latestRank: null,
        detail: 'Hero-query ranking was not comparable across windows.',
      },
      windows: [
        {
          key: 'before',
          label: 'Before',
          startDate: '2026-03-01',
          endDate: '2026-03-07',
          expectedDays: 7,
          observedDays: 7,
          hasData: true,
          metrics: {
            contribution_after_ads: 50,
            tacos: 0.18,
            ad_spend: 300,
            ad_sales: 900,
            total_sales: 1700,
            orders: 18,
          },
        },
        {
          key: 'after',
          label: 'After',
          startDate: '2026-03-08',
          endDate: '2026-03-14',
          expectedDays: 7,
          observedDays: 7,
          hasData: true,
          metrics: {
            contribution_after_ads: 120,
            tacos: 0.14,
            ad_spend: 260,
            ad_sales: 980,
            total_sales: 1820,
            orders: 19,
          },
        },
        {
          key: 'latest',
          label: 'Latest',
          startDate: '2026-03-12',
          endDate: '2026-03-18',
          expectedDays: 7,
          observedDays: 7,
          hasData: true,
          metrics: {
            contribution_after_ads: 135,
            tacos: 0.13,
            ad_spend: 250,
            ad_sales: 1010,
            total_sales: 1860,
            orders: 20,
          },
        },
      ],
    });

    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.confidence).toBe('low');
    expect(result.label).not.toBe('confirmed_win');
    expect(result.evidenceNotes.join(' ')).toMatch(/visibility data/i);
  });

  it('returns too_early when validation is incomplete or the post window is still thin', () => {
    const result = scoreAdsOptimizerOutcomeReview({
      objective: 'Harvest Profit',
      phaseStatus: 'partial',
      horizon: '14',
      visibilitySignal: {
        available: true,
        keyword: 'hero keyword',
        beforeRank: 12,
        afterRank: 10,
        latestRank: 9,
        detail: 'Comparable hero-query rank data exists.',
      },
      windows: [
        {
          key: 'before',
          label: 'Before',
          startDate: '2026-03-01',
          endDate: '2026-03-14',
          expectedDays: 14,
          observedDays: 14,
          hasData: true,
          metrics: {
            contribution_after_ads: 180,
            tacos: 0.14,
            ad_spend: 420,
            ad_sales: 1500,
            total_sales: 2800,
            orders: 26,
          },
        },
        {
          key: 'after',
          label: 'After',
          startDate: '2026-03-15',
          endDate: '2026-03-18',
          expectedDays: 14,
          observedDays: 4,
          hasData: true,
          metrics: {
            contribution_after_ads: 210,
            tacos: 0.13,
            ad_spend: 140,
            ad_sales: 520,
            total_sales: 980,
            orders: 10,
          },
        },
        {
          key: 'latest',
          label: 'Latest',
          startDate: '2026-03-05',
          endDate: '2026-03-18',
          expectedDays: 14,
          observedDays: 14,
          hasData: true,
          metrics: {
            contribution_after_ads: 220,
            tacos: 0.12,
            ad_spend: 410,
            ad_sales: 1560,
            total_sales: 2920,
            orders: 28,
          },
        },
      ],
    });

    expect(result.label).toBe('too_early');
    expect(result.confidence).toBe('low');
    expect(result.evidenceNotes.join(' ')).toMatch(/validation is incomplete/i);
    expect(result.evidenceNotes.join(' ')).toMatch(/thin/i);
  });

  it('maps too-early and incomplete segments into the pending filter bucket', () => {
    expect(
      getAdsOptimizerOutcomeReviewSegmentFilterKey({
        scoreLabel: 'too_early',
        phaseStatus: 'validated',
      })
    ).toBe('pending');
    expect(
      getAdsOptimizerOutcomeReviewSegmentFilterKey({
        scoreLabel: 'mixed',
        phaseStatus: 'partial',
      })
    ).toBe('pending');
    expect(
      getAdsOptimizerOutcomeReviewSegmentFilterKey({
        scoreLabel: 'confirmed_loss',
        phaseStatus: 'validated',
      })
    ).toBe('confirmed_loss');
  });

  it('filters segment rows by the selected segment score bucket', () => {
    const segments = [
      { segmentId: 'segment:1', filterKey: 'confirmed_win' },
      { segmentId: 'segment:2', filterKey: 'pending' },
      { segmentId: 'segment:3', filterKey: 'mixed' },
    ] as AdsOptimizerOutcomeReviewSegmentSummary[];

    expect(filterAdsOptimizerOutcomeReviewSegments(segments, 'all')).toHaveLength(3);
    expect(filterAdsOptimizerOutcomeReviewSegments(segments, 'pending').map((segment) => segment.segmentId)).toEqual([
      'segment:2',
    ]);
    expect(filterAdsOptimizerOutcomeReviewSegments(segments, 'confirmed_win').map((segment) => segment.segmentId)).toEqual([
      'segment:1',
    ]);
  });
});
