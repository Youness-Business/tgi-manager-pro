"use client";

import Link from "@/lib/router";
import { useMemo } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { BonIntervention } from "@/components/documents/BonIntervention";
import { InterventionStatusBadge } from "@/components/operations/OperationStatusBadge";
import { Button } from "@/components/ui/primitives";
import { useClients } from "@/context/FirestoreDataProvider";
import { useAscenseurs, useInterventions } from "@/context/OperationsDataProvider";
import { formatSafeDate } from "@/lib/formatSafeDate";
import type { Intervention } from "@/types";

export function InterventionRecord({ id, printable = false }: { id: string; printable?: boolean }) {
  const { items: interventions, loading: interventionsLoading, error: interventionsError } = useInterventions();
  const { items: elevators, loading: elevatorsLoading, error: elevatorsError } = useAscenseurs();
  const { items: clients, loading: clientsLoading, error: clientsError } = useClients();
  const intervention = interventions.find((item) => item.id === id);
  const elevator = useMemo(() => elevators.find((item) => item.id === intervention?.ascenseurId), [elevators, intervention?.ascenseurId]);
  const client = clients.find((item) => item.id === elevator?.clientId);
  const loading = interventionsLoading || elevatorsLoading || clientsLoading;
  const error = interventionsError ?? elevatorsError ?? clientsError;

  if (loading) return <p role="status" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-card">Chargement de l’intervention…</p>;
  if (error) return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>;
  if (!intervention || !elevator || !client) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card"><h2 className="font-display text-lg font-bold text-slate-900">Intervention introuvable</h2><Link className="mt-4 inline-flex text-sm font-semibold text-blue-700" href="/interventions">Retour aux interventions</Link></div>;

  if (printable) return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3 print:hidden"><Link href={`/interventions/${id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-700"><ArrowLeft size={17} aria-hidden="true" />Retour à l’intervention</Link><Button onClick={() => window.print()} leadingIcon={<Printer size={17} aria-hidden="true" />}>Imprimer / Exporter PDF</Button></div><BonIntervention intervention={intervention} elevator={elevator} client={client} /></div>;

  return <InterventionSummary intervention={intervention} elevatorId={elevator.id} elevatorName={`${elevator.marque} ${elevator.modele}`} site={elevator.site} clientName={client.nom} />;
}

function InterventionSummary({
  intervention,
  elevatorId,
  elevatorName,
  site,
  clientName,
}: {
  intervention: Intervention;
  elevatorId: string;
  elevatorName: string;
  site: string;
  clientName: string;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0">
          <Link href="/interventions" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-blue-700"><ArrowLeft size={16} aria-hidden="true" />Retour aux interventions</Link>
          <h2 className="mt-4 break-all font-display text-2xl font-bold text-slate-900">{intervention.numero}</h2>
          <p className="mt-1 break-words text-sm text-slate-600">{clientName} · {elevatorName} · {site}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2"><InterventionStatusBadge status={intervention.statut} /><Link href={`/interventions/${intervention.id}/bon`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Printer size={16} aria-hidden="true" />Bon d’intervention</Link></div>
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
        <h2 className="font-display text-lg font-bold text-slate-900">Détails</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Type" value={intervention.type} /><Detail label="Date prévue" value={formatSafeDate(intervention.date)} /><Detail label="Technicien" value={intervention.technicien} /><Detail label="Durée" value={intervention.statut === "terminee" ? `${intervention.duree} min` : "À renseigner à la clôture"} />
          <div className="sm:col-span-2 lg:col-span-4"><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Ascenseur</dt><dd className="mt-1 text-sm font-semibold"><Link className="text-blue-700 hover:text-blue-800" href={`/parc/${elevatorId}`}>{elevatorName} · {site}</Link></dd></div>
          {intervention.descriptionProbleme ? <div className="sm:col-span-2 lg:col-span-4"><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Problème signalé</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{intervention.descriptionProbleme}</dd></div> : null}
          <div className="sm:col-span-2 lg:col-span-4"><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Rapport des travaux</dt><dd className="mt-1 min-h-20 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{intervention.rapport || "Le rapport sera disponible après la clôture."}</dd></div>
          {intervention.piecesUtilisees.length ? <div className="sm:col-span-2 lg:col-span-4"><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Pièces utilisées</dt><dd className="mt-1 space-y-1 text-sm text-slate-700">{intervention.piecesUtilisees.map((piece, index) => <p key={`${piece.articleId}-${index}`}>{piece.designation} · {piece.qte}</p>)}</dd></div> : null}
          {intervention.signatureClient ? <Detail label="Signataire client" value={intervention.nomSignataire || "Signé"} /> : null}
        </dl>
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 border-b border-slate-100 pb-3"><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</dd></div>;
}
