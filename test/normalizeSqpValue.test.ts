import { describe, expect, it } from 'vitest';

import { coerceFloat, coerceInt } from '../apps/web/src/lib/sqp/normalizeSqpValue';

describe('normalizeSqpValue', () => {
  it('coerces integer strings', () => {
    expect(coerceInt('16575')).toBe(16575);
  });

  it('coerces float strings', () => {
    expect(coerceFloat('0.1234')).toBe(0.1234);
  });

  it('returns null for invalid values', () => {
    expect(coerceInt('not-a-number')).toBeNull();
    expect(coerceFloat('nope')).toBeNull();
  });
});
