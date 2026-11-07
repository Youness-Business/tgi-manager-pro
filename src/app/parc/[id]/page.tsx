import type { Metadata } from "next";
import { ElevatorDetails } from "@/components/elevators/ElevatorDetails";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Fiche ascenseur",
  description: "Caractéristiques, contrat et interventions d’un ascenseur.",
};

export default async function ElevatorDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <div className="space-y-7"><PageHeader title="Fiche ascenseur" description="Consultez et mettez à jour les informations de l’équipement." /><ElevatorDetails id={id} /></div>;
}
