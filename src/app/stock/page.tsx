import { Suspense } from "react";
import { StockDirectory } from "@/components/stock/StockDirectory";
import { PageHeader } from "@/components/ui/PageHeader";
import { useSearchParams } from "@/lib/router";

export default function StockPage() {
  const params = useSearchParams();
  return (
    <Suspense fallback={<p role="status">Chargement du stock…</p>}>
      <div className="space-y-6">
        <PageHeader
          title="Stock"
          description="Suivez les quantités disponibles, les seuils et les mouvements."
        />
        <StockDirectory
          initialQuery={params.get("q") ?? ""}
          initialCategory={params.get("cat") ?? ""}
          initialStatus={params.get("statut") ?? ""}
          initialLowOnly={params.get("bas") === "1"}
        />
      </div>
    </Suspense>
  );
}
