import { describe, expect, it } from 'vitest';

import { formatSqpWeekLabel } from '../apps/web/src/lib/sqp/formatSqpWeekLabel';

describe('formatSqpWeekLabel', () => {
  it('formats ISO week labels', () => {
    expect(formatSqpWeekLabel('2025-05-18')).toBe('W20 2025 (May)');
    expect(formatSqpWeekLabel('2025-07-27')).toBe('W30 2025 (Jul)');
    expect(formatSqpWeekLabel('2026-02-07')).toBe('W06 2026 (Feb)');
  });
});
