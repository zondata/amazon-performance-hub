import {
  ADS_OPTIMIZER_OUTCOME_REVIEW_HORIZONS,
  ADS_OPTIMIZER_OUTCOME_REVIEW_METRICS,
  type AdsOptimizerOutcomeReviewHorizon,
  type AdsOptimizerOutcomeReviewMetric,
} from './outcomeReviewTypes';

export const ADS_OPTIMIZER_VIEWS = [
  { label: 'Overview', value: 'overview' },
  { label: 'Targets', value: 'targets' },
  { label: 'Outcome Review', value: 'outcomes' },
  { label: 'Config', value: 'config' },
  { label: 'History', value: 'history' },
] as const;

export type AdsOptimizerView = (typeof ADS_OPTIMIZER_VIEWS)[number]['value'];

export const normalizeAdsOptimizerView = (value?: string): AdsOptimizerView => {
  const normalized = value?.trim().toLowerCase();
  return ADS_OPTIMIZER_VIEWS.some((item) => item.value === normalized)
    ? (normalized as AdsOptimizerView)
    : 'overview';
};

export const normalizeAdsOptimizerOutcomeHorizon = (
  value?: string
): AdsOptimizerOutcomeReviewHorizon => {
  const normalized = value?.trim();
  return ADS_OPTIMIZER_OUTCOME_REVIEW_HORIZONS.includes(
    normalized as AdsOptimizerOutcomeReviewHorizon
  )
    ? (normalized as AdsOptimizerOutcomeReviewHorizon)
    : '7';
};

export const normalizeAdsOptimizerOutcomeMetric = (
  value?: string
): AdsOptimizerOutcomeReviewMetric => {
  const normalized = value?.trim().toLowerCase();
  return ADS_OPTIMIZER_OUTCOME_REVIEW_METRICS.includes(
    normalized as AdsOptimizerOutcomeReviewMetric
  )
    ? (normalized as AdsOptimizerOutcomeReviewMetric)
    : 'contribution_after_ads';
};

export const buildAdsOptimizerHref = (params: {
  start: string;
  end: string;
  asin: string;
  view: AdsOptimizerView;
  runId?: string | null;
  horizon?: AdsOptimizerOutcomeReviewHorizon | null;
  metric?: AdsOptimizerOutcomeReviewMetric | null;
}) => {
  const usp = new URLSearchParams({
    start: params.start,
    end: params.end,
    asin: params.asin,
    view: params.view,
  });
  if (params.runId && params.runId.trim().length > 0) {
    usp.set('runId', params.runId.trim());
  }
  if (params.horizon) {
    usp.set('horizon', params.horizon);
  }
  if (params.metric) {
    usp.set('metric', params.metric);
  }
  return `/ads/optimizer?${usp.toString()}`;
};
