import type {
  Contrat,
  ContratStatut,
  DateInput,
  Periodicite,
} from "@/types";

const periodMonths: Record<Periodicite, number> = {
  mensuelle: 1,
  trimestrielle: 3,
  annuelle: 12,
};

function validDate(input: DateInput): Date {
  let date: Date;
  if (input instanceof Date) date = new Date(input.getTime());
  else if (typeof input === "number") {
    date = new Date(input < 1e11 ? input * 1000 : input);
  } else if (typeof input === "string") {
    const frenchDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input);
    date = frenchDate
      ? new Date(Number(frenchDate[3]), Number(frenchDate[2]) - 1, Number(frenchDate[1]))
      : new Date(input);
  } else if (input && "toDate" in input && typeof input.toDate === "function") {
    date = input.toDate();
  } else if (input && "seconds" in input) {
    date = new Date(input.seconds * 1000);
  } else {
    throw new Error("La date fournie au calcul du contrat est invalide.");
  }
  if (Number.isNaN(date.getTime())) {
    throw new Error("La date fournie au calcul du contrat est invalide.");
  }
  return date;
}

export function addMonths(input: Date, months: number): Date {
  const date = new Date(input.getTime());
  const targetDay = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(targetDay, lastDay));
  return date;
}

export function getContratStatut(
  contrat: Pick<Contrat, "statut" | "dateFin">,
  now: Date = new Date(),
): ContratStatut {
  if (contrat.statut === "resilie" || contrat.statut === "brouillon") {
    return contrat.statut;
  }
  const end = validDate(contrat.dateFin);
  const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return end < currentDay ? "expire" : "actif";
}

export function contratNeedsRenewal(
  contrat: Pick<Contrat, "statut" | "dateFin">,
  now: Date = new Date(),
): boolean {
  if (getContratStatut(contrat, now) !== "actif") return false;
  const parsedEnd = validDate(contrat.dateFin);
  const end = new Date(
    parsedEnd.getFullYear(),
    parsedEnd.getMonth(),
    parsedEnd.getDate(),
  );
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
  return days >= 0 && days <= 60;
}

export function computeProchaineVisite(
  date: DateInput,
  periodicite: Periodicite,
): Date {
  return addMonths(validDate(date), periodMonths[periodicite]);
}

export type FacturationPeriod = {
  key: string;
  debut: Date;
  fin: Date;
};

export function periodeFacturation(
  contrat: Pick<
    Contrat,
    "dateDebut" | "dateFin" | "prochaineFacturation" | "periodicite"
  >,
): FacturationPeriod {
  const debut = validDate(contrat.prochaineFacturation ?? contrat.dateDebut);
  const finDuContrat = validDate(contrat.dateFin);
  const fin = addMonths(debut, periodMonths[contrat.periodicite]);
  const cappedEnd = fin > finDuContrat ? finDuContrat : fin;
  const iso = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { key: `${iso(debut)}_${iso(cappedEnd)}`, debut, fin: cappedEnd };
}
