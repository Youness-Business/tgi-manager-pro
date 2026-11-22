import { InterventionDirectory } from "@/components/interventions/InterventionDirectory";
import { PageHeader } from "@/components/ui/PageHeader";


export default function InterventionsPage() {
  return <div className="space-y-7"><PageHeader title="Interventions" description="Planifiez les visites, dépannages et installations, puis consultez les rapports." /><InterventionDirectory /></div>;
}
