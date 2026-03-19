import {
  hasActiveTableTextFilter,
  matchesTableTextFilter,
  type TableTextFilterSource,
} from '@/lib/tableTextFilters';

export type AdsWorkspaceNumericFilterOperator =
  | 'gte'
  | 'lte'
  | 'gt'
  | 'lt'
  | 'has_value';

export type AdsWorkspaceGridNumericFilter = {
  operator: AdsWorkspaceNumericFilterOperator;
  value: string;
};

export type AdsWorkspaceGridSortState = {
  columnKey: string | null;
  direction: 'asc' | 'desc';
};

export type AdsWorkspaceGridTextFilterConfig<TRow> = {
  placeholder: string;
  ariaLabel: string;
  getFilterText: (row: TRow) => TableTextFilterSource;
};

export type AdsWorkspaceGridFilterColumn<TRow> = {
  key: string;
  getSortValue?: (row: TRow) => string | number | null;
  getNumericValue?: (row: TRow) => number | null;
  textFilter?: AdsWorkspaceGridTextFilterConfig<TRow>;
};

export const compareAdsWorkspaceNullable = (
  left: string | number | null,
  right: string | number | null,
  direction: 'asc' | 'desc'
) => {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  if (typeof left === 'number' && typeof right === 'number') {
    return direction === 'asc' ? left - right : right - left;
  }
  const leftText = String(left).toLowerCase();
  const rightText = String(right).toLowerCase();
  if (leftText === rightText) return 0;
  return direction === 'asc'
    ? leftText.localeCompare(rightText)
    : rightText.localeCompare(leftText);
};

export const getActiveAdsWorkspaceTextFilters = (
  textFilters: Record<string, string>
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(textFilters).filter(([, value]) => hasActiveTableTextFilter(value))
  );

export const filterAdsWorkspaceGridRows = <TRow,>(params: {
  rows: TRow[];
  columns: AdsWorkspaceGridFilterColumn<TRow>[];
  numericFilters: Record<string, AdsWorkspaceGridNumericFilter>;
  textFilters: Record<string, string>;
}) => {
  const columnByKey = new Map(params.columns.map((column) => [column.key, column]));
  const activeTextFilters = getActiveAdsWorkspaceTextFilters(params.textFilters);

  return params.rows.filter((row) => {
    const matchesTextFilters = Object.entries(activeTextFilters).every(
      ([columnKey, filterValue]) => {
        const column = columnByKey.get(columnKey);
        if (!column?.textFilter) return true;
        return matchesTableTextFilter(column.textFilter.getFilterText(row), filterValue);
      }
    );
    if (!matchesTextFilters) return false;

    return Object.entries(params.numericFilters).every(([columnKey, filter]) => {
      const column = columnByKey.get(columnKey);
      if (!column?.getNumericValue) return true;
      const numericValue = column.getNumericValue(row);
      if (filter.operator === 'has_value') {
        return numericValue !== null;
      }
      if (numericValue === null) return false;
      const filterValue = Number(filter.value);
      if (!Number.isFinite(filterValue)) return true;
      if (filter.operator === 'gte') return numericValue >= filterValue;
      if (filter.operator === 'lte') return numericValue <= filterValue;
      if (filter.operator === 'gt') return numericValue > filterValue;
      return numericValue < filterValue;
    });
  });
};

export const sortAdsWorkspaceGridRows = <TRow,>(params: {
  rows: TRow[];
  columns: AdsWorkspaceGridFilterColumn<TRow>[];
  sortState: AdsWorkspaceGridSortState;
}) => {
  if (!params.sortState.columnKey) return params.rows;
  const column = params.columns.find((entry) => entry.key === params.sortState.columnKey);
  if (!column?.getSortValue) return params.rows;
  return [...params.rows].sort((left, right) =>
    compareAdsWorkspaceNullable(
      column.getSortValue?.(left) ?? null,
      column.getSortValue?.(right) ?? null,
      params.sortState.direction
    )
  );
};
