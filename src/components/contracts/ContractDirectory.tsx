"use client";

import { useMemo, useState } from "react";
import Link from "@/lib/router";
import { FilePlus2, FileText } from "lucide-react";
import { usePathname, useRouter } from "@/lib/router";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { StatCard } from "@/components/ui/StatCard";
import { ContractStatusBadge } from "@/components/operations/OperationStatusBadge";
import { useAuth } from "@/context/AuthProvider";
import { useClients } from "@/context/FirestoreDataProvider";
import { useContrats } from "@/context/OperationsDataProvider";
import { can } from "@/lib/permissions";
import { annualContractRevenue } from "@/lib/operations";
import { contratNeedsRenewal, getContratStatut } from "@/lib/contractDates";
import { formatMoney } from "@/lib/formatMoney";
import { formatSafeDate } from "@/lib/formatSafeDate";
import { documentTimestamp } from "@/lib/documentTimestamp";
import { normalizeSearch } from "@/lib/normalizeSearch";
import type { ContratStatut } from "@/types";

type Props = { initialQuery: string; initialStatus: string; initialType: string; renewOnly: boolean };

export function ContractDirectory({ initialQuery, initialStatus, initialType, renewOnly }: Props) {
  const { items: contracts, loading: contractsLoading, error: contractsError } = useContrats();
  const { items: clients, loading: clientsLoading, error: clientsError } = useClients();
  const { role } = useAuth();
  const [query, setQuery] = useState(initialQuery);
  const router = useRouter();
  const pathname = usePathname();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value) params.set(key, value);
    else params.delete(key);
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }

  const records = useMemo(() => contracts.map((contract) => {
    const client = clients.find((item) => item.id === contract.clientId);
    const status = getContratStatut(contract);
    const due = contratNeedsRenewal(contract);
    return { ...contract, clientName: client?.nom ?? "Client introuvable", status, due };
  }), [clients, contracts]);
  const filtered = records.filter((contract) => {
    const text = normalizeSearch(`${contract.numero} ${contract.clientName} ${contract.type}`);
    return (!query || text.includes(normalizeSearch(query))) &&
      (!initialStatus || contract.status === initialStatus) &&
      (!initialType || contract.type === initialType) &&
      (!renewOnly || contract.due);
  }).sort((left, right) => documentTimestamp(left.dateFin) - documentTimestamp(right.dateFin));
  const active = records.filter((item) => item.status === "actif");
  const annual = active.reduce((sum, item) => sum + annualContractRevenue(item), 0);
  const due = records.filter((item) => item.due).length;
  const expired = records.filter((item) => item.status === "expire").length;
  const canCreate = can(role, "create", "contracts");

  const columns: DataTableColumn<(typeof filtered)[number]>[] = [
    { id: "numero", header: "Contrat", render: (item) => <Link href={`/contrats/${item.id}`} className="font-semibold text-blue-700 hover:text-blue-800">{item.numero}</Link> },
    { id: "client", header: "Client", className: "max-w-48 break-words", render: (item) => item.clientName },
    { id: "type", header: "Type", render: (item) => item.type === "maintenance" ? "Maintenance" : "Installation" },
    { id: "period", header: "Période", render: (item) => <span className="whitespace-nowrap tabular-nums">{formatSafeDate(item.dateDebut)} – {formatSafeDate(item.dateFin)}</span> },
    { id: "amount", header: "Montant HT/an", align: "right", render: (item) => <span className="whitespace-nowrap font-medium tabular-nums">{formatMoney(annualContractRevenue(item))}</span> },
    { id: "status", header: "Statut", render: (item) => <ContractStatusBadge status={item.status} needsRenewal={item.due} /> },
    { id: "elevators", header: "Équipements", render: (item) => `${item.ascenseurIds.length} ascenseur${item.ascenseurIds.length === 1 ? "" : "s"}` },
  ];

  return (
    <div className="space-y-6">
      {contractsError || clientsError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{contractsError ?? clientsError}</p> : null}
      {contractsLoading || clientsLoading ? <p role="status" className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-card">Chargement des contrats…</p> : null}
      <section aria-label="Indicateurs contrats" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Contrats actifs" value={String(active.length)} detail="Contrats en cours" icon={FileText} iconClassName="bg-emerald-50 text-emerald-700" />
        {role !== "commercial" ? <StatCard label="CA récurrent annuel" value={formatMoney(annual)} detail="Montants HT annualisés" icon={FileText} iconClassName="bg-blue-50 text-blue-700" /> : null}
        <StatCard label="À renouveler" value={String(due)} detail="Échéance dans les 60 jours" icon={FileText} iconClassName="bg-amber-50 text-amber-700" />
        <StatCard label="Expirés" value={String(expired)} detail="Date de fin dépassée" icon={FileText} iconClassName="bg-slate-100 text-slate-700" />
      </section>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <SearchInput id="contract-search" label="Rechercher un contrat ou un client" value={query} placeholder="Numéro ou client…" onChange={(value) => { setQuery(value); updateParam("q", value); }} />
        <label className="min-w-0 text-sm font-medium text-slate-700">Statut
          <select aria-label="Filtrer par statut" value={initialStatus} onChange={(event) => updateParam("statut", event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm sm:w-44">
            <option value="">Tous</option>
            {(["actif", "brouillon", "expire", "resilie"] as ContratStatut[]).map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-sm font-medium text-slate-700">Type
          <select aria-label="Filtrer par type" value={initialType} onChange={(event) => updateParam("type", event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm sm:w-44">
            <option value="">Tous</option><option value="maintenance">Maintenance</option><option value="installation">Installation</option>
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
          <input type="checkbox" checked={renewOnly} onChange={(event) => updateParam("expire60", event.target.checked ? "1" : "")} className="h-4 w-4 accent-blue-600" />
          Expire dans 60 jours
        </label>
        {canCreate ? <Link href="/contrats/nouveau" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"><FilePlus2 size={17} />Nouveau contrat</Link> : null}
      </div>
      {!contractsLoading && !contractsError ? filtered.length ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card">
          <DataTable caption="Contrats et échéances" rows={filtered} columns={columns} getRowKey={(item) => item.id} minWidthClassName="min-w-[900px]" />
        </div>
      ) : <EmptyState icon={FileText} title="Aucun contrat trouvé" message={query ? `Aucun contrat ne correspond à « ${query} ».` : "Aucun contrat ne correspond aux filtres sélectionnés."} /> : null}
    </div>
  );
}
