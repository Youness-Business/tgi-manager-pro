import { ContractRecord } from "@/components/contracts/ContractRecord";
import { useParams } from "@/lib/router";

export default function ContractPrintPage() {
  const { id = "" } = useParams<{ id: string }>();
  return <ContractRecord id={id} printable />;
}
