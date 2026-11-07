"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId, useMemo, useState, type ReactNode } from "react";

export type DataTableColumn<Row> = {
  id: string;
  header: ReactNode;
  render: (row: Row, index: number) => ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
  sortable?: boolean;
  sortDirection?: "ascending" | "descending";
  onSort?: () => void;
};

type DataTableProps<Row> = {
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  getRowKey: (row: Row, index: number) => string;
  minWidthClassName?: string;
  caption: string;
};

const alignmentClasses = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

export function DataTable<Row>({
  columns,
  rows,
  getRowKey,
  minWidthClassName = "min-w-[640px]",
  caption,
}: DataTableProps<Row>) {
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const pageSizeId = useId();
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const visiblePage = Math.min(page, pageCount - 1);
  const visibleRows = useMemo(
    () => rows.slice(visiblePage * pageSize, (visiblePage + 1) * pageSize),
    [visiblePage, pageSize, rows],
  );
  const firstItem = rows.length ? visiblePage * pageSize + 1 : 0;
  const lastItem = Math.min((visiblePage + 1) * pageSize, rows.length);

  return (
    <div className="w-full min-w-0">
      <ul className="space-y-3 p-3 xl:hidden">
        {visibleRows.map((row, visibleIndex) => {
          const rowIndex = visiblePage * pageSize + visibleIndex;
          return (
          <li
            key={getRowKey(row, rowIndex)}
            className="min-w-0 rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
          >
            <dl className="space-y-2.5">
              {columns.map((column) => (
                <div
                  key={column.id}
                  className="grid min-w-0 grid-cols-[minmax(5.5rem,0.8fr)_minmax(0,1.2fr)] items-start gap-2"
                >
                  <dt className="break-words text-xs font-medium text-slate-600">
                    {column.header}
                  </dt>
                  <dd
                    className={`min-w-0 break-words text-sm text-slate-800 ${
                      column.align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    {column.render(row, rowIndex)}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
          );
        })}
      </ul>
      <div className="hidden w-full min-w-0 overflow-x-auto xl:block">
        <table className={`w-full ${minWidthClassName} text-sm`}>
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-[0.08em] text-slate-600">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  aria-sort={column.sortDirection ?? "none"}
                  className={`px-4 py-3 font-medium sm:px-5 ${
                    alignmentClasses[column.align ?? "left"]
                  } ${column.className ?? ""}`}
                >
                  {column.sortable && column.onSort ? (
                    <button
                      type="button"
                      onClick={column.onSort}
                      className="inline-flex min-h-8 items-center gap-1.5 rounded text-inherit hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                      {column.header}
                      <span aria-hidden="true">
                        {column.sortDirection === "ascending"
                          ? "↑"
                          : column.sortDirection === "descending"
                            ? "↓"
                            : "↕"}
                      </span>
                      <span className="sr-only">
                        {column.sortDirection === "ascending"
                          ? "Tri croissant"
                          : column.sortDirection === "descending"
                            ? "Tri décroissant"
                            : "Trier"}
                      </span>
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visibleRows.map((row, visibleIndex) => {
              const rowIndex = visiblePage * pageSize + visibleIndex;
              return (
              <tr
                key={getRowKey(row, rowIndex)}
                className={`transition-colors hover:bg-blue-50/50 ${rowIndex % 2 === 1 ? "bg-slate-50/60" : "bg-white"}`}
              >
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={`px-4 py-3.5 text-slate-700 sm:px-5 ${
                      alignmentClasses[column.align ?? "left"]
                    } ${column.className ?? ""}`}
                  >
                    {column.render(row, rowIndex)}
                  </td>
                ))}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length ? (
        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
            <span>{firstItem}–{lastItem} sur {rows.length}</span>
            <label             htmlFor={pageSizeId} className="flex items-center gap-2">
              Lignes
              <select
                id={pageSizeId}
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(0);
                }}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                {[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Page précédente"
              disabled={visiblePage === 0}
              onClick={() => setPage(Math.max(0, visiblePage - 1))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={17} aria-hidden="true" />
            </button>
            <span aria-live="polite" className="min-w-16 text-center text-xs text-slate-600">
              Page {visiblePage + 1} / {pageCount}
            </span>
            <button
              type="button"
              aria-label="Page suivante"
              disabled={visiblePage + 1 >= pageCount}
              onClick={() => setPage(Math.min(pageCount - 1, visiblePage + 1))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
