"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/ToastProvider";
import { useAuth } from "@/context/AuthProvider";
import { useAscenseurs } from "@/context/OperationsDataProvider";
import { createIntervention } from "@/lib/operations";
import type { InterventionType } from "@/types";

function localDateTime(): string {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return date.toISOString().slice(0, 16);
}

export function InterventionEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const { items: elevators, loading, error } = useAscenseurs();
  const { showToast } = useToast();
  const initialElevator = searchParams.get("ascenseur") ?? "";
  const [ascenseurId, setAscenseurId] = useState(initialElevator);
  const [type, setType] = useState<InterventionType>("visite");
  const [date, setDate] = useState(localDateTime);
  const [technicien, setTechnicien] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!ascenseurId) nextErrors.ascenseurId = "Sélectionnez un ascenseur.";
    if (!date || Number.isNaN(Date.parse(date))) nextErrors.date = "Saisissez une date valide.";
    if (!technicien.trim()) nextErrors.technicien = "Saisissez le nom du technicien.";
    if (type === "depannage" && !description.trim()) nextErrors.description = "Décrivez le problème signalé.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    if (!profile) {
      setSubmitError("Votre session n’est plus active. Reconnectez-vous.");
      return;
    }
    setSaving(true);
    setSubmitError("");
    try {
      const intervention = await createIntervention(
        {
          ascenseurId,
          type,
          date: new Date(date),
          technicien,
          descriptionProbleme: description,
        },
        profile.uid,
      );
      showToast("Intervention planifiée", intervention.numero);
      router.push("/interventions");
    } catch (saveError) {
      setSubmitError(saveError instanceof Error ? saveError.message : "L’intervention n’a pas pu être planifiée.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {error || submitError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error ?? submitError}</p> : null}
      {loading ? <p role="status" className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-card">Chargement des ascenseurs…</p> : null}
      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:grid-cols-2 sm:p-6">
        <Field id="intervention-elevator" label="Ascenseur" required error={errors.ascenseurId}>
          <Select id="intervention-elevator" value={ascenseurId} aria-invalid={Boolean(errors.ascenseurId)} aria-describedby={errors.ascenseurId ? "intervention-elevator-error" : undefined} onChange={(event) => { setAscenseurId(event.target.value); setErrors((current) => ({ ...current, ascenseurId: "" })); }}>
            <option value="">Sélectionner un ascenseur</option>
            {elevators.map((elevator) => <option key={elevator.id} value={elevator.id}>{elevator.marque} {elevator.modele} · {elevator.site} · {elevator.numeroSerie}</option>)}
          </Select>
        </Field>
        <Field id="intervention-type" label="Type d’intervention" required>
          <Select id="intervention-type" value={type} onChange={(event) => setType(event.target.value as InterventionType)}>
            <option value="visite">Visite d’entretien</option><option value="depannage">Dépannage</option><option value="installation">Installation</option>
          </Select>
        </Field>
        <Field id="intervention-date" label="Date et heure prévues" required error={errors.date}>
          <Input id="intervention-date" type="datetime-local" value={date} aria-invalid={Boolean(errors.date)} aria-describedby={errors.date ? "intervention-date-error" : undefined} onChange={(event) => { setDate(event.target.value); setErrors((current) => ({ ...current, date: "" })); }} />
        </Field>
        <Field id="intervention-technician" label="Technicien" required error={errors.technicien}>
          <Input id="intervention-technician" value={technicien} aria-invalid={Boolean(errors.technicien)} aria-describedby={errors.technicien ? "intervention-technician-error" : undefined} onChange={(event) => { setTechnicien(event.target.value); setErrors((current) => ({ ...current, technicien: "" })); }} />
        </Field>
        {type === "depannage" ? (
          <div className="sm:col-span-2">
            <Field id="intervention-problem" label="Description du problème" required error={errors.description}>
              <Textarea id="intervention-problem" value={description} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? "intervention-problem-error" : undefined} onChange={(event) => { setDescription(event.target.value); setErrors((current) => ({ ...current, description: "" })); }} />
            </Field>
          </div>
        ) : null}
      </section>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => router.back()}>Annuler</Button>
        <Button type="submit" loading={saving}>Planifier l’intervention</Button>
      </div>
    </form>
  );
}
