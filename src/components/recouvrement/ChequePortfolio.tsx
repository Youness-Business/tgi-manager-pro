"use client";

import { useState } from "react";
import { Banknote, CheckCircle2, Landmark, TriangleAlert } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/ToastProvider";
import { useAuth } from "@/context/AuthProvider";
import { useClients } from "@/context/FirestoreDataProvider";
import { usePaiements } from "@/context/RecouvrementDataProvider";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { can } from "@/lib/permissions";
import { formatMoney } from "@/lib/formatMoney";
import { formatSafeDate } from "@/lib/formatSafeDate";
import { changerStatutPaiement } from "@/lib/recouvrementTransactions";
import type { Paiement, PaymentStatus } from "@/types";

const labels: Record<PaymentStatus, string> = {
  valide: "Validé",
  en_portefeuille: "En portefeuille",
  remis_banque: "Remis en banque",
  encaisse: "Encaissé",
  impaye: "Impayé",
  annule: "Annulé",
};

export function ChequePortfolio() {
  const { items: payments, loading, error } = usePaiements();
  const { items: clients, error: clientsError } = useClients();
  const { role, user } = useAuth();
  const { showToast } = useToast();
  const online = useOnlineStatus();
  const [busyId, setBusyId] = useState("");
  const [actionError, setActionError] = useState("");
  const mayManage = can(role, "manageCheque", "payments");
  const cheques = payments
    .filter((payment) => payment.mode === "cheque" || payment.mode === "effet")
    .sort((left, right) => dateValue(left.dateEncaissementPrevue) - dateValue(right.dateEncaissementPrevue));

  async function changeStatus(payment: Paiement, status: PaymentStatus) {
    if (!user || !role || !online) return;
    if (!window.confirm(`Confirmer le changement du paiement ${payment.reference} vers « ${labels[status]} » ?`)) return;
    setBusyId(payment.id);
    setActionError("");
    try {
      await changerStatutPaiement(payment, status, user.uid, role);
      showToast("Statut mis à jour", `${payment.reference} · ${labels[status]}`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Le statut n’a pas pu être modifié.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Chèques et effets" description="Échéancier des paiements différés et suivi de leur encaissement." />
      {error || clientsError || actionError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error ?? clientsError ?? actionError}</p> : null}
      {!online ? <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Actions indisponibles hors ligne.</p> : null}
      {loading ? <p role="status" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Chargement du portefeuille…</p> : cheques.length ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <DataTable
            caption="Portefeuille de chèques et effets"
            columns={columns({
              clients,
              mayManage,
              online,
              busyId,
              changeStatus,
            })}
            rows={cheques}
            getRowKey={(payment) => payment.id}
            minWidthClassName="min-w-[900px]"
          />
        </div>
      ) : <EmptyState icon={Banknote} title="Portefeuille vide" message="Les chèques et effets enregistrés apparaîtront ici." />}
    </div>
  );
}

function columns(options: {
  clients: ReturnType<typeof useClients>["items"];
  mayManage: boolean;
  online: boolean;
  busyId: string;
  changeStatus: (payment: Paiement, status: PaymentStatus) => Promise<void>;
}): DataTableColumn<Paiement>[] {
  return [
    { id: "reference", header: "Référence", render: (payment) => <span className="break-all font-semibold text-slate-900">{payment.reference}</span> },
    { id: "client", header: "Client", render: (payment) => options.clients.find((client) => client.id === payment.clientId)?.nom ?? "Client" },
    { id: "bank", header: "Banque", render: (payment) => payment.banque ?? (payment.mode === "effet" ? "Effet" : "—") },
    { id: "planned", header: "Échéance d’encaissement", render: (payment) => payment.dateEncaissementPrevue ? formatSafeDate(payment.dateEncaissementPrevue) : "—" },
    { id: "amount", header: "Montant", align: "right", render: (payment) => <span className="whitespace-nowrap font-semibold tabular-nums">{formatMoney(payment.montant)}</span> },
    { id: "status", header: "Statut", render: (payment) => <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${payment.statut === "impaye" ? "bg-red-100 text-red-800" : payment.statut === "encaisse" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{labels[payment.statut]}</span> },
    { id: "actions", header: "Actions", render: (payment) => {
      if (!options.mayManage || !options.online) return <span className="text-xs text-slate-500">{options.online ? "Lecture seule" : "Hors ligne"}</span>;
      const actions: { label: string; status: PaymentStatus; icon: typeof Landmark }[] =
        payment.statut === "en_portefeuille"
          ? [{ label: "Remettre en banque", status: "remis_banque", icon: Landmark }, { label: "Marquer encaissé", status: "encaisse", icon: CheckCircle2 }, { label: "Marquer impayé", status: "impaye", icon: TriangleAlert }]
          : payment.statut === "remis_banque"
            ? [{ label: "Marquer encaissé", status: "encaisse", icon: CheckCircle2 }, { label: "Marquer impayé", status: "impaye", icon: TriangleAlert }]
            : [];
      return <div className="flex flex-wrap gap-1">{actions.map(({ label, status, icon: Icon }) => <Button key={status} type="button" size="sm" disabled={options.busyId === payment.id} aria-label={`${label} : ${payment.reference}`} onClick={() => void options.changeStatus(payment, status)}><Icon size={14} aria-hidden="true" />{label}</Button>)}</div>;
    } },
  ];
}

function dateValue(value: Paiement["dateEncaissementPrevue"]): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value < 1e11 ? value * 1000 : value;
  if (typeof value === "string") return Date.parse(value);
  if (value && "toDate" in value) return value.toDate().getTime();
  if (value && "seconds" in value) return value.seconds * 1000;
  return Number.MAX_SAFE_INTEGER;
}
