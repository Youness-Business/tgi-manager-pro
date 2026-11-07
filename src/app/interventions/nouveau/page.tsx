import type { Metadata } from "next";
import { Suspense } from "react";
import { InterventionEditor } from "@/components/interventions/InterventionEditor";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Nouvelle intervention",
  description: "Planifier une visite, un dépannage ou une installation.",
};

export default function NewInterventionPage() {
  return <div className="space-y-7"><PageHeader title="Planifier une intervention" description="Choisissez l’équipement, le type d’intervention, la date et le technicien." /><Suspense fallback={<p role="status" className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-card">Chargement du formulaire…</p>}><InterventionEditor /></Suspense></div>;
}
