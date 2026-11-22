import { Suspense } from "react";
import { ClientDirectory } from "@/components/clients/ClientDirectory";
import { PageHeader } from "@/components/ui/PageHeader";
import { useSearchParams } from "@/lib/router";

export default function ClientsPage() {
  const searchParams = useSearchParams();
  return (
    <Suspense
      fallback={
        <div
          role="status"
          className="min-h-48 rounded-xl border border-gray-200 bg-white p-8 text-sm text-slate-600 shadow-sm"
        >
          Chargement des clients…
        </div>
      }
    >
      <div className="space-y-6">
        <PageHeader
          title="Clients"
          description="Retrouvez vos clients, leurs coordonnées et le total de leurs factures."
        />
        <ClientDirectory initialQuery={searchParams.get("q") ?? ""} />
      </div>
    </Suspense>
  );
}
