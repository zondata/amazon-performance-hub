const INT_STRING_RE = /^-?\d+$/;
const FLOAT_STRING_RE = /^-?\d+(?:\.\d+)?$/;

const isFiniteNumber = (value: number): boolean => Number.isFinite(value);

export const coerceInt = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return isFiniteNumber(value) ? value : null;
  if (typeof value === 'bigint') return Number.isFinite(Number(value)) ? Number(value) : null;
  if (typeof value === 'string' && INT_STRING_RE.test(value.trim())) {
    const parsed = Number(value);
    return isFiniteNumber(parsed) ? parsed : null;
  }
  return null;
};

export const coerceFloat = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return isFiniteNumber(value) ? value : null;
  if (typeof value === 'bigint') return Number.isFinite(Number(value)) ? Number(value) : null;
  if (typeof value === 'string' && FLOAT_STRING_RE.test(value.trim())) {
    const parsed = Number(value);
    return isFiniteNumber(parsed) ? parsed : null;
  }
  return null;
};
