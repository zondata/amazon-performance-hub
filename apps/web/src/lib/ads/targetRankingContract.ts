const trimString = (value: string | null | undefined): string | null => {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeKeyword = (value: string | null | undefined): string | null => {
  const trimmed = trimString(value);
  return trimmed ? trimmed.toLowerCase().replace(/\s+/g, ' ') : null;
};

const normalizeTypeLabel = (value: string | null | undefined) => trimString(value)?.toLowerCase() ?? null;
const normalizeMatchType = (value: string | null | undefined) => trimString(value)?.toUpperCase() ?? null;

export type TargetRankingContract = 'keyword_query_context';
export type TargetRankingUnsupportedReasonCode =
  | 'scope_not_trustworthy'
  | 'negative_keyword'
  | 'keyword_only'
  | 'no_mapping';
export type TargetRankingMappingSource =
  | 'historical_targeting_raw'
  | 'historical_targeting_norm'
  | 'current_expression';

export type TargetRankingContractResolution =
  | {
      contract: TargetRankingContract;
      supported: true;
      resolvedKeywordNorm: string;
      reasonCode: null;
      mappingSource: TargetRankingMappingSource;
    }
  | {
      contract: TargetRankingContract;
      supported: false;
      resolvedKeywordNorm: null;
      reasonCode: TargetRankingUnsupportedReasonCode;
      mappingSource: null;
    };

export const resolveTargetRankingContract = (args: {
  scopeTrustworthy: boolean;
  historicalTargetingRaw?: string | null;
  historicalTargetingNorm?: string | null;
  currentExpressionText?: string | null;
  typeLabel?: string | null;
  matchType?: string | null;
  isNegative?: boolean | null;
}): TargetRankingContractResolution => {
  if (!args.scopeTrustworthy) {
    return {
      contract: 'keyword_query_context',
      supported: false,
      resolvedKeywordNorm: null,
      reasonCode: 'scope_not_trustworthy',
      mappingSource: null,
    };
  }

  const typeLabel = normalizeTypeLabel(args.typeLabel);
  const matchType = normalizeMatchType(args.matchType);
  if (
    args.isNegative === true ||
    typeLabel === 'negative keyword' ||
    typeLabel === 'negative product'
  ) {
    return {
      contract: 'keyword_query_context',
      supported: false,
      resolvedKeywordNorm: null,
      reasonCode: 'negative_keyword',
      mappingSource: null,
    };
  }

  if (
    matchType === 'TARGETING_EXPRESSION' ||
    (typeLabel !== null && typeLabel !== 'keyword')
  ) {
    return {
      contract: 'keyword_query_context',
      supported: false,
      resolvedKeywordNorm: null,
      reasonCode: 'keyword_only',
      mappingSource: null,
    };
  }

  const candidates: Array<{
    source: TargetRankingMappingSource;
    value: string | null | undefined;
  }> = [
    { source: 'historical_targeting_raw', value: args.historicalTargetingRaw },
    { source: 'historical_targeting_norm', value: args.historicalTargetingNorm },
    { source: 'current_expression', value: args.currentExpressionText },
  ];

  for (const candidate of candidates) {
    const resolvedKeywordNorm = normalizeKeyword(candidate.value);
    if (!resolvedKeywordNorm) continue;
    return {
      contract: 'keyword_query_context',
      supported: true,
      resolvedKeywordNorm,
      reasonCode: null,
      mappingSource: candidate.source,
    };
  }

  return {
    contract: 'keyword_query_context',
    supported: false,
    resolvedKeywordNorm: null,
    reasonCode: 'no_mapping',
    mappingSource: null,
  };
};
