"use client";

import Link from "next/link";
import { Search as SearchInputIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import type { Client } from "@/types";
import { formatMoney } from "@/lib/formatMoney";
import { normalizeSearch } from "@/lib/normalizeSearch";
import { useDocuments } from "@/context/DocumentsProvider";
import { useClients } from "@/context/FirestoreDataProvider";
import { documentsByClient, totalFacture } from "@/lib/clientStats";

export type ClientDirectoryRow = Client & {
  documentCount: number;
  billedTotal: number;
};

type ClientDirectoryProps = {
  initialQuery: string;
};

export function ClientDirectory({
  initialQuery,
}: ClientDirectoryProps) {
  const { documents, loading: documentsLoading, error: documentsError } = useDocuments();
  const { items: clients, loading, error } = useClients();
  const [query, setQuery] = useState(initialQuery);
  const router = useRouter();
  const pathname = usePathname();

  function updateQuery(value: string) {
    setQuery(value);
    const params = new URLSearchParams(window.location.search);
    if (value) params.set("q", value);
    else params.delete("q");
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }

  const rows = clients.map((client) => ({
    ...client,
    documentCount: documentsByClient(client.id, documents).length,
    billedTotal: totalFacture(client.id, documents),
  }));
  const normalizedQuery = normalizeSearch(query);
  const filteredRows = rows.filter((client) =>
    normalizeSearch(
      `${client.nom} ${client.ice} ${client.telephone} ${client.telephone.replace(/\D/g, "")} ${client.adresse}`,
    ).includes(normalizedQuery),
  );

  const columns: DataTableColumn<ClientDirectoryRow>[] = [
    {
      id: "nom",
      header: "Société",
      render: (client) => (
        <Link
          href={`/clients/${client.id}`}
          className="font-semibold text-blue-700 hover:text-blue-800 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <span className="break-words">{client.nom}</span>
          <span className="mt-1 block text-xs font-normal text-slate-600">
            {client.documentCount} document
            {client.documentCount === 1 ? "" : "s"}
          </span>
        </Link>
      ),
    },
    {
      id: "adresse",
      header: "Adresse",
      className: "max-w-64 break-words",
      render: (client) => client.adresse,
    },
    {
      id: "telephone",
      header: "Téléphone",
      render: (client) => (
        <a
          href={`tel:${client.telephone.replaceAll(" ", "")}`}
          className="whitespace-nowrap text-slate-700 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          {client.telephone}
        </a>
      ),
    },
    {
      id: "ice",
      header: "ICE",
      render: (client) => (
        <span className="whitespace-nowrap font-mono text-xs">{client.ice}</span>
      ),
    },
    {
      id: "total",
      header: "Total facturé TTC",
      align: "right",
      render: (client) => (
        <span className="whitespace-nowrap font-medium tabular-nums text-slate-900">
          {formatMoney(client.billedTotal)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {error || documentsError ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error ?? documentsError}
        </p>
      ) : null}
      {loading || documentsLoading ? (
        <p role="status" className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          Chargement des données clients…
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          id="client-search"
          label="Rechercher un client par nom, ICE, téléphone ou ville"
          value={query}
          placeholder="Nom, ICE, téléphone ou ville…"
          onChange={updateQuery}
        />
        <p
          aria-live="polite"
          className="shrink-0 text-sm text-slate-600 sm:text-right"
        >
          {filteredRows.length} client{filteredRows.length === 1 ? "" : "s"}
          {query ? " trouvé" + (filteredRows.length === 1 ? "" : "s") : ""}
        </p>
      </div>

      {!loading && !documentsLoading && !error && !documentsError && filteredRows.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <DataTable
            caption="Liste des clients et totaux facturés"
            columns={columns}
            rows={filteredRows}
            getRowKey={(client) => client.id}
            minWidthClassName="min-w-[900px]"
          />
        </div>
      ) : !loading && !documentsLoading && !error && !documentsError ? (
        <EmptyState
          icon={SearchInputIcon}
          title="Aucun client trouvé"
          message={
            query
              ? `Aucun client trouvé pour « ${query} ».`
              : "Aucun client à afficher pour le moment."
          }
          action={
            query ? (
              <button
                type="button"
                onClick={() => updateQuery("")}
                className="inline-flex min-h-10 items-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Effacer la recherche
              </button>
            ) : undefined
          }
        />
      ) : null}
    </div>
  );
}
