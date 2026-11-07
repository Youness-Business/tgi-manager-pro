"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { formatMoney } from "@/lib/formatMoney";
import { documentTimestamp } from "@/lib/documentTimestamp";
import { computeDiscountedTotals } from "@/lib/computeDiscountedTotals";
import { useAscenseurs, useContrats, useInterventions } from "@/context/OperationsDataProvider";
import { annualContractRevenue } from "@/lib/operations";
import { contratNeedsRenewal, getContratStatut } from "@/lib/contractDates";
import { formatSafeDate } from "@/lib/formatSafeDate";
import { Badge } from "@/components/ui/primitives";
import type { Client, Document, UserRole } from "@/types";

type Props = {
  clients: readonly Client[];
  documents: readonly Document[];
  role: UserRole;
  currentUid?: string;
};

const statusNames = {
  paye: "Payé",
  en_attente: "En attente",
  annule: "Annulé",
} as const;

const statusColors = {
  paye: "#059669",
  en_attente: "#d97706",
  annule: "#64748b",
} as const;

function relativeDate(timestamp: number): string {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "À l’instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Il y a ${days} j`;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(timestamp);
}

export function DashboardInsights({ clients, documents, role, currentUid }: Props) {
  const isCommercial = role === "commercial";
  const { items: contracts, loading: contractsLoading, error: contractsError } = useContrats();
  const { items: elevators, loading: elevatorsLoading, error: elevatorsError } = useAscenseurs();
  const { items: interventions, loading: interventionsLoading, error: interventionsError } = useInterventions();
  const monthlyData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, index) => {
      const month = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
      const docs = documents.filter((document) => {
        const date = new Date(documentTimestamp(document.dateCreation));
        return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
      });
      const value = isCommercial
        ? docs.filter((document) => document.type === "devis" || document.type === "facture").length
        : docs
            .filter((document) => document.type === "facture" && document.statut === "paye")
            .reduce((sum, document) => sum + computeDiscountedTotals(document.lignes, document.remisePct).totalHT, 0);
      return {
        key: `${month.getFullYear()}-${month.getMonth()}`,
        label: new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(month).replace(/\.$/, ""),
        value,
      };
    });
  }, [documents, isCommercial]);

  const statuses = useMemo(
    () => ({
      paye: documents.filter((document) => document.statut === "paye").length,
      en_attente: documents.filter((document) => document.statut === "en_attente").length,
      annule: documents.filter((document) => document.statut === "annule").length,
    }),
    [documents],
  );
  const statusTotal = statuses.paye + statuses.en_attente + statuses.annule;
  const totalPaid = useMemo(() => {
    const totals = new Map<string, number>();
    for (const document of documents) {
      if (document.type !== "facture" || document.statut !== "paye") continue;
      totals.set(
        document.clientId,
        (totals.get(document.clientId) ?? 0) +
          computeDiscountedTotals(document.lignes, document.remisePct).totalTTC,
      );
    }
    return clients
      .map((client) => ({ ...client, total: totals.get(client.id) ?? 0 }))
      .sort((left, right) => right.total - left.total)
      .slice(0, 5);
  }, [clients, documents]);
  const latest = useMemo(
    () =>
      [...documents]
        .sort((left, right) => documentTimestamp(right.dateCreation) - documentTimestamp(left.dateCreation))
        .slice(0, 5),
    [documents],
  );
  const maxValue = Math.max(...monthlyData.map((item) => item.value), 1);
  const circumference = 2 * Math.PI * 37;
  let dashOffset = 0;
  const donutSegments = (Object.keys(statuses) as (keyof typeof statuses)[]).map((status) => {
    const length = statusTotal ? (statuses[status] / statusTotal) * circumference : 0;
    const segment = { status, length, offset: dashOffset };
    dashOffset += length;
    return segment;
  });
  const activeContracts = contracts.filter((contract) => getContratStatut(contract) === "actif");
  const contractsForRenewal = contracts
    .filter((contract) => contratNeedsRenewal(contract))
    .sort((left, right) => documentTimestamp(left.dateFin) - documentTimestamp(right.dateFin));
  const renewingContracts = contractsForRenewal.slice(0, 5);
  const recurringRevenue = activeContracts.reduce((sum, contract) => sum + annualContractRevenue(contract), 0);
  const startOfWeek = new Date();
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  const thisWeekInterventions = interventions
    .filter((item) => {
      const timestamp = documentTimestamp(item.date);
      return timestamp >= startOfWeek.getTime() && timestamp < endOfWeek.getTime();
    })
    .sort((left, right) => documentTimestamp(left.date) - documentTimestamp(right.date));

  return (
    <div className="space-y-5">
      {contractsError || elevatorsError || interventionsError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{contractsError ?? elevatorsError ?? interventionsError}</p> : null}
      {(contractsLoading || elevatorsLoading || interventionsLoading) ? <p role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-card">Chargement des contrats et interventions…</p> : null}
      <section aria-label="Suivi du parc et des contrats" className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/contrats" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition hover:border-blue-200 hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-blue-600">
          <p className="text-sm font-medium text-slate-600">Contrats actifs</p>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums text-slate-950">{activeContracts.length}</p>
          <p className="mt-1 text-xs text-slate-500">Suivre les contrats</p>
        </Link>
        {!isCommercial ? <Link href="/contrats" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition hover:border-blue-200 hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-blue-600">
          <p className="text-sm font-medium text-slate-600">CA récurrent annuel</p>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-slate-950">{formatMoney(recurringRevenue)}</p>
          <p className="mt-1 text-xs text-slate-500">Contrats actifs · HT annualisé</p>
        </Link> : null}
        <Link href="/contrats?expire60=1" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition hover:border-amber-200 hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-amber-600">
          <p className="text-sm font-medium text-slate-600">À renouveler</p>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums text-slate-950">{contractsForRenewal.length}</p>
          <p className="mt-1 text-xs text-slate-500">Échéance sous 60 jours</p>
        </Link>
        {!isCommercial ? <Link href="/parc?statut=en_panne" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition hover:border-red-200 hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-red-600">
          <p className="text-sm font-medium text-slate-600">Ascenseurs en panne</p>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums text-slate-950">{elevators.filter((item) => item.statut === "en_panne").length}</p>
          <p className="mt-1 text-xs text-slate-500">Équipements nécessitant un suivi</p>
        </Link> : null}
      </section>
      <section className="grid min-w-0 gap-5 xl:grid-cols-2">
        <Card className="min-w-0 overflow-hidden">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div><h2 className="font-display font-bold text-slate-900">Contrats à renouveler</h2><p className="mt-1 text-sm text-slate-600">Les cinq prochaines échéances</p></div>
            <Link href="/contrats?expire60=1" className="text-xs font-semibold text-blue-700 hover:text-blue-800">Tout voir</Link>
          </div>
          {renewingContracts.length ? <ul className="divide-y divide-slate-100">{renewingContracts.map((contract) => {
            const client = clients.find((item) => item.id === contract.clientId);
            return <li key={contract.id} className="flex min-w-0 items-center justify-between gap-3 px-5 py-3.5"><div className="min-w-0"><Link href={`/contrats/${contract.id}`} className="font-semibold text-blue-700 hover:text-blue-800">{contract.numero}</Link><p className="truncate text-xs text-slate-500">{client?.nom ?? "Client introuvable"} · fin le {formatSafeDate(contract.dateFin)}</p></div><Badge variant="warning">À renouveler</Badge></li>;
          })}</ul> : <p className="px-5 py-8 text-center text-sm text-slate-600">Aucun contrat à renouveler dans les 60 jours.</p>}
        </Card>
        <Card className="min-w-0 overflow-hidden">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div><h2 className="font-display font-bold text-slate-900">Interventions de la semaine</h2><p className="mt-1 text-sm text-slate-600">{thisWeekInterventions.length} intervention{thisWeekInterventions.length === 1 ? "" : "s"} planifiée{thisWeekInterventions.length === 1 ? "" : "s"}</p></div>
            <Link href="/interventions" className="text-xs font-semibold text-blue-700 hover:text-blue-800">Tout voir</Link>
          </div>
          {thisWeekInterventions.length ? <ul className="divide-y divide-slate-100">{thisWeekInterventions.slice(0, 5).map((item) => {
            const elevator = elevators.find((entry) => entry.id === item.ascenseurId);
            return <li key={item.id} className="flex min-w-0 items-center justify-between gap-3 px-5 py-3.5"><div className="min-w-0"><Link href={`/interventions/${item.id}`} className="font-semibold text-blue-700 hover:text-blue-800">{item.numero} · {item.type}</Link><p className="truncate text-xs text-slate-500">{elevator?.site ?? "Ascenseur introuvable"} · {item.technicien}</p></div><span className="shrink-0 text-xs tabular-nums text-slate-600">{formatSafeDate(item.date)}</span></li>;
          })}</ul> : <p className="px-5 py-8 text-center text-sm text-slate-600">Aucune intervention prévue cette semaine.</p>}
        </Card>
      </section>
    <section className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-3">
      <Card className="min-w-0 overflow-hidden xl:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6">
          <div>
            <h2 className="font-display font-bold tracking-tight text-slate-900">
              {isCommercial ? "Votre activité sur 12 mois" : "Chiffre d’affaires sur 12 mois"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {isCommercial ? "Devis et factures créés" : "Factures payées · hors taxes"}
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            {isCommercial ? "Documents" : "MAD"}
          </span>
        </div>
        {monthlyData.every((month) => month.value === 0) ? (
          <p className="flex min-h-56 items-center justify-center px-6 text-center text-sm text-slate-600">
            {isCommercial ? "Aucune activité sur la période." : "Aucune facture payée sur la période."}
          </p>
        ) : (
          <div className="min-w-0 px-3 pb-4 pt-5 sm:px-5">
            <svg
              role="img"
              aria-label={isCommercial ? "Volume de documents créés sur 12 mois" : "Chiffre d’affaires hors taxes sur 12 mois"}
              viewBox="0 0 720 240"
              className="h-auto w-full"
            >
              <line x1="20" y1="190" x2="700" y2="190" stroke="#e2e8f0" />
              {monthlyData.map((item, index) => {
                const width = 32;
                const gap = 22;
                const x = 26 + index * (width + gap);
                const height = Math.max(item.value === 0 ? 0 : 4, item.value / maxValue * 145);
                return (
                  <g key={item.key}>
                    <title>
                      {item.label}: {isCommercial ? `${item.value} document(s)` : formatMoney(item.value)}
                    </title>
                    <rect
                      x={x}
                      y={190 - height}
                      width={width}
                      height={height}
                      rx="7"
                      fill={item.value ? "#2563eb" : "#e2e8f0"}
                    />
                    {item.value > 0 && index % 2 === 0 ? (
                      <text x={x + width / 2} y="216" textAnchor="middle" fill="#64748b" fontSize="11">
                        {item.label}
                      </text>
                    ) : null}
                    {item.value > 0 && index % 2 === 1 ? (
                      <text x={x + width / 2} y="216" textAnchor="middle" fill="#64748b" fontSize="11">
                        {item.label}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </Card>

      <Card className="flex min-w-0 flex-col p-5 sm:p-6">
        <h2 className="font-display font-bold tracking-tight text-slate-900">État des documents</h2>
        <p className="mt-1 text-sm text-slate-600">Répartition par statut</p>
        {statusTotal ? (
          <div className="mt-4 flex flex-1 items-center gap-5">
            <svg role="img" aria-label="Répartition des documents par statut" viewBox="0 0 100 100" className="h-28 w-28 shrink-0 -rotate-90">
              <circle cx="50" cy="50" r="37" fill="none" stroke="#f1f5f9" strokeWidth="12" />
              {donutSegments.map(({ status, length, offset }) => (
                <circle key={status} cx="50" cy="50" r="37" fill="none" stroke={statusColors[status]} strokeWidth="12" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} />
              ))}
            </svg>
            <ul className="min-w-0 flex-1 space-y-3">
              {(Object.keys(statuses) as (keyof typeof statuses)[]).map((status) => (
                <li key={status} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-slate-600">
                    <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: statusColors[status] }} />
                    <span className="truncate">{statusNames[status]}</span>
                  </span>
                  <span className="font-semibold tabular-nums text-slate-900">{statuses[status]}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="flex flex-1 items-center justify-center py-10 text-sm text-slate-600">Aucun document à répartir.</p>
        )}
      </Card>

      <Card className="min-w-0 overflow-hidden xl:col-span-2">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-display font-bold tracking-tight text-slate-900">Clients les plus actifs</h2>
            <p className="mt-1 text-sm text-slate-600">{isCommercial ? "Factures réglées de votre portefeuille" : "Classement par chiffre d’affaires TTC"}</p>
          </div>
          <Link href="/clients" className="text-xs font-semibold text-blue-700 hover:text-blue-800">Tous les clients</Link>
        </div>
        {totalPaid.length ? (
          <ol className="divide-y divide-slate-100">
            {totalPaid.map((client, index) => (
              <li key={client.id} className="flex min-w-0 items-center gap-3 px-5 py-3.5 sm:px-6">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">{String(index + 1).padStart(2, "0")}</span>
                <Link href={`/clients/${client.id}`} className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 hover:text-blue-700">{client.nom}</Link>
                <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900">
                  {isCommercial ? "Client actif" : formatMoney(client.total)}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="px-6 py-10 text-center text-sm text-slate-600">Aucun client avec une facture réglée.</p>
        )}
      </Card>

      <Card className="min-w-0 overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-display font-bold tracking-tight text-slate-900">Activité récente</h2>
          <p className="mt-1 text-sm text-slate-600">Derniers documents émis</p>
        </div>
        {latest.length ? (
          <ul className="divide-y divide-slate-100">
            {latest.map((document) => {
              const timestamp = documentTimestamp(document.dateCreation);
              return (
                <li key={document.id} className="flex min-w-0 items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <Link href={`/documents/${document.id}`} className="block truncate text-sm font-semibold text-blue-700 hover:text-blue-800">{document.numero}</Link>
                    <p className="mt-1 text-xs text-slate-500">{document.type.replace("_", " ")} · {document.createdBy && document.createdBy === currentUid ? "Vous" : "Équipe TGI"}</p>
                  </div>
                  <time className="shrink-0 pt-0.5 text-[11px] text-slate-500" dateTime={new Date(timestamp).toISOString()}>{relativeDate(timestamp)}</time>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-5 py-10 text-center text-sm text-slate-600">Aucune activité récente.</p>
        )}
      </Card>
    </section>
    </div>
  );
}
