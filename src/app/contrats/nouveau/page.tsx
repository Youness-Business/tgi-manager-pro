import { Suspense } from "react";
import { ContractWizard } from "@/components/contracts/ContractWizard";
import { PageHeader } from "@/components/ui/PageHeader";


export default function NewContractPage() {
  return <div className="space-y-7"><PageHeader title="Nouveau contrat" description="Définissez le client, les équipements et les conditions du contrat." /><Suspense fallback={<p role="status" className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-card">Chargement du formulaire…</p>}><ContractWizard /></Suspense></div>;
}
