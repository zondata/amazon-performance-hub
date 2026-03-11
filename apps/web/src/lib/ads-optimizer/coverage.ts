export type AdsOptimizerTargetCoverageStatus =
  | 'ready'
  | 'partial'
  | 'expected_unavailable'
  | 'true_missing';

export type AdsOptimizerTargetCoverageStoredStatus =
  | AdsOptimizerTargetCoverageStatus
  | 'missing';

export type AdsOptimizerCoverageRollupStatus = 'ready' | 'partial' | 'missing';

export type AdsOptimizerCoverageSummaryItem = {
  label: string;
  status: AdsOptimizerTargetCoverageStoredStatus | null | undefined;
};

export type AdsOptimizerCoverageSummary = {
  ready: number;
  partial: number;
  missing: number;
  missingExpected: number;
  missingSuspicious: number;
  buckets: {
    ready: string[];
    partial: string[];
    expectedUnavailable: string[];
    trueMissing: string[];
  };
};

export const normalizeAdsOptimizerCoverageStatus = (
  value: AdsOptimizerTargetCoverageStoredStatus | null | undefined
): AdsOptimizerTargetCoverageStatus => {
  if (
    value === 'ready' ||
    value === 'partial' ||
    value === 'expected_unavailable' ||
    value === 'true_missing'
  ) {
    return value;
  }
  return 'true_missing';
};

export const rollupAdsOptimizerCoverageStatus = (
  statuses: AdsOptimizerTargetCoverageStoredStatus[]
): AdsOptimizerCoverageRollupStatus => {
  const normalized = statuses.map((status) => normalizeAdsOptimizerCoverageStatus(status));
  if (normalized.some((status) => status === 'true_missing')) return 'missing';
  if (
    normalized.some(
      (status) => status === 'partial' || status === 'expected_unavailable'
    )
  ) {
    return 'partial';
  }
  return 'ready';
};

export const buildAdsOptimizerCoverageSummary = (
  items: readonly AdsOptimizerCoverageSummaryItem[]
): AdsOptimizerCoverageSummary => {
  const summary: AdsOptimizerCoverageSummary = {
    ready: 0,
    partial: 0,
    missing: 0,
    missingExpected: 0,
    missingSuspicious: 0,
    buckets: {
      ready: [],
      partial: [],
      expectedUnavailable: [],
      trueMissing: [],
    },
  };

  items.forEach((item) => {
    const status = normalizeAdsOptimizerCoverageStatus(item.status);
    if (status === 'ready') {
      summary.ready += 1;
      summary.buckets.ready.push(item.label);
      return;
    }
    if (status === 'partial') {
      summary.partial += 1;
      summary.buckets.partial.push(item.label);
      return;
    }
    summary.missing += 1;
    if (status === 'expected_unavailable') {
      summary.missingExpected += 1;
      summary.buckets.expectedUnavailable.push(item.label);
      return;
    }
    summary.missingSuspicious += 1;
    summary.buckets.trueMissing.push(item.label);
  });

  return summary;
};
