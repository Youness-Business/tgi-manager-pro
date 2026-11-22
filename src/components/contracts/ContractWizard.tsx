"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "@/lib/router";
import { useAuth } from "@/context/AuthProvider";
import { useClients } from "@/context/FirestoreDataProvider";
import { useAscenseurs, useContrats } from "@/context/OperationsDataProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { Button, Checkbox, Field, Input, Select, Tabs, Textarea } from "@/components/ui/primitives";
import { computeTotals } from "@/lib/computeTotals";
import { addMonths, getContratStatut } from "@/lib/contractDates";
import { createContract } from "@/lib/operations";
import { formatMoney } from "@/lib/formatMoney";
import type { ContratType, Periodicite } from "@/types";

const steps = [
  { id: "client", label: "1. Client" },
  { id: "elevators", label: "2. Équipements" },
  { id: "terms", label: "3. Conditions" },
  { id: "summary", label: "4. Récapitulatif" },
];

function localDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ContractWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const { items: clients, loading: clientsLoading, error: clientsError } = useClients();
  const { items: elevators, loading: elevatorsLoading, error: elevatorsError } = useAscenseurs();
  const { items: contracts, loading: contractsLoading } = useContrats();
  const { showToast } = useToast();
  const [step, setStep] = useState("client");
  const [clientId, setClientId] = useState(searchParams.get("client") ?? "");
  const [elevatorIds, setElevatorIds] = useState<string[]>(searchParams.get("ascenseur") ? [searchParams.get("ascenseur")!] : []);
  const [type, setType] = useState<ContratType>("maintenance");
  const [periodicity, setPeriodicity] = useState<Periodicite>("annuelle");
  const [startDate, setStartDate] = useState(localDate(new Date()));
  const [durationMonths, setDurationMonths] = useState("12");
  const [visitsPerYear, setVisitsPerYear] = useState("4");
  const [amount, setAmount] = useState("");
  const [autoRenew, setAutoRenew] = useState(true);
  const [conditions, setConditions] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const activeContractElevatorIds = useMemo(() => new Set(contracts
    .filter((contract) => getContratStatut(contract) === "actif")
    .flatMap((contract) => contract.ascenseurIds)), [contracts]);
  const availableElevators = elevators.filter((elevator) => elevator.clientId === clientId && !activeContractElevatorIds.has(elevator.id));
  const client = clients.find((item) => item.id === clientId);
  const selectedElevators = elevators.filter((item) => elevatorIds.includes(item.id));
  const amountNumber = Number(amount);
  const totals = computeTotals([{
    articleId: "contract-fee",
    designation: "Montant par ascenseur",
    qte: selectedElevators.length,
    prixUnitaireHT: Number.isFinite(amountNumber) ? amountNumber : 0,
  }]);
  const endDate = startDate && Number.isFinite(Number(durationMonths))
    ? localDate(addMonths(new Date(`${startDate}T12:00:00`), Number(durationMonths)))
    : "";
  const dataLoading = clientsLoading || elevatorsLoading || contractsLoading;
  const dataError = clientsError ?? elevatorsError;

  function validateStep(target: string): string {
    if (target === "client" && !clientId) return "Sélectionnez un client.";
    if (target === "elevators" && elevatorIds.length === 0) return "Sélectionnez au moins un ascenseur.";
    if (target === "elevators" && elevatorIds.some((id) => !availableElevators.some((item) => item.id === id))) return "Un ascenseur sélectionné est déjà lié à un contrat actif. Actualisez votre sélection.";
    if (target === "terms") {
      if (!startDate || !endDate || !Number.isFinite(Date.parse(startDate)) || !Number.isFinite(Date.parse(endDate))) return "Les dates du contrat sont invalides.";
      if (!Number.isInteger(Number(durationMonths)) || Number(durationMonths) < 1 || Number(durationMonths) > 120) return "La durée doit être comprise entre 1 et 120 mois entiers.";
      if (!Number.isInteger(Number(visitsPerYear)) || Number(visitsPerYear) < 1 || Number(visitsPerYear) > 52) return "Le nombre de visites doit être compris entre 1 et 52.";
      if (!Number.isFinite(amountNumber) || amountNumber <= 0 || totals.totalHT <= 0) return "Le montant HT doit être supérieur à zéro.";
    }
    return "";
  }

  function goTo(next: string) {
    const currentIndex = steps.findIndex((item) => item.id === step);
    const nextIndex = steps.findIndex((item) => item.id === next);
    if (nextIndex > currentIndex) {
      for (let index = currentIndex; index < nextIndex; index += 1) {
        const validation = validateStep(steps[index].id);
        if (validation) {
          setError(validation);
          setStep(steps[index].id);
          return;
        }
      }
    }
    setError("");
    setStep(next);
  }

  function toggleElevator(id: string, checked: boolean) {
    setElevatorIds((current) => checked ? [...new Set([...current, id])] : current.filter((value) => value !== id));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateStep("client") || validateStep("elevators") || validateStep("terms");
    if (validation) {
      setError(validation);
      setStep(!clientId ? "client" : !elevatorIds.length ? "elevators" : "terms");
      return;
    }
    if (!profile) {
      setError("Votre session n’est plus active. Reconnectez-vous.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const start = new Date(`${startDate}T12:00:00`);
      const end = addMonths(start, Number(durationMonths));
      const created = await createContract({
        clientId,
        ascenseurIds: elevatorIds,
        type,
        dateDebut: start,
        dateFin: end,
        periodicite: periodicity,
        montantHT: totals.totalHT,
        visitesParAn: Number(visitsPerYear),
        reconductionAuto: autoRenew,
        conditionsParticulieres: conditions.trim(),
        prochaineFacturation: start,
      }, profile.uid);
      showToast("Contrat créé", `${created.numero} a été enregistré en brouillon.`);
      router.push(`/contrats/${created.id}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Le contrat n’a pas pu être enregistré.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {dataError || error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{dataError ?? error}</p> : null}
      {dataLoading ? <p role="status" className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-card">Chargement des données…</p> : null}
      <Tabs tabs={steps} selected={step} onChange={(next) => goTo(next)} />
      {step === "client" ? <section className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
        <h2 className="font-display text-lg font-bold text-slate-900">Sélection du client</h2>
        <div className="mt-4"><Field id="contract-client" label="Client" required><Select id="contract-client" value={clientId} onChange={(event) => { setClientId(event.target.value); setElevatorIds([]); }}><option value="">Sélectionner un client</option>{clients.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}</Select></Field></div>
        {client ? <p className="mt-3 text-sm text-slate-600">{client.adresse} · {client.telephone}</p> : null}
      </section> : null}
      {step === "elevators" ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
        <h2 className="font-display text-lg font-bold text-slate-900">Équipements concernés</h2>
        <p className="mt-1 text-sm text-slate-600">Seuls les ascenseurs de ce client qui ne sont pas déjà liés à un contrat actif peuvent être sélectionnés.</p>
        {availableElevators.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{availableElevators.map((elevator) => <Checkbox key={elevator.id} checked={elevatorIds.includes(elevator.id)} onChange={(event) => toggleElevator(elevator.id, event.target.checked)} label={`${elevator.marque} ${elevator.modele} · ${elevator.site} · ${elevator.numeroSerie}`} className="min-w-0 items-start rounded-xl border border-slate-200 p-4" />)}</div> : <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Aucun équipement disponible pour ce client.</p>}
        {elevatorIds.some((id) => !availableElevators.some((item) => item.id === id)) ? <p className="mt-3 text-sm text-amber-800">Un équipement pré-sélectionné n’est plus disponible. Vérifiez la sélection.</p> : null}
      </section> : null}
      {step === "terms" ? <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:grid-cols-2 sm:p-6">
        <Field id="contract-type" label="Type de contrat" required><Select id="contract-type" value={type} onChange={(event) => setType(event.target.value as ContratType)}><option value="maintenance">Maintenance</option><option value="installation">Installation</option></Select></Field>
        <Field id="contract-periodicity" label="Périodicité de facturation" required><Select id="contract-periodicity" value={periodicity} onChange={(event) => setPeriodicity(event.target.value as Periodicite)}><option value="mensuelle">Mensuelle</option><option value="trimestrielle">Trimestrielle</option><option value="annuelle">Annuelle</option></Select></Field>
        <Field id="contract-start" label="Date de début" required><Input id="contract-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></Field>
        <Field id="contract-duration" label="Durée (mois)" required><Input id="contract-duration" type="number" min="1" max="120" value={durationMonths} onChange={(event) => setDurationMonths(event.target.value)} /></Field>
        <p className="text-sm text-slate-600">Date de fin calculée : <strong className="tabular-nums text-slate-900">{endDate || "—"}</strong></p>
        <Field id="contract-visits" label="Visites prévues par an" required><Input id="contract-visits" type="number" min="1" max="52" value={visitsPerYear} onChange={(event) => setVisitsPerYear(event.target.value)} /></Field>
        <Field id="contract-amount" label="Montant HT par ascenseur et par période (MAD)" required><Input id="contract-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field>
        <div className="flex items-center"><Checkbox checked={autoRenew} onChange={(event) => setAutoRenew(event.target.checked)} label="Reconduction automatique" /></div>
        <div className="sm:col-span-2"><Field id="contract-conditions" label="Conditions particulières"><Textarea id="contract-conditions" value={conditions} onChange={(event) => setConditions(event.target.value)} /></Field></div>
        <div className="sm:col-span-2 rounded-xl bg-slate-50 p-4"><div className="flex justify-between gap-4 text-sm"><span>Montant HT</span><strong className="tabular-nums">{formatMoney(totals.totalHT)}</strong></div><div className="mt-2 flex justify-between gap-4 text-sm"><span>TVA (20 %)</span><strong className="tabular-nums">{formatMoney(totals.montantTVA)}</strong></div><div className="mt-2 flex justify-between gap-4 border-t border-slate-200 pt-2 text-sm font-bold"><span>Total TTC</span><strong className="tabular-nums">{formatMoney(totals.totalTTC)}</strong></div></div>
      </section> : null}
      {step === "summary" ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
        <h2 className="font-display text-lg font-bold text-slate-900">Récapitulatif</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Summary label="Client" value={client?.nom ?? "—"} /><Summary label="Type" value={type === "maintenance" ? "Maintenance" : "Installation"} /><Summary label="Équipements" value={selectedElevators.map((item) => `${item.marque} ${item.modele} · ${item.site}`).join(", ") || "—"} /><Summary label="Période" value={`${startDate} – ${endDate}`} /><Summary label="Périodicité" value={periodicity} /><Summary label="Visites par an" value={visitsPerYear} /><Summary label="Montant HT" value={formatMoney(totals.totalHT)} /><Summary label="Total TTC" value={formatMoney(totals.totalTTC)} /><Summary label="Reconduction" value={autoRenew ? "Automatique" : "Non"} />
        </dl>
        <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Le contrat sera créé en brouillon et devra être validé avant son activation.</p>
      </section> : null}
      <div className="flex flex-wrap justify-between gap-3">
        <Button type="button" variant="secondary" onClick={() => router.back()}>Annuler</Button>
        <div className="flex gap-2">
          {step !== "client" ? <Button type="button" variant="secondary" onClick={() => goTo(steps[Math.max(0, steps.findIndex((item) => item.id === step) - 1)].id)}>Précédent</Button> : null}
          {step !== "summary" ? <Button type="button" onClick={() => goTo(steps[Math.min(steps.length - 1, steps.findIndex((item) => item.id === step) + 1)].id)}>Continuer</Button> : <Button type="submit" loading={saving}>Créer le brouillon</Button>}
        </div>
      </div>
    </form>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 border-b border-slate-100 pb-3"><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</dd></div>;
}
