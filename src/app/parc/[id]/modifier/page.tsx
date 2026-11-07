import type { Metadata } from "next";
import { ElevatorEditor } from "@/components/elevators/ElevatorEditor";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Modifier un ascenseur",
  description: "Modifier les caractéristiques d’un équipement TGI.",
};

export default async function EditElevatorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <div className="space-y-7"><PageHeader title="Modifier un ascenseur" description="Mettez à jour les caractéristiques de l’équipement." /><ElevatorEditor id={id} /></div>;
}
