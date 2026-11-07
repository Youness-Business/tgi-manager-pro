import type { Metadata } from "next";
import { ClientReceivables } from "@/components/recouvrement/ClientReceivables";

export const metadata: Metadata = {
  title: "Relevé de compte",
  description: "Créances, paiements et relances du client.",
};

export default async function ClientReceivablesPage({
  params,
}: PageProps<"/recouvrement/clients/[id]">) {
  const { id } = await params;
  return <ClientReceivables id={id} />;
}
