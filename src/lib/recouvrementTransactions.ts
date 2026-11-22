import {
  Timestamp,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { computeDiscountedTotals } from "@/lib/computeDiscountedTotals";
import { nextDocumentNumberInTransaction } from "@/lib/documentNumber";
import { firestoreErrorMessage } from "@/lib/firestoreErrors";
import { assertOnline } from "@/lib/online";
import { canTransitionPaymentStatus } from "@/lib/recouvrement";
import { getFirebaseDb } from "@/lib/firebase";
import type {
  Document,
  Paiement,
  PaiementEvenement,
  PaymentStatus,
  Relance,
  UserRole,
} from "@/types";

export type PaymentInput = {
  paymentId: string;
  documentId: string;
  clientId: string;
  montant: number;
  mode: Paiement["mode"];
  reference: string;
  banque?: string;
  dateEncaissementPrevue?: Date;
};

export type PaymentResult = {
  paymentId: string;
  receiptId?: string;
  receiptNumber?: string;
  alreadyRecorded: boolean;
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function invoiceTotal(source: Record<string, unknown>, id: string): number {
  if (
    typeof source.clientId !== "string" ||
    !Array.isArray(source.lignes)
  ) throw new Error("Les données de la facture sont invalides.");
  const parsedLines = source.lignes.map((line) => {
    if (
      typeof line !== "object" ||
      line === null ||
      !("articleId" in line) ||
      typeof line.articleId !== "string" ||
      !("designation" in line) ||
      typeof line.designation !== "string" ||
      !("qte" in line) ||
      typeof line.qte !== "number" ||
      !("prixUnitaireHT" in line) ||
      typeof line.prixUnitaireHT !== "number"
    ) throw new Error("Une ligne de facture est invalide.");
    return {
      articleId: line.articleId,
      designation: line.designation,
      qte: line.qte,
      prixUnitaireHT: line.prixUnitaireHT,
    };
  });
  const amount = computeDiscountedTotals(
    parsedLines,
    typeof source.remisePct === "number" ? source.remisePct : 0,
  ).totalTTC;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Le montant de la facture ${id} est invalide.`);
  }
  return amount;
}

function invoiceStatus(total: number, paid: number): Document["statut"] {
  if (paid + 0.005 >= total) return "paye";
  if (paid > 0) return "partiel";
  return "en_attente";
}

function validPaymentAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0;
}

function initialPaymentStatus(mode: PaymentInput["mode"]): PaymentStatus {
  return mode === "cheque" || mode === "effet"
    ? "en_portefeuille"
    : "valide";
}

function counted(status: PaymentStatus): boolean {
  return status === "valide" || status === "encaisse";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === "string" &&
    ["valide", "en_portefeuille", "remis_banque", "encaisse", "impaye", "annule"].includes(value);
}

function timestampParts(value: unknown): { seconds: number; nanoseconds: number } {
  if (value instanceof Timestamp) {
    return { seconds: value.seconds, nanoseconds: value.nanoseconds };
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    const seconds = Math.floor(value.getTime() / 1000);
    return { seconds, nanoseconds: (value.getTime() - seconds * 1000) * 1_000_000 };
  }
  return { seconds: 0, nanoseconds: 0 };
}

function compareEventDates(left: unknown, right: unknown): number {
  const leftParts = timestampParts(left);
  const rightParts = timestampParts(right);
  return leftParts.seconds === rightParts.seconds
    ? leftParts.nanoseconds - rightParts.nanoseconds
    : leftParts.seconds - rightParts.seconds;
}

function dateFromClient(
  amount: number,
  mode: PaymentInput["mode"],
  reference: string,
  bank: string | undefined,
  planned: Date | undefined,
  status: PaymentStatus,
): void {
  if (!validPaymentAmount(amount)) {
    throw new Error("Le montant doit être supérieur à zéro.");
  }
  if (!reference.trim()) throw new Error("La référence du paiement est obligatoire.");
  if (
    (mode === "cheque" || mode === "effet") &&
    (!planned || !Number.isFinite(planned.getTime()))
  ) throw new Error("La date d’encaissement prévue est obligatoire pour un chèque ou un effet.");
  if (mode === "cheque" && !bank?.trim()) {
    throw new Error("La banque est obligatoire pour un chèque.");
  }
  if (status === "valide" && (mode === "cheque" || mode === "effet")) {
    throw new Error("Un chèque ou un effet ne peut être validé avant son encaissement.");
  }
}

async function writeReceipt(
  transaction: import("firebase/firestore").Transaction,
  db: import("firebase/firestore").Firestore,
  payment: Pick<Paiement, "id" | "documentId" | "clientId" | "montant" | "mode" | "reference">,
  invoiceNumber: string,
  receiptDate: Date,
  userId: string,
): Promise<{ id: string; number: string }> {
  const receiptId = `recu-${payment.id}`;
  const allocation = await nextDocumentNumberInTransaction(
    transaction,
    db,
    "recu",
    receiptDate,
    receiptId,
  );
  const lineAmount = roundMoney(payment.montant / 1.2);
  const receipt: Document = {
    id: receiptId,
    type: "recu",
    numero: allocation.numero,
    clientId: payment.clientId,
    dateCreation: receiptDate,
    lignes: [{
      articleId: payment.documentId,
      designation: `Paiement de la facture ${invoiceNumber} · ${payment.reference}`,
      qte: 1,
      prixUnitaireHT: lineAmount,
    }],
    statut: "paye",
    modePaiement: payment.mode,
    createdBy: userId,
    montantTTC: payment.montant,
    paymentId: payment.id,
  };
  transaction.set(doc(db, "documents", receiptId), {
    ...receipt,
    counterKey: allocation.counterKey,
    sequence: allocation.sequence,
    year: allocation.year,
    yearKey: allocation.yearKey,
    dateCreation: Timestamp.fromDate(receiptDate),
    createdAt: serverTimestamp(),
  });
  return { id: receiptId, number: allocation.numero };
}

export async function enregistrerPaiement(
  input: PaymentInput,
  userId: string,
): Promise<PaymentResult> {
  assertOnline();
  dateFromClient(
    input.montant,
    input.mode,
    input.reference,
    input.banque,
    input.dateEncaissementPrevue,
    initialPaymentStatus(input.mode),
  );
  const db = getFirebaseDb();
  const paymentRef = doc(db, "paiements", input.paymentId);
  const invoiceRef = doc(db, "documents", input.documentId);
  const clientRef = doc(db, "clients", input.clientId);
  try {
    return await runTransaction(db, async (transaction) => {
      const [paymentSnapshot, invoiceSnapshot, clientSnapshot] = await Promise.all([
        transaction.get(paymentRef),
        transaction.get(invoiceRef),
        transaction.get(clientRef),
      ]);
      if (paymentSnapshot.exists()) {
        const existing = paymentSnapshot.data();
        return {
          paymentId: input.paymentId,
          ...(typeof existing.recuDocumentId === "string"
            ? { receiptId: existing.recuDocumentId }
            : {}),
          alreadyRecorded: true,
        };
      }
      if (!invoiceSnapshot.exists() || !clientSnapshot.exists()) {
        throw new Error("La facture ou le client n’existe plus.");
      }
      const invoice = invoiceSnapshot.data();
      if (invoice.type !== "facture" || invoice.clientId !== input.clientId) {
        throw new Error("Le paiement ne correspond pas à cette facture.");
      }
      if (invoice.statut === "annule") throw new Error("Une facture annulée ne peut pas être réglée.");
      const total = invoiceTotal(invoice, input.documentId);
      const paid = typeof invoice.montantPaye === "number" && Number.isFinite(invoice.montantPaye)
        ? roundMoney(invoice.montantPaye)
        : 0;
      const balance = roundMoney(total - paid);
      if (input.montant > balance + 0.005) {
        throw new Error(`Le montant dépasse le solde restant de ${balance.toFixed(2)} MAD.`);
      }
      const paymentDate = new Date();
      const status = initialPaymentStatus(input.mode);
      const payment: Paiement = {
        id: input.paymentId,
        documentId: input.documentId,
        clientId: input.clientId,
        montant: roundMoney(input.montant),
        mode: input.mode,
        reference: input.reference.trim(),
        ...(input.banque?.trim() ? { banque: input.banque.trim() } : {}),
        ...(input.dateEncaissementPrevue
          ? { dateEncaissementPrevue: input.dateEncaissementPrevue }
          : {}),
        statut: status,
        ...(typeof invoice.createdBy === "string"
          ? { invoiceCreatedBy: invoice.createdBy }
          : {}),
        userId,
        date: paymentDate,
      };
      let receipt: { id: string; number: string } | null = null;
      if (counted(status)) {
        receipt = await writeReceipt(
          transaction,
          db,
          payment,
          String(invoice.numero ?? input.documentId),
          paymentDate,
          userId,
        );
        payment.recuDocumentId = receipt.id;
      }
      const nextPaid = roundMoney(paid + (counted(status) ? payment.montant : 0));
      transaction.set(paymentRef, {
        ...payment,
        date: serverTimestamp(),
        ...(input.dateEncaissementPrevue
          ? { dateEncaissementPrevue: Timestamp.fromDate(input.dateEncaissementPrevue) }
          : {}),
      });
      transaction.update(invoiceRef, {
        montantTTC: total,
        montantPaye: nextPaid,
        statut: invoiceStatus(total, nextPaid),
        lastPaymentId: input.paymentId,
      });
      return {
        paymentId: input.paymentId,
        ...(receipt ? { receiptId: receipt.id, receiptNumber: receipt.number } : {}),
        alreadyRecorded: false,
      };
    });
  } catch (error) {
    throw new Error(firestoreErrorMessage(error));
  }
}

export async function changerStatutPaiement(
  payment: Paiement,
  nextStatus: PaymentStatus,
  userId: string,
  role: UserRole,
  motif?: string,
): Promise<PaymentResult> {
  assertOnline();
  if (nextStatus === "annule" && (role !== "owner" || !motif?.trim())) {
    throw new Error("Seul le propriétaire peut annuler un paiement avec un motif obligatoire.");
  }
  if (nextStatus !== "annule" && nextStatus !== "encaisse" && nextStatus !== "remis_banque" && nextStatus !== "impaye") {
    throw new Error("Cette transition de paiement n’est pas autorisée.");
  }
  const db = getFirebaseDb();
  const paymentRef = doc(db, "paiements", payment.id);
  const invoiceRef = doc(db, "documents", payment.documentId);
  const eventId = `${payment.id}-${nextStatus}`;
  const eventStatuses = ["remis_banque", "encaisse", "impaye", "annule"] as const;
  const eventRefs = eventStatuses.map((status) =>
    doc(db, "paiementEvenements", `${payment.id}-${status}`),
  );
  try {
    return await runTransaction(db, async (transaction) => {
      const [paymentSnapshot, invoiceSnapshot, ...eventSnapshots] = await Promise.all([
        transaction.get(paymentRef),
        transaction.get(invoiceRef),
        ...eventRefs.map((reference) => transaction.get(reference)),
      ]);
      if (!paymentSnapshot.exists() || !invoiceSnapshot.exists()) {
        throw new Error("Le paiement ou sa facture n’existe plus.");
      }
      const targetEventIndex = eventStatuses.findIndex((status) => status === nextStatus);
      if (targetEventIndex < 0) throw new Error("Cette transition de paiement n’est pas autorisée.");
      if (eventSnapshots[targetEventIndex]?.exists()) {
        return { paymentId: payment.id, alreadyRecorded: true };
      }
      const stored: unknown = paymentSnapshot.data();
      if (
        !isRecord(stored) ||
        !isPaymentStatus(stored.statut) ||
        typeof stored.montant !== "number" ||
        !Number.isFinite(stored.montant) ||
        stored.documentId !== payment.documentId ||
        stored.clientId !== payment.clientId ||
        stored.montant !== payment.montant ||
        stored.mode !== payment.mode ||
        stored.reference !== payment.reference
      ) {
        throw new Error("Les données du paiement ont changé. Rechargez la page.");
      }
      const historicalEvents = eventSnapshots.flatMap((snapshot) =>
        snapshot.exists() ? [snapshot.data()] : [],
      );
      const latestEvent = historicalEvents
        .filter((event) => isPaymentStatus(event.statut))
        .sort((left, right) => compareEventDates(right.date, left.date))[0];
      const currentStatus = latestEvent && isPaymentStatus(latestEvent.statut)
        ? latestEvent.statut
        : stored.statut;
      if (!canTransitionPaymentStatus(currentStatus, nextStatus)) {
        throw new Error("Le statut actuel ne permet pas cette opération.");
      }
      const invoice = invoiceSnapshot.data();
      if (invoice.type !== "facture") throw new Error("La facture liée est invalide.");
      const total = invoiceTotal(invoice, payment.documentId);
      const currentPaid = typeof invoice.montantPaye === "number" ? invoice.montantPaye : 0;
      const previousCounts = counted(currentStatus);
      const nextCounts = counted(nextStatus);
      const nextPaid = roundMoney(
        Math.max(0, currentPaid + (nextCounts ? stored.montant : 0) - (previousCounts ? stored.montant : 0)),
      );
      const now = new Date();
      let receipt: { id: string; number: string } | null = null;
      const existingReceiptId =
        typeof stored.recuDocumentId === "string"
          ? stored.recuDocumentId
          : typeof latestEvent?.recuDocumentId === "string"
            ? latestEvent.recuDocumentId
            : undefined;
      const trustedPayment: Paiement = {
        ...payment,
        montant: stored.montant,
        statut: stored.statut,
        ...(existingReceiptId ? { recuDocumentId: existingReceiptId } : {}),
      };
      if (nextStatus === "encaisse" && !existingReceiptId) {
        receipt = await writeReceipt(
          transaction,
          db,
          trustedPayment,
          String(invoice.numero ?? payment.documentId),
          now,
          userId,
        );
      }
      const event: PaiementEvenement = {
        id: eventId,
        paiementId: payment.id,
        documentId: payment.documentId,
        statut: nextStatus,
        ...(nextStatus === "annule" ? { motif: motif?.trim() } : {}),
        ...(receipt ? { recuDocumentId: receipt.id } : {}),
        ...(typeof invoice.createdBy === "string"
          ? { invoiceCreatedBy: invoice.createdBy }
          : {}),
        userId,
        date: now,
      };
      transaction.set(eventRefs[targetEventIndex], {
        ...event,
        date: serverTimestamp(),
      });
      transaction.update(invoiceRef, {
        montantTTC: total,
        montantPaye: nextPaid,
        statut: invoiceStatus(total, nextPaid),
        lastPaymentId: payment.id,
      });
      return {
        paymentId: payment.id,
        ...(receipt ? { receiptId: receipt.id, receiptNumber: receipt.number } : {}),
        alreadyRecorded: false,
      };
    });
  } catch (error) {
    throw new Error(firestoreErrorMessage(error));
  }
}

export async function enregistrerRelance(
  reminder: Omit<Relance, "id" | "date" | "userId">,
  userId: string,
  reminderId: string = crypto.randomUUID(),
): Promise<string> {
  assertOnline();
  if (!reminder.clientId || !reminder.documentIds.length || !reminder.note.trim()) {
    throw new Error("Sélectionnez une facture et renseignez le compte rendu de la relance.");
  }
  if (
    reminder.promesseMontant !== undefined &&
    (!Number.isFinite(reminder.promesseMontant) || reminder.promesseMontant <= 0)
  ) throw new Error("Le montant de la promesse doit être supérieur à zéro.");
  const db = getFirebaseDb();
  try {
    await runTransaction(db, async (transaction) => {
      const clientRef = doc(db, "clients", reminder.clientId);
      const clientSnapshot = await transaction.get(clientRef);
      if (!clientSnapshot.exists()) throw new Error("Ce client n’existe plus.");
      const invoiceRefs = reminder.documentIds.map((id) => doc(db, "documents", id));
      const invoices = await Promise.all(invoiceRefs.map((reference) => transaction.get(reference)));
      if (invoices.some((invoice) => !invoice.exists() || invoice.data().clientId !== reminder.clientId)) {
        throw new Error("Une facture sélectionnée ne correspond pas au client.");
      }
      transaction.set(doc(db, "relances", reminderId), {
        ...reminder,
        note: reminder.note.trim(),
        userId,
        date: serverTimestamp(),
        ...(reminder.promessePaiementDate
          ? { promessePaiementDate: Timestamp.fromDate(new Date(reminder.promessePaiementDate as Date)) }
          : {}),
      });
    });
    return reminderId;
  } catch (error) {
    throw new Error(firestoreErrorMessage(error));
  }
}
