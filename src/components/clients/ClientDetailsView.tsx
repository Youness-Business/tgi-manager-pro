"use client";

import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Badge, Tabs } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useDocuments } from "@/context/DocumentsProvider";
import { useClients } from "@/context/FirestoreDataProvider";
import { useAscenseurs, useContrats } from "@/context/OperationsDataProvider";
import { useCreances } from "@/context/RecouvrementDataProvider";
import { computeDiscountedTotals } from "@/lib/computeDiscountedTotals";
import {
  documentsByClient,
  totalFacture,
} from "@/lib/clientStats";
import { formatMoney } from "@/lib/formatMoney";
import { formatSafeDate } from "@/lib/formatSafeDate";
import { documentTypeLabels } from "@/lib/documentLabels";
import { documentTimestamp } from "@/lib/documentTimestamp";
import { getContratStatut } from "@/lib/contractDates";
import { computeSolde, getRetardJours } from "@/lib/recouvrement";
import type { Document } from "@/types";

export function ClientDetailsView({ id }: { id: string }) {
  const { documents, loading: documentsLoading, error: documentsError } = useDocuments();
  const { items: clients, loading, error } = useClients();
  const { items: elevators, loading: elevatorsLoading, error: elevatorsError } = useAscenseurs();
  const { items: contracts, loading: contractsLoading, error: contractsError } = useContrats();
  const { documents: invoices, paiements, relances, loading: receivablesLoading, error: receivablesError } = useCreances();
  const [selectedTab, setSelectedTab] = useState("documents");
  const client = clients.find((item) => item.id === id);
  const clientDocuments = useMemo(
    () =>
      documentsByClient(id, documents).sort(
        (left, right) =>
          documentTimestamp(right.dateCreation) -
          documentTimestamp(left.dateCreation),
      ),
    [id, documents],
  );
  const clientElevators = useMemo(() => elevators.filter((item) => item.clientId === id), [elevators, id]);
  const clientContracts = useMemo(() => contracts.filter((item) => item.clientId === id), [contracts, id]);
  const clientInvoices = invoices.filter((invoice) => invoice.clientId === id);
  const clientBalance = clientInvoices.reduce((sum, invoice) => sum + computeSolde(invoice, paiements), 0);
  const overdueBalance = clientInvoices.reduce((sum, invoice) => (getRetardJours(invoice.dateEcheance) ?? 0) > 0 ? sum + computeSolde(invoice, paiements) : sum, 0);
  const latestReminder = [...relances].filter((reminder) => reminder.clientId === id).sort((a, b) => dateValue(b.date) - dateValue(a.date))[0];
  if (!client && !loading && !error) notFound();
  if (!client) {
    return (
      <p role={error || documentsError ? "alert" : "status"} className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
        {error ?? documentsError ?? (loading || documentsLoading ? "Chargement de la fiche client…" : "Client introuvable.")}
      </p>
    );
  }
  const columns: DataTableColumn<Document>[] = [
    {
      id: "numero",
      header: "Numéro",
      render: (document) => (
        <Link
          href={`/documents/${document.id}`}
          className="font-semibold text-blue-700 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <span className="break-all">{document.numero}</span>
        </Link>
      ),
    },
    {
      id: "type",
      header: "Type",
      render: (document) => documentTypeLabels[document.type],
    },
    {
      id: "date",
      header: "Date",
      render: (document) => (
        <span className="whitespace-nowrap">
          {formatSafeDate(document.dateCreation)}
        </span>
      ),
    },
    {
      id: "total",
      header: "Total TTC",
      align: "right",
      render: (document) => (
        <span className="whitespace-nowrap font-medium tabular-nums text-slate-900">
          {formatMoney(
            computeDiscountedTotals(
              document.lignes,
              document.remisePct,
            ).totalTTC,
          )}
        </span>
      ),
    },
    {
      id: "statut",
      header: "Statut",
      render: (document) => <StatusBadge status={document.statut} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.nom}
        description="Fiche client et historique des documents."
        actions={
          <Link
            href="/clients"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <ArrowLeft size={17} aria-hidden="true" />
            Retour aux clients
          </Link>
        }
      />

      <Card className="p-5 sm:p-6">
        <h2 className="text-base font-semibold text-slate-900">Coordonnées</h2>
        <dl className="mt-4 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-600">
              Société
            </dt>
            <dd className="mt-1 break-words text-sm font-medium text-slate-900">
              {client.nom}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-600">
              Adresse
            </dt>
            <dd className="mt-1 break-words text-sm text-slate-700">
              {client.adresse}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-600">
              Téléphone
            </dt>
            <dd className="mt-1 text-sm text-slate-700">
              <a
                href={`tel:${client.telephone.replaceAll(" ", "")}`}
                className="rounded-sm hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                {client.telephone}
              </a>
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-600">
              ICE
            </dt>
            <dd className="mt-1 break-words font-mono text-sm text-slate-700">
              {client.ice}
            </dd>
          </div>
        </dl>
      </Card>

      {error || documentsError || elevatorsError || contractsError || receivablesError ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error ?? documentsError ?? elevatorsError ?? contractsError ?? receivablesError}
        </p>
      ) : null}
      {selectedTab === "recouvrement" ? (
        <Card className="p-5 sm:p-6">
          {receivablesLoading ? <p role="status" className="text-sm text-slate-600">Chargement du recouvrement…</p> : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display font-bold text-slate-900">Situation de recouvrement</h2>
                <p className="mt-1 text-sm text-slate-600">Solde ouvert : <strong className="tabular-nums text-slate-900">{formatMoney(clientBalance)}</strong> · En retard : <strong className="tabular-nums text-red-700">{formatMoney(overdueBalance)}</strong></p>
                <p className="mt-1 text-xs text-slate-500">Dernière relance : {latestReminder ? formatSafeDate(latestReminder.date) : "Aucune"}</p>
              </div>
              <Link href={`/recouvrement/clients/${client.id}`} className="inline-flex min-h-10 items-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">Ouvrir le relevé de compte</Link>
            </div>
          )}
        </Card>
      ) : null}
      <Tabs
        tabs={[
          { id: "documents", label: `Documents (${clientDocuments.length})` },
          { id: "parc", label: `Parc et contrats (${clientElevators.length + clientContracts.length})` },
          { id: "recouvrement", label: `Recouvrement (${clientInvoices.length})` },
        ]}
        selected={selectedTab}
        onChange={setSelectedTab}
      />
      {selectedTab === "parc" ? (
        <section className="grid gap-5 xl:grid-cols-2">
          <Card className="overflow-hidden">
            <header className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-display font-bold text-slate-900">Ascenseurs du client</h2>
            </header>
            {elevatorsLoading ? <p role="status" className="p-5 text-sm text-slate-600">Chargement du parc…</p> : clientElevators.length ? (
              <ul className="divide-y divide-slate-100">
                {clientElevators.map((elevator) => (
                  <li key={elevator.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                      <Link href={`/parc/${elevator.id}`} className="break-words text-sm font-semibold text-blue-700 hover:text-blue-800">{elevator.marque} {elevator.modele} · {elevator.site}</Link>
                      <p className="mt-1 break-all font-mono text-xs text-slate-500">{elevator.numeroSerie}</p>
                    </div>
                    <Badge variant={elevator.statut === "en_service" ? "success" : elevator.statut === "en_panne" ? "danger" : "neutral"}>{elevator.statut.replaceAll("_", " ")}</Badge>
                  </li>
                ))}
              </ul>
            ) : <p className="p-5 text-sm text-slate-600">Aucun ascenseur associé à ce client.</p>}
          </Card>
          <Card className="overflow-hidden">
            <header className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-display font-bold text-slate-900">Contrats du client</h2>
            </header>
            {contractsLoading ? <p role="status" className="p-5 text-sm text-slate-600">Chargement des contrats…</p> : clientContracts.length ? (
              <ul className="divide-y divide-slate-100">
                {clientContracts.map((contract) => {
                  const status = getContratStatut(contract);
                  return <li key={contract.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                      <Link href={`/contrats/${contract.id}`} className="font-semibold text-blue-700 hover:text-blue-800">{contract.numero}</Link>
                      <p className="mt-1 text-xs text-slate-500">{formatSafeDate(contract.dateDebut)} – {formatSafeDate(contract.dateFin)} · {formatMoney(contract.montantHT)} HT</p>
                    </div>
                    <Badge variant={status === "actif" ? "success" : status === "expire" ? "neutral" : status === "brouillon" ? "warning" : "danger"}>{status}</Badge>
                  </li>;
                })}
              </ul>
            ) : <p className="p-5 text-sm text-slate-600">Aucun contrat associé à ce client.</p>}
          </Card>
        </section>
      ) : selectedTab === "documents" ? (
      <>
      <section
        aria-label="Indicateurs client"
        className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3"
      >
        <StatCard
          label="Total facturé TTC"
          value={formatMoney(totalFacture(client.id, documents))}
          detail="Factures émises, hors annulations"
          icon={FileText}
          iconClassName="bg-blue-50 text-blue-700"
        />
        <StatCard
          label="Impayés TTC"
          value={formatMoney(clientBalance)}
          detail="Factures en attente de règlement"
          icon={FileText}
          iconClassName="bg-amber-50 text-amber-700"
        />
        <StatCard
          label="Documents"
          value={String(clientDocuments.length)}
          detail="Factures, devis, reçus et livraisons"
          icon={FileText}
          iconClassName="bg-emerald-50 text-emerald-700"
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Historique des documents
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Documents associés à {client.nom}.
          </p>
        </div>
        {clientDocuments.length ? (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <DataTable
              caption={`Historique des documents de ${client.nom}`}
              columns={columns}
              rows={clientDocuments}
              getRowKey={(document) => document.id}
              minWidthClassName="min-w-[720px]"
            />
          </div>
        ) : (
          <EmptyState
            icon={FileText}
            title="Aucun document"
            message="Aucun document n’a encore été émis pour ce client."
          />
        )}
      </section>
      </>
      ) : null}
    </div>
  );
}

function dateValue(value: import("@/types").DateInput): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value < 1e11 ? value * 1000 : value;
  if (typeof value === "string") return Date.parse(value);
  if (value && "toDate" in value) return value.toDate().getTime();
  if (value && "seconds" in value) return value.seconds * 1000;
  return 0;
}
