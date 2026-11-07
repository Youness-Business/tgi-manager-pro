import type { Document, DocumentType } from "@/types";
import {
  doc,
  serverTimestamp,
  type Firestore,
  type Transaction,
} from "firebase/firestore";

const prefixes: Record<DocumentType, string> = {
  facture: "FAC",
  devis: "DEV",
  recu: "REC",
  bon_livraison: "BL",
};

export function documentNumberPrefix(type: DocumentType): string {
  return prefixes[type];
}

export function nextDocumentNumber(
  type: DocumentType,
  existingDocs: readonly Document[],
  date: Date = new Date(),
): string {
  const year = date.getFullYear();
  const prefix = documentNumberPrefix(type);
  const matcher = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  let maxSequence = 0;

  for (const document of existingDocs) {
    const match = matcher.exec(document.numero);
    if (match) maxSequence = Math.max(maxSequence, Number(match[1]));
  }

  const sequence = maxSequence + 1;
  return `${prefix}-${year}-${String(sequence).padStart(4, "0")}`;
}

export type FirestoreDocumentNumber = {
  numero: string;
  counterKey: string;
  sequence: number;
  year: number;
  yearKey: string;
};

export async function nextDocumentNumberInTransaction(
  transaction: Transaction,
  db: Firestore,
  type: DocumentType,
  date: Date,
  documentId: string,
): Promise<FirestoreDocumentNumber> {
  const year = date.getFullYear();
  const yearKey = String(year);
  const counterKey = `${type}_${year}`;
  const counterRef = doc(db, "counters", counterKey);
  const counterSnapshot = await transaction.get(counterRef);
  const counterData: unknown = counterSnapshot.data();
  const previousSequence =
    counterSnapshot.exists() &&
    typeof counterData === "object" &&
    counterData !== null &&
    "sequence" in counterData
      ? Number(counterData.sequence)
      : 0;
  if (!Number.isSafeInteger(previousSequence) || previousSequence < 0) {
    throw new Error(`Le compteur de numérotation ${counterKey} est invalide.`);
  }

  const sequence = previousSequence + 1;
  transaction.set(counterRef, {
    sequence,
    type,
    year,
    yearKey,
    lastDocumentId: documentId,
    updatedAt: serverTimestamp(),
  });
  return {
    numero: `${documentNumberPrefix(type)}-${year}-${String(sequence).padStart(4, "0")}`,
    counterKey,
    sequence,
    year,
    yearKey,
  };
}
