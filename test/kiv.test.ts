import { describe, expect, it } from 'vitest';

import { deriveKivCarryForward, normalizeKivStatus } from '../apps/web/src/lib/logbook/kiv';

describe('normalizeKivStatus', () => {
  it('normalizes known values and defaults unknowns to open', () => {
    expect(normalizeKivStatus('open')).toBe('open');
    expect(normalizeKivStatus(' done ')).toBe('done');
    expect(normalizeKivStatus('DISMISSED')).toBe('dismissed');
    expect(normalizeKivStatus('other')).toBe('open');
    expect(normalizeKivStatus(null)).toBe('open');
  });
});

describe('deriveKivCarryForward', () => {
  it('groups open items and recently closed items', () => {
    const now = Date.now();
    const fiveDaysAgo = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString();
    const fortyDaysAgo = new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString();

    const grouped = deriveKivCarryForward([
      { kiv_id: '1', title: 'Open item', status: 'open', created_at: fiveDaysAgo },
      { kiv_id: '2', title: 'Done item', status: 'done', resolved_at: fiveDaysAgo },
      { kiv_id: '3', title: 'Dismissed old', status: 'dismissed', resolved_at: fortyDaysAgo },
    ]);

    expect(grouped.open.map((row) => row.kiv_id)).toEqual(['1']);
    expect(grouped.recently_closed.map((row) => row.kiv_id)).toEqual(['2']);
  });
});
