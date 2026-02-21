export type OutcomePillTone = 'red' | 'yellow' | 'green' | 'muted';

export const normalizeOutcomeScorePercent = (score: number | null | undefined): number | null => {
  if (score === null || score === undefined || !Number.isFinite(score)) return null;
  if (score <= 1) return Math.max(0, Math.min(100, score * 100));
  return Math.max(0, Math.min(100, score));
};

export const getOutcomePillTone = (score: number | null | undefined): OutcomePillTone => {
  const normalized = normalizeOutcomeScorePercent(score);
  if (normalized === null) return 'muted';
  if (normalized >= 70) return 'green';
  if (normalized >= 40) return 'yellow';
  return 'red';
};

export const getOutcomePillClassName = (score: number | null | undefined): string => {
  const tone = getOutcomePillTone(score);
  if (tone === 'green') return 'border-emerald-300 bg-emerald-50 text-emerald-700';
  if (tone === 'yellow') return 'border-amber-300 bg-amber-50 text-amber-700';
  if (tone === 'red') return 'border-rose-300 bg-rose-50 text-rose-700';
  return 'border-border bg-surface-2 text-muted';
};
