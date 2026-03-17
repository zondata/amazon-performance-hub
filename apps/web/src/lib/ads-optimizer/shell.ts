import {
  ADS_OPTIMIZER_OUTCOME_REVIEW_HORIZONS,
  ADS_OPTIMIZER_OUTCOME_REVIEW_METRICS,
  type AdsOptimizerOutcomeReviewHorizon,
  type AdsOptimizerOutcomeReviewMetric,
} from './outcomeReviewTypes';

export const ADS_OPTIMIZER_VIEWS = [
  { label: 'Overview', value: 'overview' },
  { label: 'Targets', value: 'targets' },
] as const;

export type AdsOptimizerView = (typeof ADS_OPTIMIZER_VIEWS)[number]['value'];

export const ADS_OPTIMIZER_UTILITIES = [
  { label: 'Outcome Review', value: 'outcomes', parentView: 'overview' },
  { label: 'Config', value: 'config', parentView: 'overview' },
  { label: 'History', value: 'history', parentView: 'targets' },
] as const;

export type AdsOptimizerUtility = (typeof ADS_OPTIMIZER_UTILITIES)[number]['value'];
export type AdsOptimizerLegacyView = AdsOptimizerView | AdsOptimizerUtility;

type AdsOptimizerShellState = {
  view: AdsOptimizerView;
  utility: AdsOptimizerUtility | null;
};

const LEGACY_VIEW_TO_SHELL: Record<AdsOptimizerLegacyView, AdsOptimizerShellState> = {
  overview: { view: 'overview', utility: null },
  targets: { view: 'targets', utility: null },
  outcomes: { view: 'overview', utility: 'outcomes' },
  config: { view: 'overview', utility: 'config' },
  history: { view: 'targets', utility: 'history' },
};

const UTILITY_PARENT_VIEW: Record<AdsOptimizerUtility, AdsOptimizerView> =
  ADS_OPTIMIZER_UTILITIES.reduce(
    (acc, item) => {
      acc[item.value] = item.parentView;
      return acc;
    },
    {} as Record<AdsOptimizerUtility, AdsOptimizerView>
  );

export const normalizeAdsOptimizerView = (value?: string): AdsOptimizerView => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return 'overview';
  return LEGACY_VIEW_TO_SHELL[normalized as AdsOptimizerLegacyView]?.view ?? 'overview';
};

export const normalizeAdsOptimizerUtility = (
  value?: string
): AdsOptimizerUtility | null => {
  const normalized = value?.trim().toLowerCase();
  return ADS_OPTIMIZER_UTILITIES.some((item) => item.value === normalized)
    ? (normalized as AdsOptimizerUtility)
    : null;
};

export const normalizeAdsOptimizerShell = (args: {
  view?: string;
  utility?: string;
}): AdsOptimizerShellState => {
  const normalizedUtility = normalizeAdsOptimizerUtility(args.utility);
  if (normalizedUtility) {
    return {
      view: UTILITY_PARENT_VIEW[normalizedUtility],
      utility: normalizedUtility,
    };
  }

  const normalizedView = args.view?.trim().toLowerCase();
  return normalizedView && normalizedView in LEGACY_VIEW_TO_SHELL
    ? LEGACY_VIEW_TO_SHELL[normalizedView as AdsOptimizerLegacyView]
    : LEGACY_VIEW_TO_SHELL.overview;
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
  view: AdsOptimizerLegacyView;
  utility?: AdsOptimizerUtility | null;
  runId?: string | null;
  horizon?: AdsOptimizerOutcomeReviewHorizon | null;
  metric?: AdsOptimizerOutcomeReviewMetric | null;
}) => {
  const shell = normalizeAdsOptimizerShell({
    view: params.view,
    utility: params.utility ?? undefined,
  });
  const usp = new URLSearchParams({
    start: params.start,
    end: params.end,
    asin: params.asin,
    view: shell.view,
  });
  if (shell.utility) {
    usp.set('utility', shell.utility);
  }
  if (params.runId && params.runId.trim().length > 0) {
    usp.set('runId', params.runId.trim());
  }
  if (shell.utility === 'outcomes' && params.horizon) {
    usp.set('horizon', params.horizon);
  }
  if (shell.utility === 'outcomes' && params.metric) {
    usp.set('metric', params.metric);
  }
  return `/ads/optimizer?${usp.toString()}`;
};
