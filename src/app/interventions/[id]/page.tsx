import type { Metadata } from "next";
import { InterventionRecord } from "@/components/interventions/InterventionRecord";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Fiche intervention",
  description: "Rapport et détails d’une intervention technique.",
};

export default async function InterventionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <div className="space-y-7"><PageHeader title="Intervention" description="Consultez les informations et le rapport de l’intervention." /><InterventionRecord id={id} /></div>;
}
