import type { Metadata } from "next";
import { InterventionRecord } from "@/components/interventions/InterventionRecord";

export const metadata: Metadata = {
  title: "Bon d’intervention",
  description: "Impression d’un bon d’intervention TGI.",
};

export default async function InterventionPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InterventionRecord id={id} printable />;
}
