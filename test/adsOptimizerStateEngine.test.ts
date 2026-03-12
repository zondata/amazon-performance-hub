import { describe, expect, it } from 'vitest';

import {
  classifyAdsOptimizerTargetState,
  deriveAdsOptimizerProductRunState,
  resolveAdsOptimizerStateEngineConfig,
} from '../apps/web/src/lib/ads-optimizer/state';

describe('ads optimizer phase 6 state engine', () => {
  it('derives deterministic product run state from the phase 3 overview output', () => {
    const result = deriveAdsOptimizerProductRunState({
      product: {
        asin: 'B001TEST',
        title: 'Test product',
        shortName: 'Test',
        displayName: 'Test product',
      },
      economics: {
        sales: 1800,
        orders: 30,
        units: 32,
        adSpend: 420,
        adSales: 950,
        tacos: 0.23,
        averagePrice: 56.25,
        costCoverage: 0.62,
        breakEvenAcos: 0.34,
        contributionBeforeAdsPerUnit: 18,
        contributionAfterAds: 226,
      },
      visibility: {
        rankingCoverage: {
          status: 'ready',
          trackedKeywords: 5,
          detail: 'ready',
        },
        heroQueryTrend: {
          status: 'ready',
          keyword: 'blue widget',
          searchVolume: 2200,
          latestOrganicRank: 9,
          baselineOrganicRank: 13,
          rankDelta: 4,
          detail: 'ready',
        },
        sqpCoverage: {
          status: 'ready',
          selectedWeekEnd: '2026-03-08',
          trackedQueries: 4,
          totalSearchVolume: 4200,
          topQuery: 'blue widget',
          detail: 'ready',
        },
      },
      state: {
        value: 'profitable',
        label: 'Profitable',
        reason: 'Economics buffer is positive.',
      },
      objective: {
        value: 'Scale Profit',
        reason: 'Scale the profitable base.',
      },
      warnings: [],
    });

    expect(result.value).toBe('profitable');
    expect(result.coverageStatus).toBe('ready');
    expect(result.reasonCodes).toContain('PRODUCT_STATE_PROFITABLE');
  });

  it('classifies targets into deterministic efficiency, confidence, and tier states', () => {
    const input = {
      raw: {
        impressions: 80,
        clicks: 28,
        spend: 46,
        orders: 3,
        sales: 220,
        cpc: 1.64,
        ctr: 0.35,
        cvr: 0.11,
        acos: 0.21,
        roas: 4.8,
        tosIs: 0.31,
        stis: 0.22,
        stir: 7,
      },
      derived: {
        contributionAfterAds: 28,
        breakEvenGap: 0.09,
        maxCpcSupportGap: 0.45,
        lossDollars: null,
        profitDollars: 28,
        clickVelocity: 5.6,
        impressionVelocity: 16,
        organicLeverageProxy: 0.041,
        organicContextSignal: 'search_term_visibility_context',
      },
      coverage: {
        daysObserved: 5,
        statuses: {
          tosIs: 'ready' as const,
          stis: 'ready' as const,
          stir: 'ready' as const,
          placementContext: 'ready' as const,
          searchTerms: 'ready' as const,
          breakEvenInputs: 'ready' as const,
        },
        notes: [],
      },
      demandProxies: {
        searchTermCount: 4,
        sameTextSearchTermCount: 2,
        totalSearchTermImpressions: 140,
        totalSearchTermClicks: 24,
        representativeClickShare: 0.61,
      },
      asinScopeMembership: {
        productAdSpend: 90,
        productAdSales: 360,
        productOrders: 10,
        productUnits: 10,
      },
      productContext: {
        breakEvenAcos: 0.3,
        averagePrice: 56.25,
        productState: 'profitable',
        productObjective: 'Scale Profit',
      },
    };

    const first = classifyAdsOptimizerTargetState(input, {
      schema_version: 1,
      channel: 'sp',
      role_templates: {},
      guardrail_templates: {},
      scoring_weights: {
        importance: 1,
      },
      state_engine: {},
      action_policy: {},
    });
    const second = classifyAdsOptimizerTargetState(input, {
      schema_version: 1,
      channel: 'sp',
      role_templates: {},
      guardrail_templates: {},
      scoring_weights: {
        importance: 1,
      },
      state_engine: {},
      action_policy: {},
    });

    expect(first).toEqual(second);
    expect(first.efficiency.value).toBe('profitable');
    expect(first.confidence.value).toBe('confirmed');
    expect(first.importance.value).toBe('tier_1_dominant');
    expect(first.opportunityScore).toBeGreaterThan(first.riskScore);
  });

  it('does not let the old organic-leverage proxy change default V1 opportunity math', () => {
    const baseInput = {
      raw: {
        impressions: 80,
        clicks: 28,
        spend: 46,
        orders: 3,
        sales: 220,
        cpc: 1.64,
        ctr: 0.35,
        cvr: 0.11,
        acos: 0.21,
        roas: 4.8,
        tosIs: 0.31,
        stis: 0.22,
        stir: 7,
      },
      derived: {
        contributionAfterAds: 28,
        breakEvenGap: 0.09,
        maxCpcSupportGap: 0.45,
        lossDollars: null,
        profitDollars: 28,
        clickVelocity: 5.6,
        impressionVelocity: 16,
        organicLeverageProxy: 0.01,
        organicContextSignal: 'same_text_visibility_context',
      },
      coverage: {
        daysObserved: 5,
        statuses: {
          tosIs: 'ready' as const,
          stis: 'ready' as const,
          stir: 'ready' as const,
          placementContext: 'ready' as const,
          searchTerms: 'ready' as const,
          breakEvenInputs: 'ready' as const,
        },
        notes: [],
      },
      demandProxies: {
        searchTermCount: 4,
        sameTextSearchTermCount: 2,
        totalSearchTermImpressions: 140,
        totalSearchTermClicks: 24,
        representativeClickShare: 0.61,
      },
      asinScopeMembership: {
        productAdSpend: 90,
        productAdSales: 360,
        productOrders: 10,
        productUnits: 10,
      },
      productContext: {
        breakEvenAcos: 0.3,
        averagePrice: 56.25,
        productState: 'profitable',
        productObjective: 'Scale Profit',
      },
    };

    const lowProxy = classifyAdsOptimizerTargetState(baseInput, null);
    const highProxy = classifyAdsOptimizerTargetState(
      {
        ...baseInput,
        derived: {
          ...baseInput.derived,
          organicLeverageProxy: 99,
        },
      },
      null
    );

    expect(highProxy.opportunityScore).toBe(lowProxy.opportunityScore);
    expect(highProxy.summaryReasonCodes).toContain('OPPORTUNITY_ORGANIC_CONTEXT_ONLY');
  });

  it('supports configurable tier thresholds through the rule-pack state-engine payload', () => {
    const config = resolveAdsOptimizerStateEngineConfig({
      schema_version: 1,
      channel: 'sp',
      role_templates: {},
      guardrail_templates: {},
      scoring_weights: {
        importance: 1,
      },
      state_engine: {
        thresholds: {
          dominant_importance_score: 95,
          core_importance_score: 65,
          dominant_spend_share: 0.6,
          core_spend_share: 0.25,
        },
      },
      action_policy: {},
    });

    expect(config.dominantImportanceScore).toBe(95);
    expect(config.coreImportanceScore).toBe(65);
    expect(config.dominantSpendShare).toBe(0.6);
    expect(config.coreSpendShare).toBe(0.25);
  });

  it('treats high ASIN-scope sales contribution as material even when spend share is lighter', () => {
    const result = classifyAdsOptimizerTargetState(
      {
        raw: {
          impressions: 40,
          clicks: 10,
          spend: 14,
          orders: 2,
          sales: 120,
          cpc: 1.4,
          ctr: 0.25,
          cvr: 0.2,
          acos: 0.12,
          roas: 8.57,
          tosIs: null,
          stis: null,
          stir: null,
        },
        derived: {
          contributionAfterAds: 18,
          breakEvenGap: 0.08,
          maxCpcSupportGap: 0.35,
          lossDollars: null,
          profitDollars: 18,
          clickVelocity: 1.4,
          impressionVelocity: 5.7,
          organicLeverageProxy: null,
          organicContextSignal: null,
          adSalesShare: 0.36,
          adOrderShare: 0.36,
          totalSalesShare: 0.09,
          lossToAdSalesRatio: null,
          lossSeverity: null,
          protectedContributor: true,
        },
        coverage: {
          daysObserved: 7,
          statuses: {
            tosIs: 'partial',
            stis: 'partial',
            stir: 'partial',
            placementContext: 'ready',
            searchTerms: 'ready',
            breakEvenInputs: 'ready',
          },
          notes: [],
        },
        demandProxies: {
          searchTermCount: 2,
          sameTextSearchTermCount: 1,
          totalSearchTermImpressions: 30,
          totalSearchTermClicks: 9,
          representativeClickShare: 0.4,
        },
        asinScopeMembership: {
          productAdSpend: 100,
          productAdSales: 375,
          productOrders: 6,
          productUnits: 6,
        },
        productContext: {
          breakEvenAcos: 0.2,
          averagePrice: 60,
          productState: 'profitable',
          productObjective: 'Scale Profit',
        },
      },
      null
    );

    expect(result.importance.value).toBe('tier_1_dominant');
    expect(result.importance.reasonCodes).toContain('IMPORTANCE_DOMINANT_AD_SALES_SHARE');
    expect(result.protection.protectedContributor).toBe(true);
    expect(result.protection.reasonCodes).toContain('PROTECTION_AD_SALES_SHARE_PROTECTED');
  });
});
