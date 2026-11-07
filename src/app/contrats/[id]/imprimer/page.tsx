import type { Metadata } from "next";
import { ContractRecord } from "@/components/contracts/ContractRecord";

export const metadata: Metadata = {
  title: "Imprimer le contrat",
  description: "Impression d’un contrat TGI.",
};

export default async function ContractPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ContractRecord id={id} printable />;
}
