import { Suspense } from "react";
import { ReceivablesDashboard } from "@/components/recouvrement/ReceivablesDashboard";


export default function ReceivablesPage() {
  return (
    <Suspense fallback={<p role="status">Chargement du recouvrement…</p>}>
      <ReceivablesDashboard />
    </Suspense>
  );
}
