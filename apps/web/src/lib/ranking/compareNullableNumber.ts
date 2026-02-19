export type SortDir = 'asc' | 'desc';

export const compareNullableNumber = (
  a: number | null | undefined,
  b: number | null | undefined,
  dir: SortDir
): number => {
  const aMissing = a === null || a === undefined || Number.isNaN(a);
  const bMissing = b === null || b === undefined || Number.isNaN(b);
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  return dir === 'asc' ? a - b : b - a;
};
