import { describe, expect, it } from 'vitest';

import { selectSqpTrendRange } from '../apps/web/src/lib/sqp/sqpTrendRange';

describe('selectSqpTrendRange', () => {
  it('defaults to the newest 12 weeks when no range is provided', () => {
    const weeksDesc = Array.from({ length: 20 }, (_, index) => {
      const day = 20 - index;
      const weekEnd = `2025-01-${String(day).padStart(2, '0')}`;
      return { week_start: weekEnd, week_end: weekEnd };
    });

    const { from, to } = selectSqpTrendRange({ availableWeeks: weeksDesc, windowSize: 12 });

    expect(to).toBe('2025-01-20');
    expect(from).toBe('2025-01-09');
  });
});
