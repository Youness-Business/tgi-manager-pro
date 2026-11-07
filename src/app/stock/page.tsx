import type { Metadata } from "next";
import { Suspense } from "react";
import { StockDirectory } from "@/components/stock/StockDirectory";
import { PageHeader } from "@/components/ui/PageHeader";
import { firstSearchParam } from "@/lib/searchParams";

export const metadata: Metadata = {
  title: "Stock",
  description: "État des stocks, mouvements et alertes de réapprovisionnement.",
};

type Props = {
  searchParams: Promise<{
    q?: string | string[];
    cat?: string | string[];
    statut?: string | string[];
    bas?: string | string[];
  }>;
};

async function StockContent({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock"
        description="Suivez les quantités disponibles, les seuils et les mouvements."
      />
      <StockDirectory
        initialQuery={firstSearchParam(params.q)}
        initialCategory={firstSearchParam(params.cat)}
        initialStatus={firstSearchParam(params.statut)}
        initialLowOnly={firstSearchParam(params.bas) === "1"}
      />
    </div>
  );
}

export default function StockPage(props: Props) {
  return (
    <Suspense fallback={<p role="status">Chargement du stock…</p>}>
      <StockContent {...props} />
    </Suspense>
  );
}
