import { describe, expect, it } from 'vitest';

import { getCalendarBuckets } from '../apps/web/src/lib/sales/buckets/getCalendarBuckets';

describe('getCalendarBuckets', () => {
  it('handles monthly boundaries across years', () => {
    const buckets = getCalendarBuckets({
      last: '2026-02-15',
      cols: 3,
      granularity: 'monthly',
    });

    expect(buckets.map((bucket) => bucket.start)).toEqual([
      '2025-12-01',
      '2026-01-01',
      '2026-02-01',
    ]);
    expect(buckets.map((bucket) => bucket.end)).toEqual([
      '2025-12-31',
      '2026-01-31',
      '2026-02-15',
    ]);
  });

  it('handles quarter boundaries for Q4/Q1', () => {
    const buckets = getCalendarBuckets({
      last: '2026-01-10',
      cols: 2,
      granularity: 'quarterly',
    });

    expect(buckets[0]).toMatchObject({
      start: '2025-10-01',
      end: '2025-12-31',
      label: '2025 Q4',
    });
    expect(buckets[1]).toMatchObject({
      start: '2026-01-01',
      end: '2026-01-10',
      label: '2026 Q1',
    });
  });

  it('handles ISO week boundaries around year edges', () => {
    const buckets = getCalendarBuckets({
      last: '2025-12-31',
      cols: 2,
      granularity: 'weekly',
    });

    expect(buckets[0]).toMatchObject({
      start: '2025-12-22',
      end: '2025-12-28',
      label: 'W52 2025',
    });
    expect(buckets[1]).toMatchObject({
      start: '2025-12-29',
      end: '2025-12-31',
      label: 'W01 2026',
    });
  });
});
