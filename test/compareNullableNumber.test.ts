import { describe, expect, it } from 'vitest';

import { compareNullableNumber } from '../apps/web/src/lib/ranking/compareNullableNumber';

describe('compareNullableNumber', () => {
  it('sorts missing last for asc', () => {
    expect(compareNullableNumber(null, 10, 'asc')).toBeGreaterThan(0);
    expect(compareNullableNumber(undefined, 10, 'asc')).toBeGreaterThan(0);
  });

  it('sorts missing last for desc', () => {
    expect(compareNullableNumber(null, 10, 'desc')).toBeGreaterThan(0);
    expect(compareNullableNumber(undefined, 10, 'desc')).toBeGreaterThan(0);
  });

  it('orders numbers for desc', () => {
    expect(compareNullableNumber(200, 10, 'desc')).toBeLessThan(0);
  });
});
