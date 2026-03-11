export const ADS_OPTIMIZER_VIEWS = [
  { label: 'Overview', value: 'overview' },
  { label: 'Targets', value: 'targets' },
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

export const buildAdsOptimizerHref = (params: {
  start: string;
  end: string;
  asin: string;
  view: AdsOptimizerView;
  runId?: string | null;
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
  return `/ads/optimizer?${usp.toString()}`;
};
