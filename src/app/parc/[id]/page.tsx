import { ElevatorDetails } from "@/components/elevators/ElevatorDetails";
import { PageHeader } from "@/components/ui/PageHeader";
import { useParams } from "@/lib/router";

export default function ElevatorDetailsPage() {
  const { id = "" } = useParams<{ id: string }>();
  return <div className="space-y-7"><PageHeader title="Fiche ascenseur" description="Consultez et mettez à jour les informations de l’équipement." /><ElevatorDetails id={id} /></div>;
}
