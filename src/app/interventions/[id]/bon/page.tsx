import { InterventionRecord } from "@/components/interventions/InterventionRecord";
import { useParams } from "@/lib/router";

export default function InterventionPrintPage() {
  const { id = "" } = useParams<{ id: string }>();
  return <InterventionRecord id={id} printable />;
}
