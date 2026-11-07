import type { DocumentStatus } from "@/types";
import { documentStatusLabels } from "@/lib/documentLabels";

const colors: Record<DocumentStatus, string> = {
  en_attente: "border border-amber-200 bg-amber-50 text-amber-800",
  partiel: "border border-blue-200 bg-blue-50 text-blue-800",
  paye: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  annule: "border border-slate-200 bg-slate-100 text-slate-700",
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span
      className={`inline-flex min-h-6 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${colors[status]}`}
    >
      {documentStatusLabels[status]}
    </span>
  );
}
