import { describe, expect, it } from 'vitest';

import { IMPORTANT_COLUMNS } from '../apps/web/src/lib/sqp/sqpColumns';

describe('sqpColumns', () => {
  it('keeps Important columns non-empty', () => {
    expect(IMPORTANT_COLUMNS.length).toBeGreaterThan(0);
  });

  it('includes the core SQP KPI columns in Important mode', () => {
    const keys = new Set(IMPORTANT_COLUMNS.map((column) => column.key));
    expect(keys.has('search_query_volume')).toBe(true);
  });
});
