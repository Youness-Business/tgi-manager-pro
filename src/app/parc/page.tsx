import { Suspense } from "react";
import { ElevatorDirectory } from "@/components/elevators/ElevatorDirectory";
import { PageHeader } from "@/components/ui/PageHeader";
import { useSearchParams } from "@/lib/router";

export default function ParkPage() {
  const params = useSearchParams();
  return <Suspense fallback={<div role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-card">Chargement du parc…</div>}>
    <div className="space-y-7">
      <PageHeader title="Parc d’ascenseurs" description="Consultez les équipements, leur statut et les prochaines visites." />
      <ElevatorDirectory
        initialQuery={params.get("q") ?? ""}
        initialStatus={params.get("statut") ?? ""}
        initialClient={params.get("client") ?? ""}
        initialContract={params.get("contrat") ?? ""}
      />
    </div>
  </Suspense>;
}
