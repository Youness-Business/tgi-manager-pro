"use client";

import {
  Timestamp,
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/context/AuthProvider";
import { nextDocumentNumberInTransaction } from "@/lib/documentNumber";
import { computeDiscountedTotals } from "@/lib/computeDiscountedTotals";
import { getFirebaseDb } from "@/lib/firebase";
import { assertOnline } from "@/lib/online";
import { firestoreErrorMessage } from "@/lib/firestoreErrors";
import {
  commitStockMovementPlan,
  planStockMovementsFromLines,
} from "@/lib/stockTransactions";
import type {
  DateInput,
  Document,
  DocumentStatus,
  DocumentType,
  LigneDocument,
} from "@/types";

type DocumentsContextValue = {
  documents: Document[];
  loading: boolean;
  error: string | null;
  addDocument: (
    document: Document,
    options?: { deduireDuStock?: boolean; bonLivraisonId?: string },
  ) => Promise<Document>;
  clearError: () => void;
};

const DocumentsContext = createContext<DocumentsContextValue | null>(null);

type DocumentsState = {
  uid: string | null;
  documents: Document[];
  loading: boolean;
  error: string | null;
};

const validTypes: readonly DocumentType[] = [
  "facture",
  "devis",
  "recu",
  "bon_livraison",
];
const validStatuses: readonly DocumentStatus[] = [
  "en_attente",
  "partiel",
  "paye",
  "annule",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseDate(value: unknown): DateInput | null {
  if (value instanceof Date || typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (isRecord(value) && typeof value.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date ? date : null;
  }
  if (isRecord(value) && typeof value.seconds === "number") {
    return {
      seconds: value.seconds,
      ...(typeof value.nanoseconds === "number"
        ? { nanoseconds: value.nanoseconds }
        : {}),
    };
  }
  return null;
}

function parseLines(value: unknown): LigneDocument[] | null {
  if (!Array.isArray(value)) return null;
  const parsed: LigneDocument[] = [];
  for (const candidate of value) {
    if (
      !isRecord(candidate) ||
      typeof candidate.articleId !== "string" ||
      typeof candidate.designation !== "string" ||
      typeof candidate.qte !== "number" ||
      !Number.isFinite(candidate.qte) ||
      typeof candidate.prixUnitaireHT !== "number" ||
      !Number.isFinite(candidate.prixUnitaireHT)
    ) {
      return null;
    }
    parsed.push({
      articleId: candidate.articleId,
      designation: candidate.designation,
      qte: candidate.qte,
      prixUnitaireHT: candidate.prixUnitaireHT,
      ...(typeof candidate.reference === "string"
        ? { reference: candidate.reference }
        : {}),
    });
  }
  return parsed;
}

function parseDocument(id: string, source: unknown): Document | null {
  if (!isRecord(source)) return null;
  const value = source;
  const dateCreation = parseDate(value.dateCreation);
  const lignes = parseLines(value.lignes);
  if (
    typeof value.type !== "string" ||
    !validTypes.some((type) => type === value.type) ||
    typeof value.numero !== "string" ||
    typeof value.clientId !== "string" ||
    typeof value.statut !== "string" ||
    !validStatuses.some((status) => status === value.statut) ||
    !dateCreation ||
    !lignes
  ) {
    return null;
  }
  const document: Document = {
    id,
    type: value.type as DocumentType,
    numero: value.numero,
    clientId: value.clientId,
    dateCreation,
    lignes,
    statut: value.statut as DocumentStatus,
  };
  if (typeof value.stockApplied === "boolean") {
    document.stockApplied = value.stockApplied;
  }
  if (typeof value.bonLivraisonId === "string") {
    document.bonLivraisonId = value.bonLivraisonId;
  }
  if (typeof value.remisePct === "number") document.remisePct = value.remisePct;
  if (
    value.modePaiement === "especes" ||
    value.modePaiement === "virement" ||
    value.modePaiement === "cheque" ||
    value.modePaiement === "effet"
  ) {
    document.modePaiement = value.modePaiement;
  }
  if (typeof value.dateEcheance === "number" || typeof value.dateEcheance === "string" || (isRecord(value.dateEcheance) && typeof value.dateEcheance.toDate === "function") || (isRecord(value.dateEcheance) && typeof value.dateEcheance.seconds === "number")) {
    document.dateEcheance = parseDate(value.dateEcheance);
  }
  if (typeof value.montantPaye === "number" && Number.isFinite(value.montantPaye)) {
    document.montantPaye = value.montantPaye;
  }
  if (typeof value.montantTTC === "number" && Number.isFinite(value.montantTTC)) {
    document.montantTTC = value.montantTTC;
  }
  if (typeof value.paymentId === "string") document.paymentId = value.paymentId;
  if (typeof value.createdBy === "string") document.createdBy = value.createdBy;
  const createdAt = parseDate(value.createdAt);
  if (createdAt) document.createdAt = createdAt;
  return document;
}

function parseDocumentDate(value: DateInput): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    return new Date(value < 1e11 ? value * 1000 : value);
  }
  if (typeof value === "string") return new Date(value);
  if (value && "toDate" in value) return value.toDate();
  if (value && "seconds" in value) return new Date(value.seconds * 1000);
  return new Date();
}

export function DocumentsProvider({ children }: { children: ReactNode }) {
  const { user, profile, status } = useAuth();
  const readyUid = status === "ready" ? user?.uid ?? null : null;
  const readyRole = status === "ready" ? profile?.role ?? null : null;
  const readyUserName = status === "ready" ? profile?.nom ?? "" : "";
  const [state, setState] = useState<DocumentsState>({
    uid: null,
    documents: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!readyUid) return;
    let active = true;
    try {
      const documentsCollection = collection(getFirebaseDb(), "documents");
      const documentsQuery =
        readyRole === "commercial"
          ? query(documentsCollection, where("createdBy", "==", readyUid))
          : documentsCollection;
      const unsubscribe = onSnapshot(
        documentsQuery,
        (snapshot) => {
          if (!active) return;
          const parsed = snapshot.docs.map((item) =>
            parseDocument(item.id, item.data()),
          );
          if (parsed.some((item) => item === null)) {
            setState({
              uid: readyUid,
              documents: [],
              loading: false,
              error:
                "Un ou plusieurs documents Firestore sont invalides. Vérifiez leurs données.",
            });
          } else {
            setState({
              uid: readyUid,
              documents: parsed.filter((item): item is Document => item !== null),
              loading: false,
              error: null,
            });
          }
        },
        (snapshotError) => {
          if (!active) return;
          setState({
            uid: readyUid,
            documents: [],
            loading: false,
            error: firestoreErrorMessage(snapshotError),
          });
        },
      );
      return () => {
        active = false;
        unsubscribe();
      };
    } catch (snapshotError) {
      const message = firestoreErrorMessage(snapshotError);
      window.setTimeout(() => {
        if (!active) return;
        setState({
          uid: readyUid,
          documents: [],
          loading: false,
          error: message,
        });
      }, 0);
      return () => {
        active = false;
      };
    }
  }, [readyUid, readyRole]);

  const addDocument = useCallback(
    async (
      candidate: Document,
      options?: { deduireDuStock?: boolean; bonLivraisonId?: string },
    ): Promise<Document> => {
      assertOnline();
      if (!readyUid) throw new Error("Une session active est nécessaire pour créer un document.");
      const db = getFirebaseDb();
      const documentRef = doc(db, "documents", candidate.id);
      const documentDate = parseDocumentDate(candidate.dateCreation);
      if (Number.isNaN(documentDate.getTime())) {
        throw new Error("La date du document n’est pas valide.");
      }
      try {
        const createdDocument = await runTransaction(db, async (transaction) => {
          if (options?.deduireDuStock && candidate.type !== "facture") {
            throw new Error("La déduction de stock est réservée aux factures.");
          }
          const paymentDelay =
            candidate.type === "facture"
              ? await paymentDelayInTransaction(
                  transaction,
                  db,
                  candidate.clientId,
                )
              : null;
          if (options?.bonLivraisonId) {
            const deliverySnapshot = await transaction.get(
              doc(db, "documents", options.bonLivraisonId),
            );
            if (
              !deliverySnapshot.exists() ||
              deliverySnapshot.data().type !== "bon_livraison" ||
              deliverySnapshot.data().clientId !== candidate.clientId
            ) {
              throw new Error(
                "Le bon de livraison associé est introuvable ou ne correspond pas au client.",
              );
            }
            if (
              options.deduireDuStock &&
              deliverySnapshot.data().stockApplied === true
            ) {
              throw new Error(
                "Le stock a déjà été décompté depuis le bon de livraison associé.",
              );
            }
          }
          const movementPlan = options?.deduireDuStock
            ? await planStockMovementsFromLines(
                transaction,
                db,
                candidate.lignes,
                {
                  source: "document",
                  parentId: candidate.id,
                  documentId: candidate.id,
                  motif: "Déduction de stock lors de la création de facture",
                },
              )
            : null;
          const allocation = await nextDocumentNumberInTransaction(
            transaction,
            db,
            candidate.type,
            documentDate,
            candidate.id,
          );
          const nextDocument: Document = {
            ...candidate,
            numero: allocation.numero,
            createdBy: readyUid,
            stockApplied: Boolean(options?.deduireDuStock),
            ...(candidate.type === "facture"
              ? {
                  statut: "en_attente" as const,
                  montantPaye: 0,
                  montantTTC: computeDiscountedTotals(
                    candidate.lignes,
                    candidate.remisePct,
                  ).totalTTC,
                }
              : {}),
            ...(options?.bonLivraisonId
              ? { bonLivraisonId: options.bonLivraisonId }
              : {}),
          };
          if (movementPlan) {
            commitStockMovementPlan(
              transaction,
              movementPlan,
              readyUid,
              readyUserName,
            );
          }
          transaction.set(documentRef, {
            ...nextDocument,
            counterKey: allocation.counterKey,
            sequence: allocation.sequence,
            year: allocation.year,
            yearKey: allocation.yearKey,
            dateCreation: Timestamp.fromDate(documentDate),
            ...(candidate.type === "facture"
              ? {
                  dateEcheance: Timestamp.fromDate(
                    addDays(documentDate, paymentDelay ?? 30),
                  ),
                }
              : {}),
            createdAt: serverTimestamp(),
          });
          return nextDocument;
        });
        setState((current) =>
          current.uid === readyUid ? { ...current, error: null } : current,
        );
        return createdDocument;
      } catch (transactionError) {
        const message = firestoreErrorMessage(transactionError);
        setState((current) =>
          current.uid === readyUid
            ? { ...current, error: message }
            : current,
        );
        throw new Error(message);
      }

      async function paymentDelayInTransaction(
        transaction: import("firebase/firestore").Transaction,
        db: import("firebase/firestore").Firestore,
        clientId: string,
      ): Promise<number> {
        const clientSnapshot = await transaction.get(doc(db, "clients", clientId));
        if (!clientSnapshot.exists()) throw new Error("Le client sélectionné n’existe plus.");
        const value = clientSnapshot.data().delaiPaiementJours;
        if (value === undefined) return 30;
        if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 365) {
          throw new Error("Le délai de paiement du client est invalide.");
        }
        return value;
      }

      function addDays(date: Date, days: number): Date {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
      }
    },
    [readyUid, readyUserName],
  );

  const clearError = useCallback(() => {
    if (!readyUid) return;
    setState((current) =>
      current.uid === readyUid ? { ...current, error: null } : current,
    );
  }, [readyUid]);
  const isCurrentSession = Boolean(readyUid && state.uid === readyUid);
  const documents = useMemo(
    () => (isCurrentSession ? state.documents : []),
    [isCurrentSession, state.documents],
  );
  const loading = Boolean(readyUid) && (!isCurrentSession || state.loading);
  const error = isCurrentSession ? state.error : null;
  const value = useMemo(
    () => ({ documents, loading, error, addDocument, clearError }),
    [documents, loading, error, addDocument, clearError],
  );
  return (
    <DocumentsContext.Provider value={value}>
      {children}
    </DocumentsContext.Provider>
  );
}

export function useDocuments(): DocumentsContextValue {
  const context = useContext(DocumentsContext);
  if (!context) {
    throw new Error(
      "useDocuments doit être utilisé dans un composant enfant de DocumentsProvider.",
    );
  }
  return context;
}

export { parseDocument as parseFirestoreDocument };
