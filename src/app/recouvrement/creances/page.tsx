import type { Metadata } from "next";
import { Suspense } from "react";
import { CreancesDirectory } from "@/components/recouvrement/CreancesDirectory";
import { PageHeader } from "@/components/ui/PageHeader";
import { firstSearchParam } from "@/lib/searchParams";

export const metadata: Metadata = {
  title: "Créances",
  description: "Factures ouvertes, échéances et relances à effectuer.",
};

type Props = {
  searchParams: Promise<{
    q?: string | string[];
    tranche?: string | string[];
    client?: string | string[];
    statut?: string | string[];
    promesse?: string | string[];
  }>;
};

async function Content({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <div className="space-y-6">
      <PageHeader title="Créances" description="Consultez les soldes restant dus et leurs échéances." />
      <CreancesDirectory
        initialQuery={firstSearchParam(params.q)}
        initialTranche={firstSearchParam(params.tranche)}
        initialClient={firstSearchParam(params.client)}
        initialStatus={firstSearchParam(params.statut)}
        initialPromise={firstSearchParam(params.promesse) === "1"}
      />
    </div>
  );
}

export default function CreancesPage(props: Props) {
  return <Suspense fallback={<p role="status">Chargement des créances…</p>}><Content {...props} /></Suspense>;
}
