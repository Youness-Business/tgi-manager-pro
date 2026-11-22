"use client";

import Link from "@/lib/router";
import { AlertCircle, ArrowRight, Banknote, CalendarClock, FileClock, Percent, UsersRound } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { useClients } from "@/context/FirestoreDataProvider";
import { useCreances } from "@/context/RecouvrementDataProvider";
import { computeBalanceAgee, computeDSO, computeSolde, computeTauxRecouvrement, getRetardJours, isPromesseNonTenue, suggestRelanceNiveau } from "@/lib/recouvrement";
import { formatMoney } from "@/lib/formatMoney";
import type { Document, Paiement, Relance } from "@/types";

const tranches = [
  { key: "non_echue", label: "Non échue", color: "#2563eb" },
  { key: "1-30", label: "1–30 jours", color: "#f59e0b" },
  { key: "31-60", label: "31–60 jours", color: "#f97316" },
  { key: "61-90", label: "61–90 jours", color: "#ef4444" },
  { key: "90+", label: "Plus de 90 jours", color: "#991b1b" },
] as const;

export function ReceivablesDashboard() {
  const { documents, paiements, relances, loading, error } = useCreances();
  const { items: clients, loading: clientsLoading, error: clientsError } = useClients();
  const now = new Date();
  const aged = computeBalanceAgee(documents, paiements, now);
  const receivables = Object.values(aged).reduce((sum, item) => sum + item.montant, 0);
  const overdue = Object.entries(aged)
    .filter(([key]) => key !== "non_echue")
    .reduce((sum, [, item]) => sum + item.montant, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const collectionRate = computeTauxRecouvrement(documents, paiements, monthStart, nextMonthStart);
  const dso = computeDSO(documents, paiements, now);
  const checks = paiements.filter(
    (payment) =>
      (payment.mode === "cheque" || payment.mode === "effet") &&
      ["en_portefeuille", "remis_banque"].includes(payment.statut),
  );
  const endOfWeek = new Date(now);
  endOfWeek.setDate(now.getDate() + (7 - (now.getDay() || 7)));
  const checkThisWeek = checks.filter((payment) => {
    const date = payment.dateEncaissementPrevue;
    if (!date) return false;
    const parsed = asDate(date);
    return parsed >= now && parsed <= endOfWeek;
  }).length;
  const dueByClient = new Map<string, number>();
  for (const invoice of documents) {
    const balance = computeSolde(invoice, paiements);
    if (balance > 0) dueByClient.set(invoice.clientId, (dueByClient.get(invoice.clientId) ?? 0) + balance);
  }
  const topClients = [...dueByClient]
    .map(([clientId, amount]) => ({
      client: clients.find((item) => item.id === clientId),
      clientId,
      amount,
    }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 5);
  const followUps = documents
    .filter((invoice) => {
      if (invoice.type !== "facture" || computeSolde(invoice, paiements) <= 0) return false;
      const delay = getRetardJours(invoice.dateEcheance, now) ?? 0;
      if (delay <= 0) return false;
      const invoiceReminders = relances.filter((item) => item.documentIds.includes(invoice.id));
      const latestReminder = invoiceReminders
        .map((item) => asDate(item.date).getTime())
        .sort((a, b) => b - a)[0];
      const recentReminder = latestReminder !== undefined && now.getTime() - latestReminder < 7 * 86_400_000;
      return !recentReminder || invoiceReminders.some((item) => isPromesseNonTenue(item, paiements, now));
    })
    .sort((left, right) => (getRetardJours(right.dateEcheance, now) ?? 0) - (getRetardJours(left.dateEcheance, now) ?? 0))
    .slice(0, 5);

  if (loading || clientsLoading) {
    return <p role="status" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-card">Chargement du recouvrement…</p>;
  }
  if (error || clientsError) {
    return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error ?? clientsError}</p>;
  }

  const maxAmount = Math.max(1, ...tranches.map((item) => aged[item.key].montant));
  return (
    <div className="space-y-6">
      <PageHeader
        title="Recouvrement"
        description="Suivez les créances, les retards, les promesses et les encaissements."
        actions={<Link href="/recouvrement/creances" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">Voir les créances <ArrowRight size={16} aria-hidden="true" /></Link>}
      />
      <section aria-label="Indicateurs de recouvrement" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Créances totales" value={formatMoney(receivables)} detail="Solde ouvert des factures" icon={Banknote} iconClassName="bg-blue-50 text-blue-700" />
        <StatCard label="Montant en retard" value={formatMoney(overdue)} detail={`${aged["1-30"].factures + aged["31-60"].factures + aged["61-90"].factures + aged["90+"].factures} factures échues`} icon={AlertCircle} iconClassName="bg-red-50 text-red-700" />
        <StatCard label="Taux du mois" value={`${collectionRate.toFixed(1)} %`} detail="Encaissements / factures émises" icon={Percent} iconClassName="bg-emerald-50 text-emerald-700" />
        <StatCard label="DSO" value={`${dso} jours`} detail="Moyenne glissante sur 90 jours" icon={CalendarClock} iconClassName="bg-amber-50 text-amber-700" />
        <StatCard label="Chèques en portefeuille" value={String(checks.length)} detail={`${checkThisWeek} échéance(s) cette semaine`} icon={Banknote} iconClassName="bg-violet-50 text-violet-700" />
      </section>
      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <Card className="min-w-0 p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold text-slate-900">Balance âgée</h2>
          <p className="mt-1 text-sm text-slate-600">Solde dû selon l’ancienneté de l’échéance</p>
          <div className="mt-5 space-y-4" role="img" aria-label="Répartition des créances par ancienneté">
            {tranches.map((item) => (
              <div key={item.key}>
                <div className="mb-1 flex justify-between gap-3 text-xs">
                  <span className="font-medium text-slate-700">{item.label}</span>
                  <span className="tabular-nums text-slate-600">{formatMoney(aged[item.key].montant)}</span>
                </div>
                <svg viewBox="0 0 100 8" preserveAspectRatio="none" className="h-3 w-full overflow-visible rounded-full bg-slate-100">
                  <rect x="0" y="0" width={Math.max(1, aged[item.key].montant / maxAmount * 100)} height="8" rx="4" fill={item.color} />
                </svg>
              </div>
            ))}
          </div>
        </Card>
        <Card className="min-w-0 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">À relancer aujourd’hui</h2>
              <p className="mt-1 text-sm text-slate-600">Factures échues sans suivi récent ou promesse non tenue</p>
            </div>
            <Link href="/recouvrement/creances" className="text-sm font-semibold text-blue-700 hover:text-blue-800">Tout voir</Link>
          </div>
          {followUps.length ? (
            <ul className="mt-4 divide-y divide-slate-100">
              {followUps.map((invoice) => {
                const delay = getRetardJours(invoice.dateEcheance, now) ?? 0;
                const reminder = relances.filter((item) => item.documentIds.includes(invoice.id));
                const level = suggestRelanceNiveau(delay, reminder, paiements, now) ?? 1;
                return (
                  <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <Link href={`/recouvrement/creances?q=${encodeURIComponent(invoice.numero)}`} className="font-semibold text-blue-700 hover:text-blue-800">{invoice.numero}</Link>
                      <p className="text-xs text-slate-600">{clients.find((client) => client.id === invoice.clientId)?.nom ?? "Client"} · {delay} j de retard</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums text-slate-900">{formatMoney(computeSolde(invoice, paiements))}</p>
                      <p className="text-xs font-medium text-amber-700">Niveau {level}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : <EmptyState icon={FileClock} title="Aucune relance à effectuer" message="Les factures échues ont un suivi récent ou sont réglées." />}
        </Card>
      </div>
      <Card className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">Principaux débiteurs</h2>
            <p className="mt-1 text-sm text-slate-600">Clients classés par solde ouvert</p>
          </div>
          <UsersRound size={20} className="text-slate-400" aria-hidden="true" />
        </div>
        {topClients.length ? (
          <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {topClients.map((entry, index) => (
              <li key={entry.clientId} className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-500">#{index + 1}</p>
                <Link href={`/recouvrement/clients/${entry.clientId}`} className="mt-1 block break-words text-sm font-semibold text-blue-700 hover:text-blue-800">{entry.client?.nom ?? "Client"}</Link>
                <p className="mt-2 text-sm font-bold tabular-nums text-slate-900">{formatMoney(entry.amount)}</p>
              </li>
            ))}
          </ol>
        ) : <EmptyState icon={UsersRound} title="Aucune créance ouverte" message="Les soldes clients apparaîtront ici." />}
      </Card>
    </div>
  );
}

function asDate(value: Document["dateEcheance"] | Paiement["dateEncaissementPrevue"] | Relance["date"]): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value < 1e11 ? value * 1000 : value);
  if (typeof value === "string") return new Date(value);
  if (value && "toDate" in value) return value.toDate();
  if (value && "seconds" in value) return new Date(value.seconds * 1000);
  return new Date(0);
}
