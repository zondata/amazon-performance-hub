import { describe, expect, it } from 'vitest';

import { formatRankDateHeader } from '../apps/web/src/lib/ranking/formatRankDate';

describe('formatRankDateHeader', () => {
  it('formats day and short month', () => {
    expect(formatRankDateHeader('2026-02-18')).toEqual({ day: '18', month: 'Feb' });
  });
});
