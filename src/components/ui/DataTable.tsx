import React from 'react';

export interface Column<T> {
  header: string;
  accessor?: keyof T | ((row: T) => React.ReactNode);
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'No records found.',
  onRowClick,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="gma-card rounded-2xl p-12 text-center">
        <p className="text-sm font-medium text-gma-muted">{emptyMessage}</p>
      </div>
    );
  }

  const getCellContent = (col: Column<T>, row: T): React.ReactNode => {
    if (typeof col.accessor === 'function') return col.accessor(row);
    if (col.accessor) return String(row[col.accessor] ?? '');
    return null;
  };

  return (
    <>
      {/* ── Desktop table (md+) ──────────────────────────────────────────── */}
      <div className="hidden md:block gma-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-gma-navy/95 text-white">
                {columns.map((col, idx) => (
                  <th
                    key={idx}
                    className={`px-4 py-3 text-[0.7rem] font-semibold uppercase tracking-[0.08em] ${col.className || ''}`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gma-navy/8">
              {data.map((row) => (
                <tr
                  key={keyExtractor(row)}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`transition-colors ${
                    onRowClick
                      ? 'cursor-pointer hover:bg-gma-frost/70 active:bg-gma-sky/10'
                      : 'hover:bg-gma-frost/50'
                  }`}
                >
                  {columns.map((col, idx) => (
                    <td key={idx} className={`px-4 py-3 text-slate-800 ${col.className || ''}`}>
                      {getCellContent(col, row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Mobile card stack (< md) ─────────────────────────────────────── */}
      <div className="md:hidden space-y-3">
        {data.map((row) => (
          <div
            key={keyExtractor(row)}
            onClick={() => onRowClick && onRowClick(row)}
            className={`
              gma-card rounded-2xl p-4
              ${onRowClick ? 'cursor-pointer hover:border-gma-sky/40 active:scale-[0.99] transition-all duration-150' : ''}
            `}
          >
            {columns.map((col, idx) => {
              const content = getCellContent(col, row);
              if (content === null || content === '') return null;
              return (
                <div key={idx} className="flex items-start justify-between gap-3 py-1.5 border-b border-gma-navy/8 last:border-0">
                  <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-gma-muted shrink-0 pt-0.5">
                    {col.header}
                  </span>
                  <span className="text-sm text-slate-800 text-right">{content}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
