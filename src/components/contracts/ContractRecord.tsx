"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, Check, FilePlus2, Printer, RefreshCw } from "lucide-react";
import { ContratMaintenance } from "@/components/documents/ContratMaintenance";
import { useAuth } from "@/context/AuthProvider";
import { useClients } from "@/context/FirestoreDataProvider";
import { useDocuments } from "@/context/DocumentsProvider";
import { useAscenseurs, useContrats } from "@/context/OperationsDataProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { Modal } from "@/components/ui/overlays";
import { Button, Field, Input } from "@/components/ui/primitives";
import { ContractStatusBadge } from "@/components/operations/OperationStatusBadge";
import { contratNeedsRenewal, getContratStatut } from "@/lib/contractDates";
import { formatMoney } from "@/lib/formatMoney";
import { formatSafeDate } from "@/lib/formatSafeDate";
import { can } from "@/lib/permissions";
import { generateContractInvoice, renewContract, setContractStatus } from "@/lib/operations";
import type { Contrat } from "@/types";

export function ContractRecord({ id, printable = false }: { id: string; printable?: boolean }) {
  const router = useRouter();
  const { items: contracts, loading: contractsLoading, error: contractsError } = useContrats();
  const { items: clients, loading: clientsLoading, error: clientsError } = useClients();
  const { items: elevators, loading: elevatorsLoading, error: elevatorsError } = useAscenseurs();
  const { documents, loading: documentsLoading, error: documentsError } = useDocuments();
  const { profile, role } = useAuth();
  const { showToast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [operationError, setOperationError] = useState("");
  const [saving, setSaving] = useState(false);
  const contract = contracts.find((item) => item.id === id);
  const client = clients.find((item) => item.id === contract?.clientId);
  const contractElevators = useMemo(() => elevators.filter((item) => contract?.ascenseurIds.includes(item.id)), [contract?.ascenseurIds, elevators]);
  const status = contract ? getContratStatut(contract) : null;
  const due = contract ? contratNeedsRenewal(contract) : false;
  const loading = contractsLoading || clientsLoading || elevatorsLoading || documentsLoading;
  const dataError = contractsError ?? clientsError ?? elevatorsError ?? documentsError;
  const canEdit = can(role, "update", "contracts");
  const canCreate = can(role, "create", "contracts");

  async function perform(action: "activate" | "cancel" | "renew" | "invoice") {
    if (!contract) return;
    if (!profile) {
      setOperationError("Votre session n’est plus active. Reconnectez-vous.");
      return;
    }
    if (action === "cancel" && !reason.trim()) {
      setOperationError("Le motif de résiliation est obligatoire.");
      return;
    }
    setSaving(true);
    setOperationError("");
    try {
      if (action === "activate") {
        await setContractStatus(contract.id, "actif");
        showToast("Contrat activé", `${contract.numero} est maintenant actif.`);
      } else if (action === "cancel") {
        await setContractStatus(contract.id, "resilie", reason);
        showToast("Contrat résilié", `${contract.numero} a été conservé dans l’historique.`);
        setDialogOpen(false);
      } else if (action === "renew") {
        const renewed = await renewContract(contract, profile.uid);
        showToast("Renouvellement créé", `${renewed.numero} est enregistré en brouillon.`);
        router.push(`/contrats/${renewed.id}`);
      } else {
        const invoice = await generateContractInvoice(contract.id, profile.uid);
        showToast("Facture générée", invoice.numero);
        router.push(`/documents/${invoice.id}`);
      }
    } catch (actionError) {
      setOperationError(actionError instanceof Error ? actionError.message : "L’action n’a pas pu être effectuée.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p role="status" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-card">Chargement du contrat…</p>;
  if (dataError) return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{dataError}</p>;
  if (!contract || !client || !status) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card"><h2 className="font-display text-lg font-bold text-slate-900">Contrat introuvable</h2><Link className="mt-4 inline-flex text-sm font-semibold text-blue-700" href="/contrats">Retour aux contrats</Link></div>;

  if (printable) return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3 print:hidden"><Link href={`/contrats/${id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-700"><ArrowLeft size={17} aria-hidden="true" />Retour au contrat</Link><Button onClick={() => window.print()} leadingIcon={<Printer size={17} aria-hidden="true" />}>Imprimer / Exporter PDF</Button></div><ContratMaintenance contract={contract} client={client} elevators={contractElevators} /></div>;

  const invoiceIds = new Set(contract.facturesPeriodes?.map((period) => period.documentId) ?? []);
  const contractDocuments = documents.filter((document) => invoiceIds.has(document.id));
  const contractStatus = status as Contrat["statut"];

  return (
    <div className="space-y-5">
      {operationError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{operationError}</p> : null}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0"><Link href="/contrats" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-blue-700"><ArrowLeft size={16} aria-hidden="true" />Retour aux contrats</Link><h2 className="mt-4 break-all font-display text-2xl font-bold text-slate-900">{contract.numero}</h2><p className="mt-1 break-words text-sm text-slate-600">{client.nom} · {contract.type === "maintenance" ? "Maintenance" : "Installation"}</p><div className="mt-3"><ContractStatusBadge status={contractStatus} needsRenewal={due} /></div></div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/contrats/${id}/imprimer`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Printer size={16} aria-hidden="true" />Imprimer</Link>
          {canEdit && contract.statut === "brouillon" ? <Button loading={saving} onClick={() => void perform("activate")} leadingIcon={<Check size={16} aria-hidden="true" />}>Valider le contrat</Button> : null}
          {canCreate && status !== "brouillon" && status !== "resilie" ? <Button variant="secondary" loading={saving} onClick={() => void perform("renew")} leadingIcon={<RefreshCw size={16} aria-hidden="true" />}>Renouveler</Button> : null}
          {canEdit && status === "actif" ? <Button variant="danger" onClick={() => { setReason(""); setOperationError(""); setDialogOpen(true); }} leadingIcon={<Ban size={16} aria-hidden="true" />}>Résilier</Button> : null}
          {canEdit && status === "actif" ? <Button variant="secondary" loading={saving} onClick={() => void perform("invoice")} leadingIcon={<FilePlus2 size={16} aria-hidden="true" />}>Générer la facture de période</Button> : null}
        </div>
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
        <h2 className="font-display text-lg font-bold text-slate-900">Informations du contrat</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Client" value={client.nom} /><Detail label="Période" value={`${formatSafeDate(contract.dateDebut)} – ${formatSafeDate(contract.dateFin)}`} /><Detail label="Périodicité" value={contract.periodicite} /><Detail label="Montant HT par période" value={formatMoney(contract.montantHT)} /><Detail label="Visites par an" value={String(contract.visitesParAn)} /><Detail label="Reconduction automatique" value={contract.reconductionAuto ? "Oui" : "Non"} /><Detail label="Prochaine facturation" value={formatSafeDate(contract.prochaineFacturation)} />
        </dl>
        <h3 className="mt-6 text-sm font-bold text-slate-800">Ascenseurs concernés</h3>
        {contractElevators.length ? <ul className="mt-2 space-y-2">{contractElevators.map((elevator) => <li key={elevator.id}><Link href={`/parc/${elevator.id}`} className="text-sm font-semibold text-blue-700 hover:text-blue-800">{elevator.marque} {elevator.modele} · {elevator.site} · {elevator.numeroSerie}</Link></li>)}</ul> : <p className="mt-2 text-sm text-slate-600">Aucun équipement trouvé.</p>}
        {contract.conditionsParticulieres ? <div className="mt-6"><h3 className="text-sm font-bold text-slate-800">Conditions particulières</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{contract.conditionsParticulieres}</p></div> : null}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6"><h2 className="font-display text-lg font-bold text-slate-900">Factures de période</h2>{contractDocuments.length ? <ul className="mt-4 divide-y divide-slate-100">{contractDocuments.map((document) => <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div><Link href={`/documents/${document.id}`} className="font-semibold text-blue-700 hover:text-blue-800">{document.numero}</Link><p className="text-xs text-slate-500">{formatSafeDate(document.dateCreation)}</p></div><span className="text-sm text-slate-600">{document.statut}</span></li>)}</ul> : <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Aucune facture de période enregistrée.</p>}</section>
      <Modal open={dialogOpen} title="Résilier le contrat" description="Le motif de résiliation est requis. Le contrat restera consultable dans l’historique." onClose={() => { if (!saving) setDialogOpen(false); }}>
        <div className="space-y-4">{operationError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{operationError}</p> : null}<Field id="contract-cancel-reason" label="Motif de résiliation" required><Input id="contract-cancel-reason" value={reason} onChange={(event) => setReason(event.target.value)} /></Field><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setDialogOpen(false)}>Annuler</Button><Button variant="danger" loading={saving} onClick={() => void perform("cancel")}>Confirmer la résiliation</Button></div></div>
      </Modal>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 border-b border-slate-100 pb-3"><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</dd></div>;
}
