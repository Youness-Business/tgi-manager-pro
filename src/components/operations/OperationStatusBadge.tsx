import type { AscenseurStatut, ContratStatut, InterventionStatut } from "@/types";

const elevatorLabels: Record<AscenseurStatut, string> = {
  en_service: "En service",
  en_panne: "En panne",
  arret: "Arrêt",
  en_installation: "En installation",
};
const contractLabels: Record<ContratStatut, string> = {
  actif: "Actif",
  expire: "Expiré",
  resilie: "Résilié",
  brouillon: "Brouillon",
};
const interventionLabels: Record<InterventionStatut, string> = {
  a_planifier: "À planifier",
  planifiee: "Planifiée",
  terminee: "Terminée",
};

const statusClass: Record<string, string> = {
  en_service: "border-emerald-200 bg-emerald-50 text-emerald-800",
  actif: "border-emerald-200 bg-emerald-50 text-emerald-800",
  terminee: "border-emerald-200 bg-emerald-50 text-emerald-800",
  en_panne: "border-red-200 bg-red-50 text-red-800",
  expire: "border-red-200 bg-red-50 text-red-800",
  arret: "border-slate-200 bg-slate-100 text-slate-700",
  resilie: "border-slate-200 bg-slate-100 text-slate-700",
  brouillon: "border-slate-200 bg-slate-100 text-slate-700",
  en_installation: "border-blue-200 bg-blue-50 text-blue-800",
  planifiee: "border-blue-200 bg-blue-50 text-blue-800",
  a_planifier: "border-amber-200 bg-amber-50 text-amber-800",
};

function Badge({ status, label }: { status: string; label: string }) {
  return <span className={`inline-flex min-h-6 whitespace-nowrap items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass[status] ?? "border-slate-200 bg-slate-100 text-slate-700"}`}>{label}</span>;
}

export function ElevatorStatusBadge({ status }: { status: AscenseurStatut }) {
  return <Badge status={status} label={elevatorLabels[status]} />;
}

export function ContractStatusBadge({ status, needsRenewal = false }: { status: ContratStatut; needsRenewal?: boolean }) {
  return needsRenewal
    ? <Badge status="a_planifier" label="À renouveler" />
    : <Badge status={status} label={contractLabels[status]} />;
}

export function InterventionStatusBadge({ status }: { status: InterventionStatut }) {
  return <Badge status={status} label={interventionLabels[status]} />;
}

