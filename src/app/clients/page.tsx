import { Suspense } from "react";
import type { Metadata } from "next";
import { ClientDirectory } from "@/components/clients/ClientDirectory";
import { PageHeader } from "@/components/ui/PageHeader";
import { firstSearchParam } from "@/lib/searchParams";

export const metadata: Metadata = {
  title: "Clients",
  description: "Coordonnées, factures et historique des clients de TGI Ascenseurs.",
};

type ClientsPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export const instant = false;

async function ClientsContent({ searchParams }: ClientsPageProps) {
  const params = await searchParams;
  const initialQuery = firstSearchParam(params.q);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Retrouvez vos clients, leurs coordonnées et le total de leurs factures."
      />
      <ClientDirectory initialQuery={initialQuery} />
    </div>
  );
}

export default function ClientsPage(props: ClientsPageProps) {
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
      <ClientsContent {...props} />
    </Suspense>
  );
}
