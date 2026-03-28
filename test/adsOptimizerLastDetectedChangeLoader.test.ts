import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

const SUPABASE_DEFAULT_LIMIT = 1000;
const tableData: Record<string, Row[]> = {};

const applyFilters = (rows: Row[], filters: Array<(row: Row) => boolean>) =>
  rows.filter((row) => filters.every((filter) => filter(row)));

const compareValues = (
  left: unknown,
  right: unknown,
  ascending: boolean
) => {
  const leftValue = String(left ?? '');
  const rightValue = String(right ?? '');
  return ascending
    ? leftValue.localeCompare(rightValue)
    : rightValue.localeCompare(leftValue);
};

const createQuery = (table: string) => {
  const filters: Array<(row: Row) => boolean> = [];
  const orders: Array<{ column: string; ascending: boolean }> = [];
  let rangeBounds: { from: number; to: number } | null = null;

  const run = async () => {
    let rows = applyFilters(tableData[table] ?? [], filters);

    if (orders.length > 0) {
      rows = [...rows].sort((left, right) => {
        for (const order of orders) {
          const comparison = compareValues(left[order.column], right[order.column], order.ascending);
          if (comparison !== 0) {
            return comparison;
          }
        }
        return 0;
      });
    }

    rows = rangeBounds
      ? rows.slice(rangeBounds.from, rangeBounds.to + 1)
      : rows.slice(0, SUPABASE_DEFAULT_LIMIT);

    return {
      data: rows,
      error: null,
    };
  };

  const query: any = {
    select: () => query,
    eq: (column: string, value: unknown) => {
      filters.push((row) => row[column] === value);
      return query;
    },
    in: (column: string, values: unknown[]) => {
      filters.push((row) => values.includes(row[column]));
      return query;
    },
    order: (column: string, options?: { ascending?: boolean }) => {
      orders.push({ column, ascending: options?.ascending !== false });
      return query;
    },
    range: (from: number, to: number) => {
      rangeBounds = { from, to };
      return query;
    },
    then: (
      resolve: (value: { data: Row[]; error: null }) => unknown,
      reject?: (reason: unknown) => unknown
    ) => run().then(resolve, reject),
  };

  return query;
};

vi.mock('../apps/web/src/lib/env', () => ({
  env: {
    supabaseUrl: 'https://example.supabase.co',
    supabaseServiceRoleKey: 'service-role-key',
    accountId: 'sourbear',
    marketplace: 'US',
  },
}));

vi.mock('../apps/web/src/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: (table: string) => createQuery(table),
  },
}));

import { loadAdsOptimizerLastDetectedChangesForTargets } from '../apps/web/src/lib/ads-optimizer/lastDetectedChange';

beforeEach(() => {
  Object.keys(tableData).forEach((key) => delete tableData[key]);

  tableData.bulk_targets = [
    ...Array.from({ length: SUPABASE_DEFAULT_LIMIT }, (_, index) => ({
      account_id: 'sourbear',
      target_id: '100000000000000',
      snapshot_date: `2026-01-${String((index % 28) + 1).padStart(2, '0')}`,
      bid: 1.5,
      state: 'enabled',
    })),
    {
      account_id: 'sourbear',
      target_id: '460665218223146',
      snapshot_date: '2026-03-28',
      bid: 1.17,
      state: 'enabled',
    },
    {
      account_id: 'sourbear',
      target_id: '460665218223146',
      snapshot_date: '2026-03-27',
      bid: 1.02,
      state: 'enabled',
    },
  ];
  tableData.bulk_campaigns = [];
  tableData.sp_placement_modifier_change_log = [];
  tableData.bulk_placements = [];
});

describe('ads optimizer last detected change loader', () => {
  it('loads later bulk target history pages before building last detected changes', async () => {
    const targetSnapshotId = 'target-snapshot-460665218223146';
    const result = await loadAdsOptimizerLastDetectedChangesForTargets([
      {
        targetSnapshotId,
        targetId: '460665218223146',
        campaignId: '73131368692881',
      },
      {
        targetSnapshotId: 'filler-target-snapshot',
        targetId: '100000000000000',
        campaignId: '11111111111111',
      },
    ]);

    const change = result.get(targetSnapshotId);

    expect(change).toMatchObject({
      detectedDate: '2026-03-28',
      emptyMessage: null,
    });
    expect(change?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Bid',
          previousDisplay: '$1.02',
          currentDisplay: '$1.17',
        }),
      ])
    );
  });
});
