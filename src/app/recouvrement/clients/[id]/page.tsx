import { ClientReceivables } from "@/components/recouvrement/ClientReceivables";
import { useParams } from "@/lib/router";

export default function ClientReceivablesPage() {
  const { id = "" } = useParams<{ id: string }>();
  return <ClientReceivables id={id} />;
}
