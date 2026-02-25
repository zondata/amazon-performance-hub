import { describe, expect, it } from 'vitest';

import {
  deriveExperimentDateWindow,
  parseDateOnly,
  toDateOnlyFromIso,
} from '../apps/web/src/lib/logbook/experimentDateWindow';

describe('experimentDateWindow', () => {
  it('uses scope dates when valid', () => {
    const result = deriveExperimentDateWindow({
      scope: {
        start_date: '2026-02-01',
        end_date: '2026-02-10',
      },
      changes: [
        {
          occurred_at: '2026-02-03T10:00:00Z',
          validated_snapshot_date: '2026-02-05',
        },
      ],
    });

    expect(result).toEqual({
      startDate: '2026-02-01',
      endDate: '2026-02-10',
      source: 'scope',
    });
  });

  it('prefers validated_snapshot_date when present', () => {
    const result = deriveExperimentDateWindow({
      scope: { start_date: 'bad', end_date: '' },
      changes: [
        {
          occurred_at: '2026-02-02T08:00:00Z',
          validated_snapshot_date: '2026-02-07',
        },
        {
          occurred_at: '2026-02-04T08:00:00Z',
          validated_snapshot_date: '2026-02-03',
        },
        {
          occurred_at: '2026-02-05T08:00:00Z',
          validated_snapshot_date: '2026-02-30',
        },
      ],
    });

    expect(result).toEqual({
      startDate: '2026-02-03',
      endDate: '2026-02-07',
      source: 'validated_snapshot_dates',
    });
  });

  it('falls back to occurred_at when no snapshot dates', () => {
    const result = deriveExperimentDateWindow({
      scope: null,
      changes: [
        { occurred_at: '2026-02-09T02:00:00Z', validated_snapshot_date: null },
        { occurred_at: '2026-02-02T23:59:59Z' },
        { occurred_at: '2026-02-05T12:00:00Z', validated_snapshot_date: '' },
      ],
    });

    expect(result).toEqual({
      startDate: '2026-02-02',
      endDate: '2026-02-09',
      source: 'linked_changes',
    });
  });

  it('returns missing when no changes and no scope dates', () => {
    const result = deriveExperimentDateWindow({
      scope: { start_date: '', end_date: null },
      changes: [],
    });

    expect(result).toEqual({
      startDate: null,
      endDate: null,
      source: 'missing',
    });
  });

  it('keeps parse helpers strict and deterministic', () => {
    expect(parseDateOnly('2026-02-20')).toBe('2026-02-20');
    expect(parseDateOnly('2026-02-30')).toBeNull();
    expect(toDateOnlyFromIso('2026-02-20T15:30:00Z')).toBe('2026-02-20');
    expect(toDateOnlyFromIso('not-a-date')).toBeNull();
  });
});
