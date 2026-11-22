"use client";

import Link from "@/lib/router";
import { useMemo, useState } from "react";
import { ArrowLeft, CalendarClock, FilePlus2, Pencil, Wrench } from "lucide-react";
import { useClients } from "@/context/FirestoreDataProvider";
import { useAscenseurs, useContrats, useInterventions } from "@/context/OperationsDataProvider";
import { useAuth } from "@/context/AuthProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { Badge, Select } from "@/components/ui/primitives";
import { InterventionStatusBadge, ElevatorStatusBadge } from "@/components/operations/OperationStatusBadge";
import { updateElevatorStatus } from "@/lib/operations";
import { formatSafeDate } from "@/lib/formatSafeDate";
import { documentTimestamp } from "@/lib/documentTimestamp";
import { can } from "@/lib/permissions";
import type { AscenseurStatut } from "@/types";

export function ElevatorDetails({ id }: { id: string }) {
  const { items: elevators, loading: elevatorsLoading, error: elevatorsError } = useAscenseurs();
  const { items: clients } = useClients();
  const { items: contracts } = useContrats();
  const { items: interventions, loading: interventionsLoading, error: interventionsError } = useInterventions();
  const { role } = useAuth();
  const { showToast } = useToast();
  const [statusError, setStatusError] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const elevator = elevators.find((item) => item.id === id);
  const client = clients.find((item) => item.id === elevator?.clientId);
  const contract = contracts.find((item) => item.id === elevator?.contratId);
  const history = useMemo(() => interventions
    .filter((item) => item.ascenseurId === id)
    .sort((left, right) => documentTimestamp(right.date) - documentTimestamp(left.date)),
  [id, interventions]);
  const canUpdate = can(role, "update", "elevators");

  async function changeStatus(status: AscenseurStatut) {
    if (!elevator || status === elevator.statut) return;
    setSavingStatus(true);
    setStatusError("");
    try {
      await updateElevatorStatus(elevator.id, status);
      showToast("Statut mis à jour", `L’ascenseur est maintenant « ${status.replaceAll("_", " ")} ».`);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "Le statut n’a pas pu être modifié.");
    } finally {
      setSavingStatus(false);
    }
  }

  if (elevatorsLoading) return <p role="status" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-card">Chargement de la fiche ascenseur…</p>;
  if (elevatorsError) return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{elevatorsError}</p>;
  if (!elevator) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card"><h2 className="font-display text-lg font-bold text-slate-900">Ascenseur introuvable</h2><Link className="mt-4 inline-flex text-sm font-semibold text-blue-700" href="/parc">Retour au parc</Link></div>;

  const characteristics: [string, string | number][] = [
    ["Année", elevator.annee],
    ["Capacité", `${elevator.capacite} kg`],
    ["Niveaux", elevator.nbNiveaux],
    ["Type de machine", elevator.typeMachine],
    ["N° de série", elevator.numeroSerie],
    ["Mise en service", formatSafeDate(elevator.dateMiseEnService)],
  ];

  return (
    <div className="space-y-6">
      {elevatorsError || interventionsError || statusError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{elevatorsError ?? interventionsError ?? statusError}</p> : null}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0">
          <Link href="/parc" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-blue-700"><ArrowLeft size={16} aria-hidden="true" />Retour au parc</Link>
          <h2 className="mt-4 break-words font-display text-2xl font-bold text-slate-900">{elevator.marque} {elevator.modele}</h2>
          <p className="mt-1 break-words text-sm text-slate-600">{client?.nom ?? "Client introuvable"} · {elevator.site}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ElevatorStatusBadge status={elevator.statut} />
          {canUpdate ? <label className="sr-only" htmlFor="elevator-status">Modifier le statut</label> : null}
          {canUpdate ? <Select id="elevator-status" value={elevator.statut} disabled={savingStatus} onChange={(event) => void changeStatus(event.target.value as AscenseurStatut)} className="w-auto min-w-40"><option value="en_service">En service</option><option value="en_panne">En panne</option><option value="arret">À l’arrêt</option><option value="en_installation">En installation</option></Select> : null}
          {canUpdate ? <Link href={`/parc/${id}/modifier`} aria-label="Modifier l’ascenseur" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"><Pencil size={17} aria-hidden="true" /></Link> : null}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
          <h2 className="font-display text-lg font-bold text-slate-900">Caractéristiques</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">{characteristics.map(([label, value]) => <div key={label} className="min-w-0 border-b border-slate-100 pb-3"><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</dd></div>)}</dl>
          <p className="mt-4 break-words text-sm leading-6 text-slate-600">{elevator.adresse}</p>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
          <h2 className="font-display text-lg font-bold text-slate-900">Contrat et prochaine visite</h2>
          {contract ? <div className="mt-4 space-y-3"><Link href={`/contrats/${contract.id}`} className="font-semibold text-blue-700 hover:text-blue-800">{contract.numero}</Link><p className="text-sm text-slate-600">Échéance : {formatSafeDate(contract.dateFin)}</p><Badge variant="success">Sous contrat</Badge></div> : <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="font-semibold text-amber-900">Hors contrat</p><p className="mt-1 text-sm text-amber-800">Cet équipement n’est lié à aucun contrat actif.</p>{can(role, "create", "contracts") ? <Link href={`/contrats/nouveau?client=${elevator.clientId}&ascenseur=${id}`} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-amber-900"><FilePlus2 size={16} aria-hidden="true" />Créer un contrat</Link> : null}</div>}
          <div className="mt-5 flex items-center gap-3 rounded-xl bg-slate-50 p-4"><CalendarClock size={18} className="shrink-0 text-blue-700" aria-hidden="true" /><div><p className="text-xs font-medium text-slate-500">Prochaine visite</p><p className="mt-1 text-sm font-semibold tabular-nums text-slate-900">{formatSafeDate(elevator.prochaineVisite)}</p></div></div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-display text-lg font-bold text-slate-900">Historique des interventions</h2><p className="mt-1 text-sm text-slate-600">Visites, dépannages et installations enregistrés pour cet équipement.</p></div>{can(role, "create", "interventions") ? <Link href={`/interventions/nouveau?ascenseur=${id}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"><Wrench size={16} aria-hidden="true" />Nouvelle intervention</Link> : null}</div>
        {interventionsLoading ? <p role="status" className="mt-5 text-sm text-slate-600">Chargement de l’historique…</p> : history.length ? <ol className="mt-6 space-y-5 border-l border-slate-200 pl-5">{history.map((item) => <li key={item.id} className="relative"><span className="absolute -left-[1.57rem] top-1 h-3 w-3 rounded-full border-2 border-white bg-blue-600 ring-1 ring-blue-200" aria-hidden="true" /><div className="flex flex-wrap items-center gap-2"><Link href={`/interventions/${item.id}`} className="font-semibold text-blue-700 hover:text-blue-800">{item.numero}</Link><InterventionStatusBadge status={item.statut} /></div><p className="mt-1 text-xs text-slate-500">{formatSafeDate(item.date)} · {item.type} · {item.technicien}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{item.rapport || item.descriptionProbleme || "Intervention planifiée."}</p></li>)}</ol> : <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Aucune intervention enregistrée.</p>}
      </section>
    </div>
  );
}
