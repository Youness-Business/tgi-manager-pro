import { Suspense } from "react";
import type { Metadata } from "next";
import { ContractDirectory } from "@/components/contracts/ContractDirectory";
import { PageHeader } from "@/components/ui/PageHeader";
import { firstSearchParam } from "@/lib/searchParams";

export const metadata: Metadata = {
  title: "Contrats",
  description: "Suivi des contrats de maintenance et d’installation TGI.",
};

type Props = {
  searchParams: Promise<{ q?: string | string[]; statut?: string | string[]; type?: string | string[]; expire60?: string | string[] }>;
};

async function ContractsContent({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <div className="space-y-7">
      <PageHeader title="Contrats" description="Suivez les contrats de maintenance, leurs échéances et leur renouvellement." />
      <ContractDirectory
        initialQuery={firstSearchParam(params.q)}
        initialStatus={firstSearchParam(params.statut)}
        initialType={firstSearchParam(params.type)}
        renewOnly={firstSearchParam(params.expire60) === "1"}
      />
    </div>
  );
}

export default function ContractsPage(props: Props) {
  return <Suspense fallback={<div role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-card">Chargement des contrats…</div>}><ContractsContent {...props} /></Suspense>;
}
