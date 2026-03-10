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
