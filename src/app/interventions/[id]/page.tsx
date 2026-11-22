import { InterventionRecord } from "@/components/interventions/InterventionRecord";
import { PageHeader } from "@/components/ui/PageHeader";
import { useParams } from "@/lib/router";

export default function InterventionPage() {
  const { id = "" } = useParams<{ id: string }>();
  return <div className="space-y-7"><PageHeader title="Intervention" description="Consultez les informations et le rapport de l’intervention." /><InterventionRecord id={id} /></div>;
}
