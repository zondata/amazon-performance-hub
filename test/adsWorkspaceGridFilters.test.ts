import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  filterAdsWorkspaceGridRows,
  sortAdsWorkspaceGridRows,
  type AdsWorkspaceGridFilterColumn,
} from '@/lib/ads-workspace/gridTableFilters';

type TestRow = {
  id: string;
  campaign_name: string | null;
  ad_group_name: string | null;
  spend: number | null;
};

const gridTablePath = path.join(
  process.cwd(),
  'apps/web/src/components/ads/AdsWorkspaceGridTable.tsx'
);

const rows: TestRow[] = [
  {
    id: 'row-1',
    campaign_name: 'Alpha Launch',
    ad_group_name: 'Core',
    spend: 10,
  },
  {
    id: 'row-2',
    campaign_name: 'Beta Scale',
    ad_group_name: 'Research',
    spend: 40,
  },
  {
    id: 'row-3',
    campaign_name: 'Alpha Retarget',
    ad_group_name: 'Research',
    spend: 25,
  },
];

const columns: AdsWorkspaceGridFilterColumn<TestRow>[] = [
  {
    key: 'campaign_name',
    getSortValue: (row) => row.campaign_name,
    textFilter: {
      placeholder: 'Search campaign',
      ariaLabel: 'Search campaign',
      getFilterText: (row) => row.campaign_name,
    },
  },
  {
    key: 'ad_group_name',
    getSortValue: (row) => row.ad_group_name,
    textFilter: {
      placeholder: 'Search ad group',
      ariaLabel: 'Search ad group',
      getFilterText: (row) => row.ad_group_name,
    },
  },
  {
    key: 'spend',
    getSortValue: (row) => row.spend,
    getNumericValue: (row) => row.spend,
  },
];

describe('ads workspace grid filters', () => {
  it('limits rows by one active text filter', () => {
    const filteredRows = filterAdsWorkspaceGridRows({
      rows,
      columns,
      numericFilters: {},
      textFilters: { campaign_name: ' alpha ' },
    });

    expect(filteredRows.map((row) => row.id)).toEqual(['row-1', 'row-3']);
  });

  it('combines multiple active text filters with AND semantics', () => {
    const filteredRows = filterAdsWorkspaceGridRows({
      rows,
      columns,
      numericFilters: {},
      textFilters: {
        campaign_name: 'alpha',
        ad_group_name: 'research',
      },
    });

    expect(filteredRows.map((row) => row.id)).toEqual(['row-3']);
  });

  it('combines text filters and numeric filters with AND semantics', () => {
    const filteredRows = filterAdsWorkspaceGridRows({
      rows,
      columns,
      numericFilters: {
        spend: {
          operator: 'gte',
          value: '20',
        },
      },
      textFilters: {
        campaign_name: 'alpha',
      },
    });

    expect(filteredRows.map((row) => row.id)).toEqual(['row-3']);
  });

  it('applies sorting after filtering', () => {
    const filteredRows = filterAdsWorkspaceGridRows({
      rows,
      columns,
      numericFilters: {},
      textFilters: {
        ad_group_name: 'research',
      },
    });

    const sortedRows = sortAdsWorkspaceGridRows({
      rows: filteredRows,
      columns,
      sortState: {
        columnKey: 'spend',
        direction: 'desc',
      },
    });

    expect(sortedRows.map((row) => row.id)).toEqual(['row-2', 'row-3']);
  });

  it('renders the filtered zero-result state as No result', () => {
    const source = fs.readFileSync(gridTablePath, 'utf-8');

    expect(
      filterAdsWorkspaceGridRows({
        rows,
        columns,
        numericFilters: {},
        textFilters: { campaign_name: 'missing' },
      })
    ).toHaveLength(0);
    expect(source).toContain('No result');
  });
});
