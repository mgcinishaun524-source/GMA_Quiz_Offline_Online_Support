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
  emptyMessage = 'No records found matching criteria.',
  onRowClick,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="bg-white border border-[#CBD5E1] p-10 text-center">
        <p className="text-sm font-medium text-[#64748B]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#CBD5E1] overflow-x-auto shadow-xs">
      <table className="w-full text-left text-sm border-collapse">
        <thead>
          <tr className="bg-[#1C2C5B] text-white border-b border-[#1C2C5B]">
            {columns.map((col, idx) => (
              <th
                key={idx}
                className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider ${col.className || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#CBD5E1]/60">
          {data.map((row) => (
            <tr
              key={keyExtractor(row)}
              onClick={() => onRowClick && onRowClick(row)}
              className={`transition-colors ${
                onRowClick ? 'cursor-pointer hover:bg-[#E8F3FC]/50' : 'hover:bg-[#F5F8FC]'
              }`}
            >
              {columns.map((col, idx) => {
                let cellContent: React.ReactNode = null;
                if (typeof col.accessor === 'function') {
                  cellContent = col.accessor(row);
                } else if (col.accessor) {
                  cellContent = String(row[col.accessor] ?? '');
                }
                return (
                  <td key={idx} className={`px-4 py-3 text-[#0F172A] ${col.className || ''}`}>
                    {cellContent}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
