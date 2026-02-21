import { describe, expect, it } from 'vitest';

import { getOutcomePillTone } from '../apps/web/src/lib/logbook/outcomePill';

describe('outcome pill color mapping', () => {
  it('maps 0-39 to red, 40-69 to yellow, and 70-100 to green', () => {
    expect(getOutcomePillTone(0)).toBe('red');
    expect(getOutcomePillTone(39)).toBe('red');

    expect(getOutcomePillTone(40)).toBe('yellow');
    expect(getOutcomePillTone(69)).toBe('yellow');

    expect(getOutcomePillTone(70)).toBe('green');
    expect(getOutcomePillTone(100)).toBe('green');
  });
});
