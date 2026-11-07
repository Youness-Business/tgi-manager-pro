"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/ToastProvider";
import { useClients } from "@/context/FirestoreDataProvider";
import { useAscenseurs } from "@/context/OperationsDataProvider";
import { saveElevator } from "@/lib/operations";
import { formatSafeDate } from "@/lib/formatSafeDate";
import type { Ascenseur, AscenseurStatut } from "@/types";

type ElevatorFormData = Omit<Ascenseur, "id" | "createdAt">;

function todayInput(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function elevatorFormData(elevator: Ascenseur): ElevatorFormData {
  return {
    clientId: elevator.clientId,
    site: elevator.site,
    adresse: elevator.adresse,
    marque: elevator.marque,
    modele: elevator.modele,
    numeroSerie: elevator.numeroSerie,
    annee: elevator.annee,
    capacite: elevator.capacite,
    nbNiveaux: elevator.nbNiveaux,
    typeMachine: elevator.typeMachine,
    dateMiseEnService: elevator.dateMiseEnService,
    statut: elevator.statut,
    prochaineVisite: elevator.prochaineVisite,
    ...(elevator.contratId ? { contratId: elevator.contratId } : {}),
  };
}

export function ElevatorEditor({ id }: { id?: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { items: clients, loading: clientsLoading, error: clientsError } = useClients();
  const { items: elevators, loading: elevatorsLoading, error: elevatorsError } = useAscenseurs();
  const existing = id ? elevators.find((elevator) => elevator.id === id) : undefined;
  const initializedId = useRef<string | null>(null);
  const [values, setValues] = useState<ElevatorFormData>(() => ({
    clientId: "",
    site: "",
    adresse: "",
    marque: "",
    modele: "",
    numeroSerie: "",
    annee: new Date().getFullYear(),
    capacite: 8,
    nbNiveaux: 2,
    typeMachine: "Gearless",
    dateMiseEnService: todayInput(),
    statut: "en_service",
    prochaineVisite: todayInput(),
  }));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!id || !existing || initializedId.current === id) return;
    setValues(elevatorFormData(existing));
    initializedId.current = id;
  }, [existing, id]);
  const currentYear = new Date().getFullYear();
  const errorId = (name: string) => `elevator-${name}-error`;
  const dateValue = (input: ElevatorFormData["dateMiseEnService"]): string => {
    const [day, month, year] = formatSafeDate(input).split("/");
    return `${year}-${month}-${day}`;
  };
  const visitValue = (input: ElevatorFormData["prochaineVisite"]): string => {
    const [day, month, year] = formatSafeDate(input).split("/");
    return `${year}-${month}-${day}`;
  };

  const serialConflict = useMemo(() => elevators.some((item) =>
    item.id !== id && item.numeroSerie.trim().toLocaleLowerCase("fr") === values.numeroSerie.trim().toLocaleLowerCase("fr"),
  ), [elevators, id, values.numeroSerie]);

  function update<K extends keyof ElevatorFormData>(key: K, value: ElevatorFormData[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!values.clientId) errors.clientId = "Sélectionnez un client.";
    if (!values.numeroSerie.trim()) errors.numeroSerie = "Saisissez un numéro de série.";
    else if (serialConflict) errors.numeroSerie = "Ce numéro de série est déjà utilisé.";
    if (!Number.isInteger(values.annee) || values.annee < 1950 || values.annee > currentYear + 2) {
      errors.annee = `L’année doit être comprise entre 1950 et ${currentYear + 2}.`;
    }
    if (!Number.isInteger(values.nbNiveaux) || values.nbNiveaux < 2) {
      errors.nbNiveaux = "Un ascenseur doit desservir au moins deux niveaux.";
    }
    if (!Number.isFinite(values.capacite) || values.capacite < 1) errors.capacite = "La capacité doit être au moins égale à 1.";
    for (const key of ["site", "adresse", "marque", "modele", "typeMachine"] as const) {
      if (!String(values[key]).trim()) errors[key] = "Ce champ est obligatoire.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    const elevatorId = id ?? crypto.randomUUID();
    setSaving(true);
    setSubmitError("");
    try {
      await saveElevator({ ...values, id: elevatorId }, !id);
      showToast(id ? "Ascenseur modifié" : "Ascenseur ajouté");
      router.push(`/parc/${elevatorId}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "L’ascenseur n’a pas pu être enregistré.");
    } finally {
      setSaving(false);
    }
  }

  if ((clientsLoading || elevatorsLoading) && id && !existing) {
    return <p role="status" className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-card">Chargement de l’ascenseur…</p>;
  }
  if (clientsError || elevatorsError) {
    return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{clientsError ?? elevatorsError}</p>;
  }
  if (id && !existing) {
    return <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Ascenseur introuvable.</p>;
  }

  const textField = (
    name: "site" | "adresse" | "marque" | "modele" | "numeroSerie" | "typeMachine",
    label: string,
    value: string,
  ) => (
    <Field id={`elevator-${name}`} label={label} required error={fieldErrors[name]}>
      <Input id={`elevator-${name}`} required value={value} aria-invalid={Boolean(fieldErrors[name])} aria-describedby={fieldErrors[name] ? errorId(name) : undefined} onChange={(event) => update(name, event.target.value)} />
    </Field>
  );
  const numberField = (
    name: "annee" | "capacite" | "nbNiveaux",
    label: string,
    value: number,
    min: number,
    max?: number,
  ) => (
    <Field id={`elevator-${name}`} label={label} required error={fieldErrors[name]}>
      <Input id={`elevator-${name}`} type="number" min={min} max={max} step="1" value={value} aria-invalid={Boolean(fieldErrors[name])} aria-describedby={fieldErrors[name] ? errorId(name) : undefined} onChange={(event) => update(name, Number(event.target.value))} />
    </Field>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {submitError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{submitError}</p> : null}
      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:grid-cols-2 sm:p-6">
        <Field id="elevator-client" label="Client" required error={fieldErrors.clientId}>
          <Select id="elevator-client" value={values.clientId} aria-invalid={Boolean(fieldErrors.clientId)} aria-describedby={fieldErrors.clientId ? errorId("clientId") : undefined} onChange={(event) => update("clientId", event.target.value)}>
            <option value="">Sélectionner un client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.nom}</option>)}
          </Select>
        </Field>
        {textField("site", "Nom du site / bâtiment", values.site)}
        <div className="sm:col-span-2">{textField("adresse", "Adresse du site", values.adresse)}</div>
        {textField("marque", "Marque", values.marque)}
        {textField("modele", "Modèle", values.modele)}
        {textField("numeroSerie", "Numéro de série", values.numeroSerie)}
        {textField("typeMachine", "Type de machine", values.typeMachine)}
        {numberField("annee", "Année", values.annee, 1950, currentYear + 2)}
        {numberField("capacite", "Capacité (personnes)", values.capacite, 1)}
        {numberField("nbNiveaux", "Nombre de niveaux", values.nbNiveaux, 2)}
        <Field id="elevator-service-date" label="Date de mise en service" required>
          <Input id="elevator-service-date" type="date" value={dateValue(values.dateMiseEnService)} onChange={(event) => update("dateMiseEnService", event.target.value)} />
        </Field>
        <Field id="elevator-next-visit" label="Prochaine visite" required>
          <Input id="elevator-next-visit" type="date" value={visitValue(values.prochaineVisite)} onChange={(event) => update("prochaineVisite", event.target.value)} />
        </Field>
        <Field id="elevator-status" label="Statut">
          <Select id="elevator-status" value={values.statut} onChange={(event) => update("statut", event.target.value as AscenseurStatut)}>
            <option value="en_service">En service</option><option value="en_panne">En panne</option><option value="arret">Arrêt</option><option value="en_installation">En installation</option>
          </Select>
        </Field>
      </section>
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => router.back()}>Annuler</Button>
        <Button type="submit" loading={saving}>{id ? "Enregistrer les modifications" : "Ajouter l’ascenseur"}</Button>
      </div>
    </form>
  );
}
