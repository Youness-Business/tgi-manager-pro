import { Suspense } from "react";
import type { Metadata } from "next";
import { ElevatorDirectory } from "@/components/elevators/ElevatorDirectory";
import { PageHeader } from "@/components/ui/PageHeader";
import { firstSearchParam } from "@/lib/searchParams";

export const metadata: Metadata = {
  title: "Parc d’ascenseurs",
  description: "Équipements, statuts et prochaines visites du parc TGI.",
};

type Props = {
  searchParams: Promise<{ q?: string | string[]; statut?: string | string[]; client?: string | string[]; contrat?: string | string[] }>;
};

async function ParkContent({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <div className="space-y-7">
      <PageHeader title="Parc d’ascenseurs" description="Consultez les équipements, leur statut et les prochaines visites." />
      <ElevatorDirectory
        initialQuery={firstSearchParam(params.q)}
        initialStatus={firstSearchParam(params.statut)}
        initialClient={firstSearchParam(params.client)}
        initialContract={firstSearchParam(params.contrat)}
      />
    </div>
  );
}

export default function ParkPage(props: Props) {
  return <Suspense fallback={<div role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-card">Chargement du parc…</div>}><ParkContent {...props} /></Suspense>;
}
