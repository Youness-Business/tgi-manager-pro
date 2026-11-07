import type { Metadata } from "next";
import { ElevatorEditor } from "@/components/elevators/ElevatorEditor";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Ajouter un ascenseur",
  description: "Ajouter un équipement au parc TGI.",
};

export default function NewElevatorPage() {
  return <div className="space-y-7"><PageHeader title="Ajouter un ascenseur" description="Renseignez le site, les caractéristiques et les prochaines visites." /><ElevatorEditor /></div>;
}
