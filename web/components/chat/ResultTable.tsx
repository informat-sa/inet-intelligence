"use client";
import { useState } from "react";
import { Download, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn, formatCurrency, formatDate, detectCurrency } from "@/lib/utils";
import type { QueryResult, ColumnDef } from "@/types";

interface Props { result: QueryResult }

type SortDir = "asc" | "desc" | null;

export function ResultTable({ result }: Props) {
  const { data = [], columns = [], rowCount } = result;
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  // Infer columns if not provided
  const cols: ColumnDef[] =
    columns.length > 0
      ? columns
      : data.length > 0
      ? Object.keys(data[0]).map((k) => ({
          key: k,
          label: k,
          type: typeof data[0][k] === "number" ? "number" : "string",
          align: typeof data[0][k] === "number" ? "right" : "left",
        }))
      : [];

  // Sort
  const sorted = [...data].sort((a, b) => {
    if (!sortKey || !sortDir) return 0;
    const av = a[sortKey], bv = b[sortKey];
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  // Paginate
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(key: string) {
    if (sortKey !== key) { setSortKey(key); setSortDir("asc"); }
    else if (sortDir === "asc") setSortDir("desc");
    else { setSortKey(null); setSortDir(null); }
  }

  function formatCell(value: unknown, col: ColumnDef): string {
    if (value == null) return "—";
    if (col.type === "currency" || (col.type === "number" && detectCurrency(col.label))) {
      return formatCurrency(Number(value));
    }
    if (col.type === "number") return Number(value).toLocaleString("es-CL");
    if (col.type === "date") return formatDate(String(value));
    return String(value);
  }

  async function exportXLSX() {
    const rows = [cols.map((c) => c.label), ...data.map((r) => cols.map((c) => r[c.key] ?? ""))];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "inet_resultado.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  if (data.length === 0) return null;

  return (
    <div className="mt-3 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-700 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50
                      border-b border-slate-100 dark:border-slate-700">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {rowCount ?? data.length} resultado{(rowCount ?? data.length) !== 1 ? "s" : ""}
        </span>
        <button
          onClick={exportXLSX}
          className="flex items-center gap-1.5 text-xs text-brand-blue hover:text-brand-navy
                     font-medium transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Exportar CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-brand-navy">
              {cols.map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className={cn(
                    "px-4 py-2.5 text-left text-white font-semibold whitespace-nowrap cursor-pointer",
                    "hover:bg-brand-blue/20 select-none transition-colors",
                    col.align === "right" && "text-right"
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    {col.label}
                    {sortKey === col.key ? (
                      sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronsUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, ri) => (
              <tr
                key={ri}
                className={cn(
                  "border-b border-slate-50 dark:border-slate-700/50 hover:bg-brand-light/30",
                  "dark:hover:bg-brand-navy/10 transition-colors",
                  ri % 2 === 1 && "bg-slate-50/50 dark:bg-slate-800/30"
                )}
              >
                {cols.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-4 py-2.5 text-slate-700 dark:text-slate-300",
                      col.align === "right" && "text-right font-mono",
                      col.type === "currency" && "font-semibold text-brand-navy dark:text-brand-mid"
                    )}
                  >
                    {formatCell(row[col.key], col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50
                        border-t border-slate-100 dark:border-slate-700">
          <span className="text-[11px] text-slate-400">
            Página {page + 1} de {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-xs bg-white dark:bg-slate-700 border border-slate-200
                         dark:border-slate-600 rounded-lg hover:bg-brand-light disabled:opacity-40
                         disabled:cursor-not-allowed transition-colors"
            >← Anterior</button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 text-xs bg-white dark:bg-slate-700 border border-slate-200
                         dark:border-slate-600 rounded-lg hover:bg-brand-light disabled:opacity-40
                         disabled:cursor-not-allowed transition-colors"
            >Siguiente →</button>
          </div>
        </div>
      )}
    </div>
  );
}
