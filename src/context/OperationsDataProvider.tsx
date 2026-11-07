"use client";

import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { getFirebaseDb } from "@/lib/firebase";
import { firestoreErrorMessage } from "@/lib/firestoreErrors";
import type {
  Ascenseur,
  AscenseurStatut,
  Contrat,
  ContratStatut,
  ContratType,
  DateInput,
  FacturePeriode,
  Intervention,
  InterventionStatut,
  InterventionType,
  Periodicite,
} from "@/types";

export type LiveCollection<T> = {
  items: T[];
  loading: boolean;
  error: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function text(value: unknown): value is string {
  return typeof value === "string";
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function dateInput(value: unknown): DateInput | null {
  if (value instanceof Date || typeof value === "string" || typeof value === "number") return value;
  if (isRecord(value) && finite(value.seconds)) {
    return {
      seconds: value.seconds,
      ...(finite(value.nanoseconds) ? { nanoseconds: value.nanoseconds } : {}),
    };
  }
  return null;
}

function isOneOf<Value extends string>(
  value: unknown,
  options: readonly Value[],
): value is Value {
  return typeof value === "string" && options.some((option) => option === value);
}

function parseFacturePeriode(value: unknown): FacturePeriode | null {
  if (!isRecord(value) || !text(value.key) || !text(value.documentId)) return null;
  const debut = dateInput(value.debut);
  const fin = dateInput(value.fin);
  return debut && fin ? { key: value.key, debut, fin, documentId: value.documentId } : null;
}

export function parseContrat(id: string, value: unknown): Contrat | null {
  if (!isRecord(value)) return null;
  const contractTypes: readonly ContratType[] = ["maintenance", "installation"];
  const periodicities: readonly Periodicite[] = ["mensuelle", "trimestrielle", "annuelle"];
  const statuses: readonly ContratStatut[] = ["actif", "expire", "resilie", "brouillon"];
  const dateDebut = dateInput(value.dateDebut);
  const dateFin = dateInput(value.dateFin);
  const prochaineFacturation = dateInput(value.prochaineFacturation);
  if (
    !text(value.numero) ||
    !text(value.clientId) ||
    !Array.isArray(value.ascenseurIds) ||
    !value.ascenseurIds.every(text) ||
    !isOneOf(value.type, contractTypes) ||
    !isOneOf(value.periodicite, periodicities) ||
    !isOneOf(value.statut, statuses) ||
    !finite(value.montantHT) ||
    !finite(value.visitesParAn) ||
    typeof value.reconductionAuto !== "boolean" ||
    !dateDebut ||
    !dateFin ||
    !prochaineFacturation
  ) return null;
  return {
    id,
    numero: value.numero,
    clientId: value.clientId,
    ascenseurIds: value.ascenseurIds,
    type: value.type,
    dateDebut,
    dateFin,
    periodicite: value.periodicite,
    montantHT: value.montantHT,
    visitesParAn: value.visitesParAn,
    reconductionAuto: value.reconductionAuto,
    statut: value.statut,
    conditionsParticulieres: text(value.conditionsParticulieres) ? value.conditionsParticulieres : "",
    prochaineFacturation,
    ...(text(value.createdBy) ? { createdBy: value.createdBy } : {}),
    ...(value.createdAt ? { createdAt: dateInput(value.createdAt) ?? undefined } : {}),
    ...(Array.isArray(value.facturesPeriodes)
      ? {
          facturesPeriodes: value.facturesPeriodes
            .map(parseFacturePeriode)
            .filter((period): period is FacturePeriode => period !== null),
        }
      : {}),
    ...(text(value.motifResiliation) ? { motifResiliation: value.motifResiliation } : {}),
    ...(text(value.counterKey) ? { counterKey: value.counterKey } : {}),
    ...(finite(value.sequence) ? { sequence: value.sequence } : {}),
    ...(finite(value.year) ? { year: value.year } : {}),
    ...(text(value.yearKey) ? { yearKey: value.yearKey } : {}),
  };
}

export function parseAscenseur(id: string, value: unknown): Ascenseur | null {
  if (!isRecord(value)) return null;
  const statuses: readonly AscenseurStatut[] = ["en_service", "en_panne", "arret", "en_installation"];
  if (
    !text(value.clientId) || !text(value.site) || !text(value.adresse) ||
    !text(value.marque) || !text(value.modele) || !text(value.numeroSerie) ||
    !finite(value.annee) || !finite(value.capacite) || !finite(value.nbNiveaux) ||
    !text(value.typeMachine) || !isOneOf(value.statut, statuses) ||
    !dateInput(value.dateMiseEnService) || !dateInput(value.prochaineVisite)
  ) return null;
  const dateMiseEnService = dateInput(value.dateMiseEnService);
  const prochaineVisite = dateInput(value.prochaineVisite);
  if (!dateMiseEnService || !prochaineVisite) return null;
  return {
    id,
    clientId: value.clientId,
    site: value.site,
    adresse: value.adresse,
    marque: value.marque,
    modele: value.modele,
    numeroSerie: value.numeroSerie,
    annee: value.annee,
    capacite: value.capacite,
    nbNiveaux: value.nbNiveaux,
    typeMachine: value.typeMachine,
    dateMiseEnService,
    prochaineVisite,
    statut: value.statut,
    ...(text(value.contratId) ? { contratId: value.contratId } : {}),
    ...(value.createdAt ? { createdAt: dateInput(value.createdAt) ?? undefined } : {}),
  };
}

function parseIntervention(id: string, value: unknown): Intervention | null {
  if (!isRecord(value)) return null;
  const types: readonly InterventionType[] = ["visite", "depannage", "installation"];
  const statuses: readonly InterventionStatut[] = ["a_planifier", "planifiee", "terminee"];
  if (
    !text(value.numero) || !text(value.ascenseurId) ||
    !isOneOf(value.type, types) ||
    !isOneOf(value.statut, statuses) ||
    !text(value.technicien) || !text(value.rapport) ||
    !Array.isArray(value.piecesUtilisees) ||
    !finite(value.duree) || typeof value.signatureClient !== "boolean" ||
    !text(value.nomSignataire) || !dateInput(value.date) ||
    !value.piecesUtilisees.every((piece) =>
      isRecord(piece) && text(piece.articleId) && text(piece.designation) && finite(piece.qte),
    )
  ) return null;
  const date = dateInput(value.date);
  if (!date) return null;
  return {
    id,
    numero: value.numero,
    ascenseurId: value.ascenseurId,
    type: value.type,
    date,
    technicien: value.technicien,
    rapport: value.rapport,
    piecesUtilisees: value.piecesUtilisees.map((piece) => ({
      articleId: piece.articleId,
      designation: piece.designation,
      qte: piece.qte,
    })),
    statut: value.statut,
    duree: value.duree,
    signatureClient: value.signatureClient,
    nomSignataire: value.nomSignataire,
    ...(text(value.descriptionProbleme) ? { descriptionProbleme: value.descriptionProbleme } : {}),
    ...(text(value.createdBy) ? { createdBy: value.createdBy } : {}),
    ...(value.createdAt ? { createdAt: dateInput(value.createdAt) ?? undefined } : {}),
    ...(text(value.counterKey) ? { counterKey: value.counterKey } : {}),
    ...(finite(value.sequence) ? { sequence: value.sequence } : {}),
    ...(finite(value.year) ? { year: value.year } : {}),
    ...(text(value.yearKey) ? { yearKey: value.yearKey } : {}),
  };
}

function useLiveCollection<T>(
  name: "contrats" | "ascenseurs" | "interventions",
  parse: (id: string, value: unknown) => T | null,
): LiveCollection<T> {
  const { user } = useAuth();
  const [state, setState] = useState<{ uid: string | null; value: LiveCollection<T> }>({
    uid: null,
    value: { items: [], loading: true, error: null },
  });
  useEffect(() => {
    if (!user) return;
    let active = true;
    let unsubscribe = () => {};
    try {
      unsubscribe = onSnapshot(
        collection(getFirebaseDb(), name),
        (snapshot) => {
          if (!active) return;
          const parsed = snapshot.docs.map((entry) => parse(entry.id, entry.data()));
          if (parsed.some((entry) => entry === null)) {
            setState({
              uid: user.uid,
              value: { items: [], loading: false, error: `Les données de « ${name} » sont invalides.` },
            });
            return;
          }
          setState({
            uid: user.uid,
            value: { items: parsed.filter((entry): entry is T => entry !== null), loading: false, error: null },
          });
        },
        (error) => {
          if (active) setState({ uid: user.uid, value: { items: [], loading: false, error: firestoreErrorMessage(error) } });
        },
      );
    } catch (error) {
      const message = firestoreErrorMessage(error);
      window.setTimeout(() => {
        if (active) setState({ uid: user.uid, value: { items: [], loading: false, error: message } });
      }, 0);
    }
    return () => {
      active = false;
      unsubscribe();
    };
  }, [name, parse, user]);
  if (!user) return { items: [], loading: false, error: null };
  if (state.uid !== user.uid) return { items: [], loading: true, error: null };
  return state.value;
}

export function useContrats(): LiveCollection<Contrat> {
  return useLiveCollection("contrats", parseContrat);
}

export function useAscenseurs(): LiveCollection<Ascenseur> {
  return useLiveCollection("ascenseurs", parseAscenseur);
}

export function useInterventions(): LiveCollection<Intervention> {
  return useLiveCollection("interventions", parseIntervention);
}
