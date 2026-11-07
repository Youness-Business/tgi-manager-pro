import type { Metadata } from "next";
import { ContractRecord } from "@/components/contracts/ContractRecord";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Fiche contrat",
  description: "Informations, échéances et facturation d’un contrat TGI.",
};

export default async function ContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <div className="space-y-7"><PageHeader title="Fiche contrat" description="Consultez les équipements, échéances et opérations du contrat." /><ContractRecord id={id} /></div>;
}
