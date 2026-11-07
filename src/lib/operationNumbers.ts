import {
  doc,
  serverTimestamp,
  type Firestore,
  type Transaction,
} from "firebase/firestore";

export type OperationNumber = {
  numero: string;
  counterKey: string;
  sequence: number;
  year: number;
  yearKey: string;
};

export async function nextOperationNumberInTransaction(
  transaction: Transaction,
  db: Firestore,
  kind: "contrat" | "intervention",
  date: Date,
  recordId: string,
): Promise<OperationNumber> {
  const year = date.getFullYear();
  const yearKey = String(year);
  const counterKey = `${kind}_${year}`;
  const counterRef = doc(db, "counters", counterKey);
  const snapshot = await transaction.get(counterRef);
  const data = snapshot.data();
  const previous = snapshot.exists() ? data?.sequence : 0;
  if (typeof previous !== "number" || !Number.isSafeInteger(previous) || previous < 0) {
    throw new Error(`Le compteur ${counterKey} est invalide.`);
  }
  const sequence = previous + 1;
  const prefix = kind === "contrat" ? "CTR" : "INT";
  transaction.set(counterRef, {
    sequence,
    type: kind,
    year,
    yearKey,
    lastDocumentId: recordId,
    updatedAt: serverTimestamp(),
  });
  return {
    numero: `${prefix}-${year}-${String(sequence).padStart(4, "0")}`,
    counterKey,
    sequence,
    year,
    yearKey,
  };
}
