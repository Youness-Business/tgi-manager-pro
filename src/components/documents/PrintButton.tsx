"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      aria-label="Imprimer ou exporter le document en PDF"
      onClick={() => window.print()}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 print:hidden"
    >
      <Printer aria-hidden="true" size={18} />
      Imprimer / Exporter PDF
    </button>
  );
}
