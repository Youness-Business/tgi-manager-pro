"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { DocumentRenderer } from "@/components/documents/DocumentRenderer";
import { useDocuments } from "@/context/DocumentsProvider";
import { useClients } from "@/context/FirestoreDataProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { applyDocumentStockMovement } from "@/lib/stockTransactions";
import { can } from "@/lib/permissions";
import { PaymentDialog } from "@/components/recouvrement/PaymentDialog";
import { usePaiements } from "@/context/RecouvrementDataProvider";
import { computeDiscountedTotals } from "@/lib/computeDiscountedTotals";
import { computeSolde, getDocumentStatut } from "@/lib/recouvrement";
import { formatMoney } from "@/lib/formatMoney";
import { formatSafeDate } from "@/lib/formatSafeDate";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { changerStatutPaiement } from "@/lib/recouvrementTransactions";

export function DocumentDetails({ id }: { id: string }) {
  const { role, user, profile } = useAuth();
  const { showToast } = useToast();
  const [validatingDelivery, setValidatingDelivery] = useState(false);
  const [stockError, setStockError] = useState("");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentActionError, setPaymentActionError] = useState("");
  const [updatingPaymentId, setUpdatingPaymentId] = useState("");
  const { documents, loading, error } = useDocuments();
  const { items: payments, loading: paymentsLoading, error: paymentsError } = usePaiements();
  const { items: clients, loading: clientsLoading, error: clientsError } = useClients();
  const online = useOnlineStatus();
  const document = documents.find((item) => item.id === id);
  const client = document
    ? clients.find((item) => item.id === document.clientId)
    : undefined;
  if ((!document || !client) && !loading && !clientsLoading && !error && !clientsError) {
    if (role === "commercial") {
      return (
        <section
          role="alert"
          className="mx-auto max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-center"
        >
          <h1 className="text-lg font-semibold text-slate-900">Accès refusé</h1>
          <p className="mt-2 text-sm text-slate-700">
            Ce document n’existe pas ou ne vous appartient pas.
          </p>
        </section>
      );
    }
    notFound();
  }
  if (!document || !client) {
    return (
      <p
        role={error || clientsError ? "alert" : "status"}
        className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-slate-700 shadow-sm print:hidden"
      >
        {error ?? clientsError ?? "Chargement du document…"}
      </p>
    );
  }

  const invoicePayments = payments.filter((payment) => payment.documentId === document.id);
  const totalTTC = computeDiscountedTotals(document.lignes, document.remisePct).totalTTC;
  const balance = document.type === "facture" ? computeSolde(document, payments) : 0;
  const paid = Math.max(0, totalTTC - balance);
  const displayedDocument = document.type === "facture"
    ? { ...document, statut: getDocumentStatut(document, payments) }
    : document;

  return (
    <div className="space-y-5 print:space-y-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/documents"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          Retour aux documents
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {document.type === "bon_livraison" &&
          can(role, "update", "stock") ? (
            document.stockApplied ? (
              <span className="inline-flex min-h-10 items-center rounded-xl bg-emerald-50 px-4 text-sm font-semibold text-emerald-800">
                Stock décompté
              </span>
            ) : (
              <button
                type="button"
                disabled={validatingDelivery}
                onClick={async () => {
                  if (!user || !window.confirm("Valider cette livraison et décompter les produits du stock ?")) {
                    return;
                  }
                  setValidatingDelivery(true);
                  setStockError("");
                  try {
                    await applyDocumentStockMovement(
                      document.id,
                      user.uid,
                      profile?.nom,
                    );
                    showToast("Livraison validée", "Le stock a été décompté.");
                  } catch (error) {
                    setStockError(
                      error instanceof Error
                        ? error.message
                        : "La livraison n’a pas pu être validée.",
                    );
                  } finally {
                    setValidatingDelivery(false);
                  }
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-800 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-60"
              >
                {validatingDelivery ? "Validation…" : "Valider la livraison"}
              </button>
            )
          ) : null}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <Printer size={17} aria-hidden="true" />
            Imprimer / Exporter PDF
          </button>
        </div>
      </div>
      {stockError ? (
        <p role="alert" className="print:hidden rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {stockError}
        </p>
      ) : null}
      {document.type === "facture" ? (
        <section aria-label="Suivi du paiement de la facture" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card print:hidden">
          {paymentsError ? <p role="alert" className="mb-3 text-sm text-red-800">{paymentsError}</p> : null}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-display font-bold text-slate-900">Paiements et solde</h2>
              <p className="mt-1 text-sm text-slate-600">Échéance : {formatSafeDate(document.dateEcheance)}</p>
            </div>
            {can(role, "recordPayment", "payments") && balance > 0 ? (
              <button type="button" disabled={!online || paymentsLoading} onClick={() => setPaymentDialogOpen(true)} title={online ? undefined : "Les paiements ne sont pas disponibles hors ligne"} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                {online ? "Enregistrer un paiement" : "Indisponible hors ligne"}
              </button>
            ) : null}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <p className="text-sm text-slate-600">TTC <strong className="ml-1 tabular-nums text-slate-900">{formatMoney(totalTTC)}</strong></p>
            <p className="text-sm text-slate-600">Payé <strong className="ml-1 tabular-nums text-emerald-700">{formatMoney(paid)}</strong></p>
            <p className="text-sm text-slate-600">Solde <strong className="ml-1 tabular-nums text-slate-900">{formatMoney(balance)}</strong></p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Progression du paiement" aria-valuenow={totalTTC > 0 ? Math.round((paid / totalTTC) * 100) : 0} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${totalTTC > 0 ? Math.min(100, paid / totalTTC * 100) : 0}%` }} />
          </div>
          {paymentActionError ? <p role="alert" className="mt-3 text-sm text-red-800">{paymentActionError}</p> : null}
          {invoicePayments.length ? (
            <ul className="mt-4 divide-y divide-slate-100">
              {invoicePayments.map((payment) => (
                <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0 break-words text-slate-700">{formatSafeDate(payment.date)} · {payment.reference} · {payment.statut}</span>
                  <span className="flex items-center gap-3">
                    <strong className="whitespace-nowrap tabular-nums text-slate-900">{formatMoney(payment.montant)}</strong>
                    {role === "owner" && payment.statut !== "annule" ? <button type="button" disabled={!online || updatingPaymentId === payment.id} onClick={async () => {
                      const reason = window.prompt("Motif obligatoire de l’annulation du paiement :");
                      if (!reason?.trim() || !user) return;
                      setUpdatingPaymentId(payment.id);
                      setPaymentActionError("");
                      try {
                        await changerStatutPaiement(payment, "annule", user.uid, role, reason);
                        showToast("Paiement annulé", "Le solde de la facture a été recalculé.");
                      } catch (actionError) {
                        setPaymentActionError(actionError instanceof Error ? actionError.message : "L’annulation a échoué.");
                      } finally {
                        setUpdatingPaymentId("");
                      }
                    }} className="text-xs font-semibold text-red-700 underline disabled:opacity-50">Annuler</button> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : !paymentsLoading ? <p className="mt-3 text-sm text-slate-600">Aucun paiement enregistré.</p> : null}
        </section>
      ) : null}
      <div className="min-w-0 overflow-x-auto print:overflow-visible">
        <DocumentRenderer document={displayedDocument} client={client} />
      </div>
      {paymentDialogOpen ? <PaymentDialog open document={document} client={client} balance={balance} onClose={() => setPaymentDialogOpen(false)} /> : null}
    </div>
  );
}
