"use client";

import { getStockStatut } from "@/lib/stock";
import type { Article } from "@/types";

const statusLabels = {
  ok: "En stock",
  bas: "Stock bas",
  rupture: "Rupture",
} as const;

const statusClasses = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-800",
  bas: "border-amber-200 bg-amber-50 text-amber-900",
  rupture: "border-red-200 bg-red-50 text-red-800",
} as const;

export function StockStatusBadge({ article }: { article: Article }) {
  const status = getStockStatut(article);
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}
