import { describe, expect, it } from 'vitest';

import { getRankHue, getRankPageIndex } from '../apps/web/src/lib/ranking/rankBands';

describe('rankBands', () => {
  it('computes page index boundaries', () => {
    expect(getRankPageIndex(1)).toBe(0);
    expect(getRankPageIndex(45)).toBe(0);
    expect(getRankPageIndex(46)).toBe(1);
  });

  it('uses distinct hue for top 10', () => {
    const topHue = getRankHue(1);
    const nonTopHue = getRankHue(11);
    expect(topHue).not.toBe(nonTopHue);
  });

  it('changes hue across 45 boundary', () => {
    const huePage1 = getRankHue(45);
    const huePage2 = getRankHue(46);
    expect(huePage1).not.toBe(huePage2);
  });
});
