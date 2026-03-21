import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

export type ColumnAlignment = 'left' | 'right';

export type ColumnWidth =
  | { strategy: 'fixed'; px: number }
  | { strategy: 'content-fit'; minPx: number; maxPx: number };

export type ColumnDef<TRow> = {
  key: string;
  label: string;
  width: ColumnWidth;
  align?: ColumnAlignment;
  sortable?: boolean;
  frozen?: boolean;
  render: (row: TRow, rowIndex: number) => ReactNode;
};

export type SortState = {
  key: string;
  direction: 'asc' | 'desc';
};

export type ExpandedTabTableProps<TRow> = {
  columns: ColumnDef<TRow>[];
  rows: TRow[];
  totalRow?: {
    render: (column: ColumnDef<TRow>) => ReactNode;
  };
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  rowClassName?: (row: TRow, index: number) => string;
  maxHeight?: number;
  wrapperDataAttributes?: Record<string, string>;
};

const DATA_ROW_BORDER_CLASS = 'border-b-[0.5px] border-border/70';
const FROZEN_COLUMN_CLASS =
  'sticky left-0 z-20 bg-surface border-r-[0.5px] border-border/70 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)]';
const FROZEN_HEADER_CLASS =
  'sticky left-0 z-30 bg-surface border-r-[0.5px] border-border/70 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)]';

const joinClasses = (...classes: Array<string | null | undefined | false>) =>
  classes.filter(Boolean).join(' ');

const getColumnStyle = (width: ColumnWidth): CSSProperties => {
  if (width.strategy === 'fixed') {
    return {
      width: `${width.px}px`,
      minWidth: `${width.px}px`,
      maxWidth: `${width.px}px`,
    };
  }

  if (width.strategy === 'content-fit') {
    return {
      width: 'auto',
      minWidth: `${width.minPx}px`,
      maxWidth: `${width.maxPx}px`,
    };
  }

  return {
    width: 'auto',
  };
};

const getSortAriaValue = (args: {
  isSortable: boolean;
  isActive: boolean;
  direction: SortState['direction'] | undefined;
}): 'ascending' | 'descending' | 'none' | undefined => {
  if (!args.isSortable) return undefined;
  if (!args.isActive || !args.direction) return 'none';
  return args.direction === 'asc' ? 'ascending' : 'descending';
};

export default function ExpandedTabTable<TRow>(props: ExpandedTabTableProps<TRow>) {
  const {
    columns,
    rows,
    totalRow,
    sort,
    onSortChange,
    rowClassName,
    maxHeight = 400,
    wrapperDataAttributes,
  } = props;
  const wrapperProps = (wrapperDataAttributes ?? {}) as HTMLAttributes<HTMLDivElement>;

  const handleSortClick = (key: string) => {
    if (!onSortChange) return;

    if (sort?.key === key) {
      onSortChange({ key, direction: sort.direction === 'desc' ? 'asc' : 'desc' });
      return;
    }

    onSortChange({ key, direction: 'desc' });
  };

  return (
    <>
      <div
        data-expanded-tab-table-scroll="true"
        className="min-h-0 overflow-x-auto overflow-y-auto rounded-xl border border-border/70 bg-surface"
        style={{ maxHeight: `${maxHeight}px` }}
        {...wrapperProps}
      >
        <table className="border-collapse" style={{ width: 'max-content' }}>
          <colgroup>
            {columns.map((column) => (
              <col key={column.key} style={getColumnStyle(column.width)} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-[1]">
            <tr>
              {columns.map((column, columnIndex) => {
                const align = column.align ?? 'left';
                const isFrozen = columnIndex === 0 && column.frozen === true;
                const isSortable = column.sortable === true && typeof onSortChange === 'function';
                const isActiveSort = sort?.key === column.key;

                return (
                  <th
                    key={column.key}
                    aria-sort={getSortAriaValue({
                      isSortable,
                      isActive: isActiveSort,
                      direction: sort?.direction,
                    })}
                    className={joinClasses(
                      'border-b-[0.5px] border-border/70 bg-surface px-2 py-[6px] text-[10px] font-medium uppercase tracking-[0.3px] text-muted whitespace-nowrap',
                      align === 'right' ? 'text-right' : 'text-left',
                      isSortable ? 'cursor-pointer select-none' : '',
                      isFrozen ? FROZEN_HEADER_CLASS : ''
                    )}
                    onClick={isSortable ? () => handleSortClick(column.key) : undefined}
                    style={getColumnStyle(column.width)}
                  >
                    {isSortable ? (
                      <span
                        className={joinClasses(
                          'inline-flex w-full items-center gap-1',
                          align === 'right' ? 'justify-end' : ''
                        )}
                      >
                        {column.label}
                        {isActiveSort ? (
                          <span className="text-[9px]">
                            {sort?.direction === 'desc' ? '▼' : '▲'}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                data-expanded-tab-table-row="data"
                className={joinClasses(
                  rowIndex === rows.length - 1 ? '' : DATA_ROW_BORDER_CLASS,
                  rowClassName?.(row, rowIndex)
                )}
              >
                {columns.map((column, columnIndex) => {
                  const align = column.align ?? 'left';
                  const isFrozen = columnIndex === 0 && column.frozen === true;

                  return (
                    <td
                      key={column.key}
                      className={joinClasses(
                        'px-2 py-[10px] align-top',
                        align === 'right' ? 'text-right' : 'text-left',
                        isFrozen ? FROZEN_COLUMN_CLASS : ''
                      )}
                      style={getColumnStyle(column.width)}
                    >
                      {column.render(row, rowIndex)}
                    </td>
                  );
                })}
              </tr>
            ))}
            {totalRow ? (
              <tr data-expanded-tab-table-row="total" className="border-t border-border/50">
                {columns.map((column, columnIndex) => {
                  const align = column.align ?? 'left';
                  const isFrozen = columnIndex === 0 && column.frozen === true;

                  return (
                    <td
                      key={column.key}
                      className={joinClasses(
                        'px-2 py-[10px] align-top',
                        align === 'right' ? 'text-right' : 'text-left',
                        isFrozen ? FROZEN_COLUMN_CLASS : ''
                      )}
                      style={getColumnStyle(column.width)}
                    >
                      {totalRow.render(column)}
                    </td>
                  );
                })}
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <style>{`
        [data-expanded-tab-table-scroll='true'][data-aph-hscroll][data-aph-hscroll-axis='x'] {
          scrollbar-width: auto;
        }

        [data-expanded-tab-table-scroll='true'][data-aph-hscroll]::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
      `}</style>
    </>
  );
}
