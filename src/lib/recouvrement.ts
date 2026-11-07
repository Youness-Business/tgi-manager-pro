import { computeDiscountedTotals } from "@/lib/computeDiscountedTotals";
import type { DateInput, Document, Paiement, PaymentStatus, Relance } from "@/types";

export type TrancheAge =
  | "non_echue"
  | "1-30"
  | "31-60"
  | "61-90"
  | "90+";

export type BalanceAgee = Record<TrancheAge, { montant: number; factures: number }>;

const activePaymentStatuses: readonly PaymentStatus[] = ["valide", "encaisse"];

export function canTransitionPaymentStatus(
  current: PaymentStatus,
  next: PaymentStatus,
): boolean {
  return (
    (current === "en_portefeuille" &&
      ["remis_banque", "encaisse", "impaye", "annule"].includes(next)) ||
    (current === "remis_banque" &&
      ["encaisse", "impaye", "annule"].includes(next)) ||
    (current === "encaisse" && ["impaye", "annule"].includes(next)) ||
    (current === "valide" && next === "annule")
  );
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function validDate(input: DateInput): Date | null {
  try {
    let date: Date;
    if (input instanceof Date) date = new Date(input.getTime());
    else if (typeof input === "number") {
      date = new Date(input < 1e11 ? input * 1000 : input);
    } else if (typeof input === "string") {
      if (!input.trim()) return null;
      date = new Date(input);
    } else if (input && "toDate" in input && typeof input.toDate === "function") {
      date = input.toDate();
    } else if (input && "seconds" in input) {
      date = new Date(input.seconds * 1000);
    } else {
      return null;
    }
    const year = date.getFullYear();
    if (!Number.isFinite(date.getTime()) || year < 2000 || year > 2100) return null;
    return date;
  } catch {
    return null;
  }
}

function invoiceTotal(document: Document): number {
  return computeDiscountedTotals(document.lignes, document.remisePct).totalTTC;
}

export function paymentCountsAsPaid(payment: Pick<Paiement, "statut" | "montant">): boolean {
  return activePaymentStatuses.includes(payment.statut) && Number.isFinite(payment.montant);
}

export function computeSolde(
  document: Document,
  paiements: readonly Paiement[],
): number {
  if (document.type !== "facture" || document.statut === "annule") return 0;
  const invoicePayments = paiements.filter((payment) => payment.documentId === document.id);
  if (invoicePayments.length === 0 && document.statut === "paye") return 0;
  const paid = invoicePayments
    .filter(paymentCountsAsPaid)
    .reduce((sum, payment) => sum + payment.montant, 0);
  return roundMoney(Math.max(0, invoiceTotal(document) - paid));
}

export function getDocumentStatut(
  document: Document,
  paiements: readonly Paiement[],
): Document["statut"] {
  if (document.statut === "annule") return "annule";
  if (document.type !== "facture") return document.statut;
  const total = invoiceTotal(document);
  const balance = computeSolde(document, paiements);
  if (balance <= 0.005 && total > 0) return "paye";
  if (balance < total) return "partiel";
  return "en_attente";
}

export function getRetardJours(dateEcheance: DateInput, aujourdhui: Date = new Date()): number | null {
  const due = validDate(dateEcheance);
  const now = validDate(aujourdhui);
  if (!due || !now) return null;
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86_400_000));
}

export function getTrancheAge(retard: number | null): TrancheAge {
  if (retard === null || retard <= 0) return "non_echue";
  if (retard <= 30) return "1-30";
  if (retard <= 60) return "31-60";
  if (retard <= 90) return "61-90";
  return "90+";
}

export function computeBalanceAgee(
  documents: readonly Document[],
  paiements: readonly Paiement[],
  aujourdhui: Date = new Date(),
): BalanceAgee {
  const balance: BalanceAgee = {
    non_echue: { montant: 0, factures: 0 },
    "1-30": { montant: 0, factures: 0 },
    "31-60": { montant: 0, factures: 0 },
    "61-90": { montant: 0, factures: 0 },
    "90+": { montant: 0, factures: 0 },
  };
  for (const document of documents) {
    if (document.type !== "facture" || document.statut === "annule") continue;
    const due = validDate(document.dateEcheance);
    if (!due) continue;
    const solde = computeSolde(document, paiements);
    if (solde <= 0) continue;
    const tranche = getTrancheAge(getRetardJours(due, aujourdhui));
    balance[tranche].montant = roundMoney(balance[tranche].montant + solde);
    balance[tranche].factures += 1;
  }
  return balance;
}

export function isPromesseNonTenue(
  relance: Relance,
  paiements: readonly Paiement[],
  aujourdhui: Date = new Date(),
): boolean {
  if (relance.promesseMontant === undefined) return false;
  const promiseDate = validDate(relance.promessePaiementDate);
  const reminderDate = validDate(relance.date);
  const now = validDate(aujourdhui);
  if (!promiseDate || !reminderDate || !now || now.getTime() <= promiseDate.getTime()) {
    return false;
  }
  const collected = paiements
    .filter(
      (payment) =>
        relance.documentIds.includes(payment.documentId) &&
        paymentCountsAsPaid(payment),
    )
    .reduce((sum, payment) => {
      const paidAt = validDate(payment.date);
      return paidAt &&
        paidAt.getTime() >= reminderDate.getTime() &&
        paidAt.getTime() <= promiseDate.getTime()
        ? sum + payment.montant
        : sum;
    }, 0);
  return collected + 0.005 < relance.promesseMontant;
}

export function suggestRelanceNiveau(
  retard: number | null,
  relances: readonly Relance[],
  paiements: readonly Paiement[] = [],
  aujourdhui: Date = new Date(),
): 1 | 2 | 3 | null {
  if (retard === null || retard <= 0) return null;
  const unkeptPromise = relances.some((reminder) =>
    isPromesseNonTenue(reminder, paiements, aujourdhui),
  );
  if (retard >= 45) return 3;
  if (retard >= 15 || unkeptPromise) return 2;
  return 1;
}

export function computeTauxRecouvrement(
  documents: readonly Document[],
  paiements: readonly Paiement[],
  debut: Date,
  fin: Date,
): number {
  const start = validDate(debut);
  const end = validDate(fin);
  if (!start || !end || end.getTime() <= start.getTime()) return 0;
  const invoices = documents.filter((document) => {
    if (document.type !== "facture" || document.statut === "annule") return false;
    const created = validDate(document.dateCreation);
    return Boolean(created && created >= start && created < end);
  });
  const billed = invoices.reduce((sum, invoice) => sum + invoiceTotal(invoice), 0);
  if (billed <= 0) return 0;
  const invoiceIds = new Set(invoices.map((invoice) => invoice.id));
  const collected = paiements
    .filter(
      (payment) =>
        invoiceIds.has(payment.documentId) &&
        paymentCountsAsPaid(payment) &&
        validDate(payment.date) !== null &&
        (validDate(payment.date)?.getTime() ?? 0) >= start.getTime() &&
        (validDate(payment.date)?.getTime() ?? 0) < end.getTime(),
    )
    .reduce((sum, payment) => sum + payment.montant, 0);
  return Math.round((Math.min(1, collected / billed) + Number.EPSILON) * 10000) / 100;
}

export function computeDSO(
  documents: readonly Document[],
  paiements: readonly Paiement[],
  aujourdhui: Date = new Date(),
  periodeJours = 90,
): number {
  const now = validDate(aujourdhui);
  if (!now || !Number.isFinite(periodeJours) || periodeJours <= 0) return 0;
  const start = new Date(now.getTime() - periodeJours * 86_400_000);
  const invoices = documents.filter((document) => {
    if (document.type !== "facture" || document.statut === "annule") return false;
    const created = validDate(document.dateCreation);
    return Boolean(created && created >= start && created <= now);
  });
  const billed = invoices.reduce((sum, invoice) => sum + invoiceTotal(invoice), 0);
  if (billed <= 0) return 0;
  const receivables = invoices.reduce(
    (sum, invoice) => sum + computeSolde(invoice, paiements),
    0,
  );
  return Math.round((receivables / billed) * periodeJours);
}
