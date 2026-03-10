import { describe, expect, it } from 'vitest';

import {
  formatUiDate,
  formatUiDateRange,
  formatUiDateTime,
} from '../apps/web/src/lib/time/formatUiDate';

describe('ui date formatting', () => {
  it('formats YYYY-MM-DD into day month year display text', () => {
    expect(formatUiDate('2026-02-22')).toBe('22 Feb 2026');
  });

  it('formats date ranges using the shared display format', () => {
    expect(formatUiDateRange('2026-02-22', '2026-03-01')).toBe('22 Feb 2026 → 1 Mar 2026');
  });

  it('keeps date-time output non-ISO and human readable', () => {
    expect(formatUiDateTime('2026-02-22T15:04:00Z')).toContain('22 Feb 2026');
  });
});
