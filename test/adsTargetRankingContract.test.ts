import { describe, expect, it } from 'vitest';

import { resolveTargetRankingContract } from '@/lib/ads/targetRankingContract';

describe('target ranking contract resolution', () => {
  it('supports positive keyword rows and prefers historical targeting_raw mapping first', () => {
    const result = resolveTargetRankingContract({
      scopeTrustworthy: true,
      historicalTargetingRaw: 'Blue Shoes Legacy',
      historicalTargetingNorm: 'blue shoes normalized',
      currentExpressionText: 'Blue Shoes Current',
      typeLabel: 'Keyword',
      matchType: 'EXACT',
      isNegative: false,
    });

    expect(result).toEqual({
      contract: 'keyword_query_context',
      supported: true,
      resolvedKeywordNorm: 'blue shoes legacy',
      reasonCode: null,
      mappingSource: 'historical_targeting_raw',
    });
  });

  it('falls back to current snapshot expression when historical mapping is absent', () => {
    const result = resolveTargetRankingContract({
      scopeTrustworthy: true,
      historicalTargetingRaw: null,
      historicalTargetingNorm: null,
      currentExpressionText: 'Blue Shoes Current',
      typeLabel: 'Keyword',
      matchType: 'BROAD',
      isNegative: false,
    });

    expect(result).toEqual({
      contract: 'keyword_query_context',
      supported: true,
      resolvedKeywordNorm: 'blue shoes current',
      reasonCode: null,
      mappingSource: 'current_expression',
    });
  });

  it('is unsupported when scope is not trustworthy', () => {
    const result = resolveTargetRankingContract({
      scopeTrustworthy: false,
      historicalTargetingRaw: 'Blue Shoes',
      typeLabel: 'Keyword',
      matchType: 'EXACT',
      isNegative: false,
    });

    expect(result).toEqual({
      contract: 'keyword_query_context',
      supported: false,
      resolvedKeywordNorm: null,
      reasonCode: 'scope_not_trustworthy',
      mappingSource: null,
    });
  });

  it('is unsupported for negative keywords', () => {
    const result = resolveTargetRankingContract({
      scopeTrustworthy: true,
      historicalTargetingRaw: 'Blue Shoes',
      typeLabel: 'Negative keyword',
      matchType: 'EXACT',
      isNegative: true,
    });

    expect(result).toEqual({
      contract: 'keyword_query_context',
      supported: false,
      resolvedKeywordNorm: null,
      reasonCode: 'negative_keyword',
      mappingSource: null,
    });
  });

  it('is unsupported for targeting-expression rows', () => {
    const result = resolveTargetRankingContract({
      scopeTrustworthy: true,
      historicalTargetingRaw: 'asin=\"B001TEST\"',
      typeLabel: 'Product targeting',
      matchType: 'TARGETING_EXPRESSION',
      isNegative: false,
    });

    expect(result).toEqual({
      contract: 'keyword_query_context',
      supported: false,
      resolvedKeywordNorm: null,
      reasonCode: 'keyword_only',
      mappingSource: null,
    });
  });

  it('is unsupported when no deterministic keyword mapping exists', () => {
    const result = resolveTargetRankingContract({
      scopeTrustworthy: true,
      historicalTargetingRaw: null,
      historicalTargetingNorm: null,
      currentExpressionText: '   ',
      typeLabel: 'Keyword',
      matchType: 'PHRASE',
      isNegative: false,
    });

    expect(result).toEqual({
      contract: 'keyword_query_context',
      supported: false,
      resolvedKeywordNorm: null,
      reasonCode: 'no_mapping',
      mappingSource: null,
    });
  });
});
