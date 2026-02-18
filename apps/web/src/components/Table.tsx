import type { ReactNode } from 'react';

type TableProps = {
  headers: string[];
  rows: ReactNode[][];
  emptyMessage?: string;
};

export default function Table({ headers, rows, emptyMessage }: TableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
        {emptyMessage ?? 'No data available.'}
      </div>
    );
  }

  return (
    <div className="max-h-[520px] overflow-y-auto">
      <div data-aph-hscroll data-aph-hscroll-axis="x" className="overflow-x-auto">
        <table className="min-w-[640px] w-full table-fixed text-left text-sm">
          <thead className="sticky top-0 bg-white text-xs uppercase tracking-wider text-slate-400 shadow-sm">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-3 py-3 text-left">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`} className="hover:bg-slate-50">
                {row.map((cell, cellIndex) => (
                  <td
                    key={`cell-${rowIndex}-${cellIndex}`}
                    className="px-3 py-3 align-top text-slate-600"
                  >
                    <div className="truncate text-sm text-slate-700">{cell}</div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
