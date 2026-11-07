"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Plus, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { ElevatorStatusBadge } from "@/components/operations/OperationStatusBadge";
import { useClients } from "@/context/FirestoreDataProvider";
import { useAscenseurs, useContrats } from "@/context/OperationsDataProvider";
import { formatSafeDate } from "@/lib/formatSafeDate";
import { normalizeSearch } from "@/lib/normalizeSearch";
import type { AscenseurStatut } from "@/types";
import { useAuth } from "@/context/AuthProvider";
import { can } from "@/lib/permissions";

type Props = { initialQuery: string; initialStatus: string; initialClient: string; initialContract: string };

export function ElevatorDirectory({ initialQuery, initialStatus, initialClient, initialContract }: Props) {
  const { items, loading, error } = useAscenseurs();
  const { items: clients } = useClients();
  const { items: contracts } = useContrats();
  const { role } = useAuth();
  const [sortAscending, setSortAscending] = useState(true);
  const [query, setQuery] = useState(initialQuery);
  const router = useRouter();
  const pathname = usePathname();
  const allStatuses: AscenseurStatut[] = ["en_service", "en_panne", "arret", "en_installation"];

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value) params.set(key, value);
    else params.delete(key);
    const serialized = params.toString();
    router.replace(serialized ? `${pathname}?${serialized}` : pathname, { scroll: false });
  }

  const rows = useMemo(() => items
    .map((elevator) => ({
      ...elevator,
      clientName: clients.find((client) => client.id === elevator.clientId)?.nom ?? "Client introuvable",
      contractNumber: contracts.find((contract) => contract.id === elevator.contratId)?.numero ?? "",
    }))
    .filter((elevator) => {
      const haystack = normalizeSearch(`${elevator.clientName} ${elevator.site} ${elevator.adresse} ${elevator.marque} ${elevator.modele} ${elevator.numeroSerie}`);
      const hasContract = Boolean(elevator.contratId);
      return (!query || haystack.includes(normalizeSearch(query))) &&
        (!initialStatus || elevator.statut === initialStatus) &&
        (!initialClient || elevator.clientId === initialClient) &&
        (!initialContract || (initialContract === "sous_contrat" ? hasContract : !hasContract));
    })
    .sort((left, right) => sortAscending ? left.site.localeCompare(right.site, "fr") : right.site.localeCompare(left.site, "fr")),
  [clients, contracts, initialClient, initialContract, initialStatus, items, query, sortAscending]);

  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    { id: "client", header: "Client / site", sortable: true, sortDirection: sortAscending ? "ascending" : "descending", onSort: () => setSortAscending((current) => !current), render: (elevator) => <Link href={`/parc/${elevator.id}`} className="font-semibold text-blue-700 hover:text-blue-800"><span className="block break-words">{elevator.clientName}</span><span className="mt-1 block text-xs font-normal text-slate-500">{elevator.site}</span></Link> },
    { id: "model", header: "Marque / modèle", render: (elevator) => `${elevator.marque} ${elevator.modele}` },
    { id: "serial", header: "N° de série", render: (elevator) => <span className="break-all font-mono text-xs">{elevator.numeroSerie}</span> },
    { id: "status", header: "Statut", render: (elevator) => <ElevatorStatusBadge status={elevator.statut} /> },
    { id: "contract", header: "Contrat lié", render: (elevator) => elevator.contractNumber ? <Link className="text-blue-700 hover:text-blue-800" href={`/contrats/${elevator.contratId}`}>{elevator.contractNumber}</Link> : <span className="text-amber-700">Hors contrat</span> },
    { id: "visit", header: "Prochaine visite", render: (elevator) => <span className="whitespace-nowrap tabular-nums">{formatSafeDate(elevator.prochaineVisite)}</span> },
  ];

  return (
    <div className="space-y-5">
      {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}
      {loading ? <p role="status" className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-card">Chargement du parc…</p> : null}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <SearchInput id="elevator-search" label="Rechercher un ascenseur, client, site ou numéro de série" value={query} placeholder="Client, site, marque ou n° de série…" onChange={(value) => { setQuery(value); updateParam("q", value); }} />
        <label className="text-sm font-medium text-slate-700">Statut
          <select aria-label="Filtrer par statut" value={initialStatus} onChange={(event) => updateParam("statut", event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm xl:w-48">
            <option value="">Tous</option>{allStatuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">Client
          <select aria-label="Filtrer par client" value={initialClient} onChange={(event) => updateParam("client", event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm xl:w-52">
            <option value="">Tous</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.nom}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">Contrat
          <select aria-label="Filtrer par contrat" value={initialContract} onChange={(event) => updateParam("contrat", event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm xl:w-44">
            <option value="">Tous</option><option value="sous_contrat">Sous contrat</option><option value="hors_contrat">Hors contrat</option>
          </select>
        </label>
        {can(role, "create", "elevators") ? <Link href="/parc/nouveau" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={17} />Ajouter</Link> : null}
      </div>
      {!loading && !error ? rows.length ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card">
          <DataTable caption="Parc d’ascenseurs" rows={rows} columns={columns} getRowKey={(elevator) => elevator.id} minWidthClassName="min-w-[900px]" />
        </div>
      ) : <EmptyState icon={query ? Search : Building2} title="Aucun ascenseur trouvé" message={query ? `Aucun équipement ne correspond à « ${query} ».` : "Aucun équipement ne correspond aux filtres sélectionnés."} /> : null}
    </div>
  );
}
