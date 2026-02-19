import type { CSSProperties } from 'react';

export const RESULTS_PER_PAGE = 45;
export const TOP10_CUTOFF = 10;
const TOP10_HUE = 32;

export const getRankPageIndex = (rank: number): number =>
  Math.floor((rank - 1) / RESULTS_PER_PAGE);

export const getRankHue = (rank: number): number => {
  if (!Number.isFinite(rank) || rank <= TOP10_CUTOFF) return TOP10_HUE;
  const pageIndex = getRankPageIndex(rank);
  return (120 + pageIndex * 35) % 360;
};

export const getRankBadgeStyle = (
  rank: number,
  kind: 'exact' | 'gte' | 'missing' | string
): CSSProperties => {
  if (!Number.isFinite(rank) || rank <= 0) {
    return {
      backgroundColor: 'hsla(220, 10%, 60%, 0.12)',
      boxShadow: 'inset 0 0 0 1px hsla(220, 10%, 40%, 0.25)',
    };
  }

  const hue = getRankHue(rank);
  const isTop10 = rank <= TOP10_CUTOFF;
  const isGte = kind === 'gte';
  const fillAlpha = isGte ? 0.14 : isTop10 ? 0.28 : 0.2;
  const ringAlpha = isGte ? 0.35 : isTop10 ? 0.55 : 0.4;

  return {
    backgroundColor: `hsla(${hue}, 78%, 45%, ${fillAlpha})`,
    boxShadow: `inset 0 0 0 1px hsla(${hue}, 70%, 32%, ${ringAlpha})`,
  };
};
