import { ElevatorEditor } from "@/components/elevators/ElevatorEditor";
import { PageHeader } from "@/components/ui/PageHeader";
import { useParams } from "@/lib/router";

export default function EditElevatorPage() {
  const { id = "" } = useParams<{ id: string }>();
  return <div className="space-y-7"><PageHeader title="Modifier un ascenseur" description="Mettez à jour les caractéristiques de l’équipement." /><ElevatorEditor id={id} /></div>;
}
