import { Suspense } from "react";
import { ClientDetailsView } from "@/components/clients/ClientDetailsView";
import { useParams } from "@/lib/router";

export default function ClientDetailsPage() {
  const { id = "" } = useParams<{ id: string }>();
  return (
    <Suspense
      fallback={
        <div
          role="status"
          className="min-h-48 rounded-xl border border-gray-200 bg-white p-8 text-sm text-slate-600 shadow-sm"
        >
          Chargement de la fiche client…
        </div>
      }
    >
      <ClientDetailsView id={id} />
    </Suspense>
  );
}
