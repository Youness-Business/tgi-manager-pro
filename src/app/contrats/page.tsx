import { Suspense } from "react";
import { ContractDirectory } from "@/components/contracts/ContractDirectory";
import { PageHeader } from "@/components/ui/PageHeader";
import { useSearchParams } from "@/lib/router";

export default function ContractsPage() {
  const params = useSearchParams();
  return (
    <Suspense fallback={<div role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-card">Chargement des contrats…</div>}>
      <div className="space-y-7">
        <PageHeader title="Contrats" description="Suivez les contrats de maintenance, leurs échéances et leur renouvellement." />
        <ContractDirectory
          initialQuery={params.get("q") ?? ""}
          initialStatus={params.get("statut") ?? ""}
          initialType={params.get("type") ?? ""}
          renewOnly={params.get("expire60") === "1"}
        />
      </div>
    </Suspense>
  );
}
