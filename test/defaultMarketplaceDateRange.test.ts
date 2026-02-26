import { afterEach, describe, expect, it, vi } from 'vitest';

import { getDefaultMarketplaceDateRange } from '../apps/web/src/lib/time/defaultDateRange';

describe('getDefaultMarketplaceDateRange', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('applies delayDays before daysBack window math', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-26T18:00:00Z'));

    const range = getDefaultMarketplaceDateRange({
      marketplace: 'US',
      daysBack: 7,
      delayDays: 2,
    });

    expect(range).toEqual({
      start: '2026-02-18',
      end: '2026-02-24',
    });
  });

  it('uses marketplace-local day instead of UTC day boundaries', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-26T03:30:00Z'));

    const range = getDefaultMarketplaceDateRange({
      marketplace: 'US',
      daysBack: 1,
      delayDays: 0,
    });

    expect(range).toEqual({
      start: '2026-02-25',
      end: '2026-02-25',
    });
  });
});
