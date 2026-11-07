import { Suspense } from "react";
import type { Metadata } from "next";
import { CatalogueBrowser } from "@/components/catalogue/CatalogueBrowser";
import { PageHeader } from "@/components/ui/PageHeader";
import { firstSearchParam } from "@/lib/searchParams";

export const metadata: Metadata = {
  title: "Catalogue",
  description: "Catalogue des équipements, fournitures et services de TGI Ascenseurs.",
};

type CataloguePageProps = {
  searchParams: Promise<{
    q?: string | string[];
    cat?: string | string[];
  }>;
};

export const instant = false;

async function CatalogueContent({ searchParams }: CataloguePageProps) {
  const params = await searchParams;
  const initialQuery = firstSearchParam(params.q);
  const initialCategory = firstSearchParam(params.cat);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catalogue"
        description="Consultez les fournitures, équipements et prestations disponibles."
      />
      <CatalogueBrowser
        initialQuery={initialQuery}
        initialCategory={initialCategory}
      />
    </div>
  );
}

export default function CataloguePage(props: CataloguePageProps) {
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
      <CatalogueContent {...props} />
    </Suspense>
  );
}
