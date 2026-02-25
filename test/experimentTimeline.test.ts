import { describe, expect, it } from 'vitest';

import { isInterruptionChange, pickMajorActions } from '../apps/web/src/lib/logbook/experimentTimeline';

describe('experimentTimeline', () => {
  it('interruption detection is exact-match only', () => {
    expect(isInterruptionChange('manual_intervention')).toBe(true);
    expect(isInterruptionChange('guardrail_breach')).toBe(true);
    expect(isInterruptionChange('stop_loss')).toBe(true);
    expect(isInterruptionChange('rollback')).toBe(true);

    expect(isInterruptionChange('manual_intervention ')).toBe(false);
    expect(isInterruptionChange('rollback_now')).toBe(false);
    expect(isInterruptionChange('budget_update')).toBe(false);
  });

  it('pickMajorActions includes interruptions beyond limit', () => {
    const result = pickMajorActions(
      [
        { change_id: 'c1', occurred_at: '2026-02-01T00:00:00Z', change_type: 'rollback' },
        { change_id: 'c2', occurred_at: '2026-02-02T00:00:00Z', change_type: 'manual_intervention' },
        { change_id: 'c3', occurred_at: '2026-02-03T00:00:00Z', change_type: 'budget_update' },
        { change_id: 'c4', occurred_at: '2026-02-04T00:00:00Z', change_type: 'bid_update' },
      ],
      2
    );

    expect(result.interruption_ids).toEqual(['c2', 'c1']);
    expect(result.major).toEqual(['c4', 'c3', 'c2', 'c1']);
  });
});
