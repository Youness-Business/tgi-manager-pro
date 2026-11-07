"use client";

import { FilePlus2, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useDocuments } from "@/context/DocumentsProvider";
import { usePaiements } from "@/context/RecouvrementDataProvider";
import { useClients } from "@/context/FirestoreDataProvider";
import { computeDiscountedTotals } from "@/lib/computeDiscountedTotals";
import { formatMoney } from "@/lib/formatMoney";
import { formatSafeDate } from "@/lib/formatSafeDate";
import { documentTypeLabels } from "@/lib/documentLabels";
import { documentStatusLabels } from "@/lib/documentLabels";
import { documentTimestamp } from "@/lib/documentTimestamp";
import { normalizeSearch } from "@/lib/normalizeSearch";
import { getDocumentStatut } from "@/lib/recouvrement";
import type { Document, DocumentStatus, DocumentType } from "@/types";

const validTypes: DocumentType[] = [
  "facture",
  "devis",
  "recu",
  "bon_livraison",
];
const validStatuses: DocumentStatus[] = ["en_attente", "partiel", "paye", "annule"];
type DocumentDirectoryProps = {
  initialQuery: string;
  initialType: string;
  initialStatus: string;
};

export function DocumentDirectory({
  initialQuery,
  initialType,
  initialStatus,
}: DocumentDirectoryProps) {
  const { documents, loading, error } = useDocuments();
  const { items: payments } = usePaiements();
  const { items: clients, error: clientsError } = useClients();
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState(
    validTypes.includes(initialType as DocumentType) ? initialType : "",
  );
  const [status, setStatus] = useState(
    validStatuses.includes(initialStatus as DocumentStatus) ? initialStatus : "",
  );
  const router = useRouter();
  const pathname = usePathname();

  function updateUrl(nextQuery: string, nextType: string, nextStatus: string) {
    const params = new URLSearchParams();
    if (nextQuery) params.set("q", nextQuery);
    if (nextType) params.set("type", nextType);
    if (nextStatus) params.set("statut", nextStatus);
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }

  const filteredDocuments = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    return [...documents]
      .filter((document) => {
        const clientName =
          clients.find((client) => client.id === document.clientId)?.nom ?? "";
        return (
          (!normalizedQuery ||
            normalizeSearch(`${document.numero} ${clientName}`).includes(
              normalizedQuery,
            )) &&
          (!type || document.type === type) &&
          (!status ||
            (document.type === "facture"
              ? getDocumentStatut(document, payments)
              : document.statut) === status)
        );
      })
      .sort(
        (left, right) =>
          documentTimestamp(right.dateCreation) -
          documentTimestamp(left.dateCreation),
      );
  }, [clients, documents, payments, query, status, type]);

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
      id: "client",
      header: "Client",
      className: "max-w-56 break-words",
      render: (document) =>
        clients.find((client) => client.id === document.clientId)?.nom ??
        "Client non renseigné",
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
      render: (document) => (
        <StatusBadge
          status={
            document.type === "facture"
              ? getDocumentStatut(document, payments)
              : document.statut
          }
        />
      ),
    },
  ];

  function changeFilters(nextQuery: string, nextType: string, nextStatus: string) {
    setQuery(nextQuery);
    setType(nextType);
    setStatus(nextStatus);
    updateUrl(nextQuery, nextType, nextStatus);
  }

  return (
    <div className="space-y-5">
      {error || clientsError ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error ?? clientsError}
        </p>
      ) : null}
      {loading ? (
        <p role="status" className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          Chargement des documents…
        </p>
      ) : null}
      <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
        <label className="block min-w-0">
          <span className="sr-only">Rechercher un document ou un client</span>
          <span className="relative block">
            <Search
              aria-hidden="true"
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
            />
            <input
              type="search"
              value={query}
              onChange={(event) =>
                changeFilters(event.target.value, type, status)
              }
              placeholder="Numéro ou client…"
              className="min-h-11 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-600 focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/20"
            />
          </span>
        </label>
        <label className="min-w-0">
          <span className="sr-only">Filtrer par type</span>
          <select
            aria-label="Filtrer par type"
            value={type}
            onChange={(event) => changeFilters(query, event.target.value, status)}
            className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <option value="">Tous les types</option>
            {validTypes.map((value) => (
              <option key={value} value={value}>
                {documentTypeLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0">
          <span className="sr-only">Filtrer par statut</span>
          <select
            aria-label="Filtrer par statut"
            value={status}
            onChange={(event) => changeFilters(query, type, event.target.value)}
            className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <option value="">Tous les statuts</option>
            {validStatuses.map((value) => (
              <option key={value} value={value}>
                {documentStatusLabels[value]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p aria-live="polite" className="text-sm text-slate-600">
        {filteredDocuments.length} document
        {filteredDocuments.length === 1 ? "" : "s"}
      </p>
      {!loading && !error && !clientsError && filteredDocuments.length ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <DataTable
            caption="Liste des documents"
            columns={columns}
            rows={filteredDocuments}
            getRowKey={(document) => document.id}
            minWidthClassName="min-w-[900px]"
          />
        </div>
      ) : !loading && !error && !clientsError ? (
        <EmptyState
          icon={Search}
          title="Aucun document trouvé"
          message={
            query
              ? `Aucun document ne correspond à « ${query} ».`
              : "Aucun document ne correspond aux filtres sélectionnés."
          }
          action={
            query || type || status ? (
              <button
                type="button"
                onClick={() => changeFilters("", "", "")}
                className="inline-flex min-h-10 items-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Effacer les filtres
              </button>
            ) : (
              <Link
                href="/documents/nouveau"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <FilePlus2 size={17} aria-hidden="true" />
                Créer un document
              </Link>
            )
          }
        />
      ) : null}
    </div>
  );
}
