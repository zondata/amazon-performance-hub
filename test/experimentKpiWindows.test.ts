import { describe, expect, it } from 'vitest';

import { computeExperimentKpiWindows } from '../apps/web/src/lib/logbook/computeExperimentKpis';

describe('experiment KPI windows', () => {
  it('shifts test window by lag days', () => {
    const result = computeExperimentKpiWindows({
      startDate: '2026-02-01',
      endDate: '2026-02-07',
      lagDays: 2,
    });

    expect(result.lagDays).toBe(2);
    expect(result.test.startDate).toBe('2026-02-03');
    expect(result.test.endDate).toBe('2026-02-09');
  });

  it('aligns baseline length to the experiment window', () => {
    const result = computeExperimentKpiWindows({
      startDate: '2026-03-10',
      endDate: '2026-03-18',
      lagDays: 4,
    });

    expect(result.baseline.days).toBe(9);
    expect(result.test.days).toBe(9);
    expect(result.baseline.startDate).toBe('2026-03-01');
    expect(result.baseline.endDate).toBe('2026-03-09');
    expect(result.test.startDate).toBe('2026-03-14');
    expect(result.test.endDate).toBe('2026-03-22');
  });
});
