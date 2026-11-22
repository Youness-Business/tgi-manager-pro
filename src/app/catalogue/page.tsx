import { Suspense } from "react";
import { CatalogueBrowser } from "@/components/catalogue/CatalogueBrowser";
import { PageHeader } from "@/components/ui/PageHeader";
import { useSearchParams } from "@/lib/router";

export default function CataloguePage() {
  const searchParams = useSearchParams();
  return (
    <Suspense
      fallback={
        <div
          role="status"
          className="min-h-48 rounded-xl border border-gray-200 bg-white p-8 text-sm text-slate-600 shadow-sm"
        >
          Chargement du catalogue…
        </div>
      }
    >
      <div className="space-y-6">
        <PageHeader
          title="Catalogue"
          description="Consultez les fournitures, équipements et prestations disponibles."
        />
        <CatalogueBrowser
          initialQuery={searchParams.get("q") ?? ""}
          initialCategory={searchParams.get("cat") ?? ""}
        />
      </div>
    </Suspense>
  );
}
