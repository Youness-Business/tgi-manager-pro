"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Printer, Wallet } from "lucide-react";
import { PaymentDialog } from "@/components/recouvrement/PaymentDialog";
import { ReminderDialog } from "@/components/recouvrement/ReminderDialog";
import { ReleveCompte } from "@/components/recouvrement/PrintRecouvrementDocuments";
import { Card } from "@/components/ui/Card";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Button, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/ToastProvider";
import { useAuth } from "@/context/AuthProvider";
import { useClients } from "@/context/FirestoreDataProvider";
import { useCreances } from "@/context/RecouvrementDataProvider";
import { computeDiscountedTotals } from "@/lib/computeDiscountedTotals";
import { saveClientCreditTerms } from "@/lib/clientCredit";
import { can } from "@/lib/permissions";
import { formatMoney } from "@/lib/formatMoney";
import { formatSafeDate } from "@/lib/formatSafeDate";
import { computeSolde, getDocumentStatut, getRetardJours } from "@/lib/recouvrement";
import type { Document } from "@/types";

export function ClientReceivables({ id }: { id: string }) {
  const { items: clients, loading: clientsLoading, error: clientsError } = useClients();
  const { documents, paiements, relances, loading, error } = useCreances();
  const { role } = useAuth();
  const { showToast } = useToast();
  const client = clients.find((item) => item.id === id);
  const [paymentInvoice, setPaymentInvoice] = useState<Document | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [editCredit, setEditCredit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [delay, setDelay] = useState(String(client?.delaiPaiementJours ?? 30));
  const [creditLimit, setCreditLimit] = useState(
    client?.limiteCredit === undefined ? "" : String(client.limiteCredit),
  );
  const [notes, setNotes] = useState(client?.notesRecouvrement ?? "");
  const canEditCredit = can(role, "manageCredit", "clients");
  const clientInvoices = useMemo(
    () => documents.filter((document) => document.type === "facture" && document.clientId === id),
    [documents, id],
  );
  const balance = clientInvoices.reduce((sum, invoice) => sum + computeSolde(invoice, paiements), 0);
  const overdueBalance = clientInvoices.reduce((sum, invoice) =>
    (getRetardJours(invoice.dateEcheance) ?? 0) > 0
      ? sum + computeSolde(invoice, paiements)
      : sum,
  0);
  const openInvoices = clientInvoices.filter((invoice) => computeSolde(invoice, paiements) > 0);
  const clientPayments = paiements.filter((payment) => payment.clientId === id);
  const clientReminders = relances.filter((reminder) => reminder.clientId === id);

  if (clientsLoading || loading) {
    return <p role="status" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Chargement du relevé client…</p>;
  }
  if (clientsError || error) {
    return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{clientsError ?? error}</p>;
  }
  if (!client) return <p role="alert" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">Client introuvable.</p>;

  const invoiceColumns: DataTableColumn<Document>[] = [
    { id: "number", header: "Facture", render: (invoice) => <Link href={`/documents/${invoice.id}`} className="break-all font-semibold text-blue-700 hover:text-blue-800">{invoice.numero}</Link> },
    { id: "due", header: "Échéance", render: (invoice) => formatSafeDate(invoice.dateEcheance) },
    { id: "late", header: "Retard", align: "right", render: (invoice) => `${getRetardJours(invoice.dateEcheance) ?? 0} j` },
    { id: "total", header: "TTC", align: "right", render: (invoice) => formatMoney(computeDiscountedTotals(invoice.lignes, invoice.remisePct).totalTTC) },
    { id: "balance", header: "Solde", align: "right", render: (invoice) => <span className="font-semibold tabular-nums">{formatMoney(computeSolde(invoice, paiements))}</span> },
    { id: "status", header: "Statut", render: (invoice) => getDocumentStatut(invoice, paiements) === "partiel" ? "Partiel" : getDocumentStatut(invoice, paiements) === "paye" ? "Payé" : "En attente" },
    { id: "action", header: "Action", render: (invoice) => can(role, "recordPayment", "payments") && computeSolde(invoice, paiements) > 0 ? <Button type="button" size="sm" onClick={() => setPaymentInvoice(invoice)} aria-label={`Enregistrer un paiement pour ${invoice.numero}`}><Wallet size={15} aria-hidden="true" /> Paiement</Button> : "—" },
  ];

  async function saveCredit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) {
      setFormError("Client introuvable.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await saveClientCreditTerms(client.id, {
        delaiPaiementJours: Number(delay),
        ...(creditLimit !== "" ? { limiteCredit: Number(creditLimit) } : {}),
        notesRecouvrement: notes,
      });
      setEditCredit(false);
      showToast("Paramètres de crédit enregistrés");
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "La sauvegarde a échoué.");
    } finally {
      setSaving(false);
    }
  }

  function toggleCreditEditor() {
    if (!editCredit && client) {
      setDelay(String(client.delaiPaiementJours ?? 30));
      setCreditLimit(client.limiteCredit === undefined ? "" : String(client.limiteCredit));
      setNotes(client.notesRecouvrement ?? "");
    }
    setEditCredit((value) => !value);
  }

  return (
    <>
      <div className="print:hidden space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-blue-700">Relevé de compte</p>
            <h1 className="mt-1 break-words font-display text-3xl font-bold text-slate-950">{client.nom}</h1>
            <p className="mt-2 text-sm text-slate-600">Factures, règlements et promesses de paiement.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/recouvrement/creances" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><ArrowLeft size={16} aria-hidden="true" /> Retour</Link>
            <Button type="button" variant="secondary" onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> Imprimer le relevé</Button>
            <Button type="button" variant="secondary" onClick={() => setReminderOpen(true)} disabled={!openInvoices.length}>Nouvelle relance</Button>
          </div>
        </header>
        {client.limiteCredit !== undefined && balance > client.limiteCredit ? (
          <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-900">
            Limite de crédit dépassée : solde {formatMoney(balance)} pour une limite de {formatMoney(client.limiteCredit)}.
          </p>
        ) : null}
        <section className="grid gap-4 sm:grid-cols-3">
          <Card className="p-5"><p className="text-sm text-slate-600">Solde total</p><p className="mt-2 font-display text-2xl font-bold tabular-nums text-slate-950">{formatMoney(balance)}</p></Card>
          <Card className="p-5"><p className="text-sm text-slate-600">Solde en retard</p><p className="mt-2 font-display text-2xl font-bold tabular-nums text-red-700">{formatMoney(overdueBalance)}</p></Card>
          <Card className="p-5"><p className="text-sm text-slate-600">Factures ouvertes</p><p className="mt-2 font-display text-2xl font-bold tabular-nums text-slate-950">{openInvoices.length}</p></Card>
        </section>
        <Card className="overflow-hidden">
          <header className="border-b border-slate-100 px-5 py-4"><h2 className="font-display font-bold text-slate-900">Factures et échéances</h2></header>
          {clientInvoices.length ? <DataTable caption={`Créances de ${client.nom}`} columns={invoiceColumns} rows={clientInvoices} getRowKey={(invoice) => invoice.id} minWidthClassName="min-w-[900px]" /> : <EmptyState icon={FileText} title="Aucune facture" message="Les factures du client apparaîtront ici." />}
        </Card>
        <div className="grid gap-5 xl:grid-cols-2">
          <Card className="p-5 sm:p-6">
            <h2 className="font-display font-bold text-slate-900">Paiements</h2>
            {clientPayments.length ? <ul className="mt-3 divide-y divide-slate-100">{clientPayments.map((payment) => <li key={payment.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{payment.reference} · {formatSafeDate(payment.date)} · {payment.statut}</span><span className="font-semibold tabular-nums">{formatMoney(payment.montant)}</span></li>)}</ul> : <p className="mt-3 text-sm text-slate-600">Aucun paiement enregistré.</p>}
          </Card>
          <Card className="p-5 sm:p-6">
            <h2 className="font-display font-bold text-slate-900">Relances et promesses</h2>
            {clientReminders.length ? <ol className="mt-3 space-y-3">{[...clientReminders].sort((a, b) => dateValue(b.date) - dateValue(a.date)).map((reminder) => <li key={reminder.id} className="relative border-l-2 border-blue-200 pl-4"><span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-blue-600" /><p className="text-xs font-semibold text-slate-500">{formatSafeDate(reminder.date)} · niveau {reminder.niveau} · {reminder.canal}</p><p className="mt-1 whitespace-pre-line text-sm text-slate-800">{reminder.note}</p>{reminder.promessePaiementDate ? <p className="mt-1 text-xs text-amber-800">Promesse : {formatSafeDate(reminder.promessePaiementDate)}{reminder.promesseMontant ? ` · ${formatMoney(reminder.promesseMontant)}` : ""}</p> : null}</li>)}</ol> : <p className="mt-3 text-sm text-slate-600">Aucune relance enregistrée.</p>}
          </Card>
        </div>
        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="font-display font-bold text-slate-900">Conditions de crédit et notes</h2><p className="mt-1 text-sm text-slate-600">Délai : {client.delaiPaiementJours ?? 30} jours · Limite : {client.limiteCredit === undefined ? "non définie" : formatMoney(client.limiteCredit)}</p></div>
            {canEditCredit ? <Button type="button" variant="secondary" onClick={toggleCreditEditor}>{editCredit ? "Fermer" : "Modifier"}</Button> : null}
          </div>
          {editCredit ? <form onSubmit={saveCredit} className="mt-4 space-y-4">{formError ? <p role="alert" className="text-sm text-red-800">{formError}</p> : null}<div className="grid gap-4 sm:grid-cols-2"><Field id="credit-delay" label="Délai de paiement (jours)"><Input id="credit-delay" type="number" min="0" max="365" step="1" value={delay} onChange={(event) => setDelay(event.target.value)} required /></Field><Field id="credit-limit" label="Limite de crédit (MAD)"><Input id="credit-limit" type="number" min="0" step="0.01" value={creditLimit} onChange={(event) => setCreditLimit(event.target.value)} /></Field></div><Field id="credit-notes" label="Notes de recouvrement"><Textarea id="credit-notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></Field><Button type="submit" loading={saving}>Enregistrer</Button></form> : <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{client.notesRecouvrement || "Aucune note de recouvrement."}</p>}
        </Card>
      </div>
      <div className="hidden print:block">
        <ReleveCompte client={client} invoices={clientInvoices} payments={paiements} reminders={clientReminders} balance={balance} />
      </div>
      {paymentInvoice ? <PaymentDialog key={paymentInvoice.id} open document={paymentInvoice} client={client} balance={computeSolde(paymentInvoice, paiements)} onClose={() => setPaymentInvoice(null)} /> : null}
      {reminderOpen && openInvoices.length ? <ReminderDialog open client={client} invoices={openInvoices} initialInvoiceId={openInvoices[0].id} suggestedLevel={1} totalDue={balance} onClose={() => setReminderOpen(false)} /> : null}
    </>
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
