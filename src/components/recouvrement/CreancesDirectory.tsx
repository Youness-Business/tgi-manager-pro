"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CircleDollarSign, Download, MessageSquareText, Wallet } from "lucide-react";
import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/primitives";
import { PaymentDialog } from "@/components/recouvrement/PaymentDialog";
import { ReminderDialog } from "@/components/recouvrement/ReminderDialog";
import { useAuth } from "@/context/AuthProvider";
import { useClients } from "@/context/FirestoreDataProvider";
import { useCreances } from "@/context/RecouvrementDataProvider";
import { computeDiscountedTotals } from "@/lib/computeDiscountedTotals";
import { formatMoney } from "@/lib/formatMoney";
import { formatSafeDate } from "@/lib/formatSafeDate";
import { normalizeSearch } from "@/lib/normalizeSearch";
import { computeSolde, getDocumentStatut, getRetardJours, getTrancheAge, isPromesseNonTenue, suggestRelanceNiveau } from "@/lib/recouvrement";
import { can } from "@/lib/permissions";
import type { Document } from "@/types";

type Props = {
  initialQuery: string;
  initialTranche: string;
  initialClient: string;
  initialStatus: string;
  initialPromise: boolean;
};

function csvCell(value: string | number): string {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function CreancesDirectory({
  initialQuery,
  initialTranche,
  initialClient,
  initialStatus,
  initialPromise,
}: Props) {
  const { documents, paiements, relances, loading, error } = useCreances();
  const { items: clients, error: clientsError } = useClients();
  const { role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(initialQuery);
  const [tranche, setTranche] = useState(initialTranche);
  const [clientId, setClientId] = useState(initialClient);
  const [status, setStatus] = useState(initialStatus);
  const [promiseOnly, setPromiseOnly] = useState(initialPromise);
  const [paymentInvoice, setPaymentInvoice] = useState<Document | null>(null);
  const [reminderInvoice, setReminderInvoice] = useState<Document | null>(null);
  const mayRecordPayment = can(role, "recordPayment", "payments");

  function updateFilters(next: Partial<{
    search: string;
    tranche: string;
    clientId: string;
    status: string;
    promiseOnly: boolean;
  }>) {
    const values = {
      search: next.search ?? search,
      tranche: next.tranche ?? tranche,
      clientId: next.clientId ?? clientId,
      status: next.status ?? status,
      promiseOnly: next.promiseOnly ?? promiseOnly,
    };
    setSearch(values.search);
    setTranche(values.tranche);
    setClientId(values.clientId);
    setStatus(values.status);
    setPromiseOnly(values.promiseOnly);
    const params = new URLSearchParams();
    if (values.search) params.set("q", values.search);
    if (values.tranche) params.set("tranche", values.tranche);
    if (values.clientId) params.set("client", values.clientId);
    if (values.status) params.set("statut", values.status);
    if (values.promiseOnly) params.set("promesse", "1");
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }

  const rows = useMemo(() => documents
    .filter((document) => document.type === "facture" && document.statut !== "annule")
    .map((document) => {
      const client = clients.find((item) => item.id === document.clientId);
      const balance = computeSolde(document, paiements);
      const due = document.dateEcheance;
      const overdueDays = getRetardJours(due);
      const age = getTrancheAge(overdueDays);
      const reminderList = relances.filter((reminder) => reminder.documentIds.includes(document.id));
      const latestReminder = [...reminderList].sort((a, b) =>
        dateValue(b.date) - dateValue(a.date),
      )[0];
      const hasBrokenPromise = reminderList.some((reminder) =>
        isPromesseNonTenue(reminder, paiements),
      );
      return {
        document,
        clientName: client?.nom ?? "Client",
        balance,
        total: computeDiscountedTotals(document.lignes, document.remisePct).totalTTC,
        paid: Math.max(0, computeDiscountedTotals(document.lignes, document.remisePct).totalTTC - balance),
        age,
        overdueDays: overdueDays ?? 0,
        latestReminder,
        hasBrokenPromise,
        status: getDocumentStatut(document, paiements),
      };
    })
    .filter((row) => row.balance > 0.005)
    .filter((row) => !tranche || row.age === tranche)
    .filter((row) => !clientId || row.document.clientId === clientId)
    .filter((row) => !status || row.status === status)
    .filter((row) => !promiseOnly || row.hasBrokenPromise)
    .filter((row) => {
      const needle = normalizeSearch(search);
      return !needle || normalizeSearch(`${row.document.numero} ${row.clientName}`).includes(needle);
    })
    .sort((left, right) => right.overdueDays - left.overdueDays), [
      clientId, clients, documents, paiements, promiseOnly, relances, search, status, tranche,
    ]);

  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    {
      id: "number",
      header: "Facture",
      render: (row) => <Link href={`/documents/${row.document.id}`} className="break-all font-semibold text-blue-700 hover:text-blue-800">{row.document.numero}</Link>,
    },
    {
      id: "client",
      header: "Client",
      render: (row) => <Link href={`/recouvrement/clients/${row.document.clientId}`} className="break-words font-medium text-slate-900 hover:text-blue-700">{row.clientName}</Link>,
    },
    {
      id: "due",
      header: "Échéance",
      render: (row) => <span className="whitespace-nowrap">{formatSafeDate(row.document.dateEcheance)}</span>,
    },
    {
      id: "late",
      header: "Retard",
      align: "right",
      render: (row) => row.overdueDays > 0 ? <span className="font-semibold tabular-nums text-red-700">{row.overdueDays} j</span> : <span className="text-slate-600">À venir</span>,
    },
    {
      id: "total",
      header: "TTC",
      align: "right",
      render: (row) => <span className="whitespace-nowrap tabular-nums">{formatMoney(row.total)}</span>,
    },
    {
      id: "paid",
      header: "Payé",
      align: "right",
      render: (row) => <span className="whitespace-nowrap tabular-nums">{formatMoney(row.paid)}</span>,
    },
    {
      id: "balance",
      header: "Solde",
      align: "right",
      render: (row) => <span className="whitespace-nowrap font-bold tabular-nums text-slate-900">{formatMoney(row.balance)}</span>,
    },
    {
      id: "age",
      header: "Tranche",
      render: (row) => <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${row.age === "non_echue" ? "bg-blue-50 text-blue-800" : "bg-red-50 text-red-800"}`}>{row.age === "non_echue" ? "Non échue" : `${row.age} j`}</span>,
    },
    {
      id: "reminder",
      header: "Dernière relance",
      render: (row) => row.latestReminder ? <span className="whitespace-nowrap">{formatSafeDate(row.latestReminder.date)}</span> : "Aucune",
    },
    {
      id: "actions",
      header: "Actions",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {mayRecordPayment ? <Button type="button" size="sm" aria-label={`Enregistrer un paiement pour ${row.document.numero}`} onClick={() => setPaymentInvoice(row.document)}><Wallet size={15} aria-hidden="true" /> Paiement</Button> : null}
          <Button type="button" variant="ghost" size="sm" aria-label={`Créer une relance pour ${row.document.numero}`} onClick={() => setReminderInvoice(row.document)}><MessageSquareText size={15} aria-hidden="true" /> Relancer</Button>
        </div>
      ),
    },
  ];

  function exportCsv() {
    const csvRows = [
      ["Facture", "Client", "Échéance", "Retard (jours)", "TTC", "Payé", "Solde", "Tranche", "Dernière relance"],
      ...rows.map((row) => [
        row.document.numero,
        row.clientName,
        formatSafeDate(row.document.dateEcheance),
        row.overdueDays,
        row.total,
        row.paid,
        row.balance,
        row.age,
        row.latestReminder ? formatSafeDate(row.latestReminder.date) : "",
      ]),
    ];
    const blob = new Blob(["\uFEFF", csvRows.map((row) => row.map(csvCell).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = "creances-tgi.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const paymentClient = paymentInvoice ? clients.find((client) => client.id === paymentInvoice.clientId) : undefined;
  const reminderClient = reminderInvoice ? clients.find((client) => client.id === reminderInvoice.clientId) : undefined;
  const reminderRow = reminderInvoice ? rows.find((row) => row.document.id === reminderInvoice.id) : undefined;

  return (
    <div className="space-y-5">
      {error || clientsError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error ?? clientsError}</p> : null}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:grid-cols-2 xl:grid-cols-5">
        <label className="min-w-0">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Rechercher</span>
          <input type="search" value={search} onChange={(event) => updateFilters({ search: event.target.value })} placeholder="Facture ou client…" className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus-visible:outline-2 focus-visible:outline-blue-600" />
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Tranche d’âge</span>
          <select value={tranche} onChange={(event) => updateFilters({ tranche: event.target.value })} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-blue-600">
            <option value="">Toutes</option><option value="non_echue">Non échue</option><option value="1-30">1–30 jours</option><option value="31-60">31–60 jours</option><option value="61-90">61–90 jours</option><option value="90+">Plus de 90 jours</option>
          </select>
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Client</span>
          <select value={clientId} onChange={(event) => updateFilters({ clientId: event.target.value })} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-blue-600">
            <option value="">Tous les clients</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.nom}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Statut</span>
          <select value={status} onChange={(event) => updateFilters({ status: event.target.value })} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-blue-600">
            <option value="">Tous</option><option value="en_attente">En attente</option><option value="partiel">Partiellement payé</option>
          </select>
        </label>
        <div className="flex items-end gap-3">
          <label className="flex min-h-11 flex-1 items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={promiseOnly} onChange={(event) => updateFilters({ promiseOnly: event.target.checked })} className="h-4 w-4 accent-blue-600" />
            Promesse non tenue
          </label>
          <Button type="button" variant="secondary" aria-label="Exporter les créances en CSV" onClick={exportCsv} disabled={loading}><Download size={16} aria-hidden="true" /> CSV</Button>
        </div>
      </div>
      {loading ? <p role="status" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Chargement des créances…</p> : rows.length ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <DataTable caption="Factures et soldes à recouvrer" columns={columns} rows={rows} getRowKey={(row) => row.document.id} minWidthClassName="min-w-[1240px]" />
        </div>
      ) : <EmptyState icon={CircleDollarSign} title="Aucune créance trouvée" message="Aucune facture impayée ne correspond aux filtres sélectionnés." />}
      {paymentInvoice && paymentClient ? <PaymentDialog key={paymentInvoice.id} open document={paymentInvoice} client={paymentClient} balance={computeSolde(paymentInvoice, paiements)} onClose={() => setPaymentInvoice(null)} /> : null}
      {reminderInvoice && reminderClient ? <ReminderDialog key={reminderInvoice.id} open client={reminderClient} invoices={[reminderInvoice]} initialInvoiceId={reminderInvoice.id} suggestedLevel={suggestRelanceNiveau(reminderRow?.overdueDays ?? 1, relances, paiements) ?? 1} totalDue={reminderRow?.balance ?? 0} onClose={() => setReminderInvoice(null)} /> : null}
    </div>
  );
}

function dateValue(value: Document["dateEcheance"]): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value < 1e11 ? value * 1000 : value;
  if (typeof value === "string") return Date.parse(value);
  if (value && "toDate" in value) return value.toDate().getTime();
  if (value && "seconds" in value) return value.seconds * 1000;
  return 0;
}
