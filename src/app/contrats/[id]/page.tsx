import { ContractRecord } from "@/components/contracts/ContractRecord";
import { PageHeader } from "@/components/ui/PageHeader";
import { useParams } from "@/lib/router";

export default function ContractPage() {
  const { id = "" } = useParams<{ id: string }>();
  return <div className="space-y-7"><PageHeader title="Fiche contrat" description="Consultez les équipements, échéances et opérations du contrat." /><ContractRecord id={id} /></div>;
}
