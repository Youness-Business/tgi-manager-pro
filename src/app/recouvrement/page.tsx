import type { Metadata } from "next";
import { Suspense } from "react";
import { ReceivablesDashboard } from "@/components/recouvrement/ReceivablesDashboard";

export const metadata: Metadata = {
  title: "Recouvrement",
  description: "Suivi des créances, retards de paiement et relances.",
};

export default function ReceivablesPage() {
  return (
    <Suspense fallback={<p role="status">Chargement du recouvrement…</p>}>
      <ReceivablesDashboard />
    </Suspense>
  );
}
