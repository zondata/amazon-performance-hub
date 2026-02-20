import { describe, expect, it } from 'vitest';

import { coerceInt } from '../apps/web/src/lib/sqp/normalizeSqpRow';

describe('normalizeSqpRow', () => {
  it('coerceInt handles numeric strings', () => {
    expect(coerceInt('12345')).toBe(12345);
  });

  it('coerceInt handles numbers', () => {
    expect(coerceInt(12345)).toBe(12345);
  });

  it('coerceInt returns null for null', () => {
    expect(coerceInt(null)).toBeNull();
  });
});
