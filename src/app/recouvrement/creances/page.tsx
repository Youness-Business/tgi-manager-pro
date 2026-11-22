import { Suspense } from "react";
import { CreancesDirectory } from "@/components/recouvrement/CreancesDirectory";
import { PageHeader } from "@/components/ui/PageHeader";
import { useSearchParams } from "@/lib/router";

export default function CreancesPage() {
  const params = useSearchParams();
  return <Suspense fallback={<p role="status">Chargement des créances…</p>}>
    <div className="space-y-6">
      <PageHeader title="Créances" description="Consultez les soldes restant dus et leurs échéances." />
      <CreancesDirectory
        initialQuery={params.get("q") ?? ""}
        initialTranche={params.get("tranche") ?? ""}
        initialClient={params.get("client") ?? ""}
        initialStatus={params.get("statut") ?? ""}
        initialPromise={params.get("promesse") === "1"}
      />
    </div>
  </Suspense>;
}
