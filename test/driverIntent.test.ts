import { describe, expect, it } from 'vitest';

import { validateIntentString } from '../apps/web/src/lib/logbook/driverIntent';

describe('validateIntentString', () => {
  it('trims and returns intent when non-empty', () => {
    expect(validateIntentString('  rank_defense  ')).toBe('rank_defense');
  });

  it('throws on empty intent', () => {
    expect(() => validateIntentString('   ')).toThrow(/intent/i);
  });
});
