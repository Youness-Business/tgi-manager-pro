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
import { getFirebaseDb } from "@/lib/firebase";
import { firestoreErrorMessage } from "@/lib/firestoreErrors";
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
  addDocument: (document: Document) => Promise<Document>;
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
  if (typeof value.remisePct === "number") document.remisePct = value.remisePct;
  if (
    value.modePaiement === "especes" ||
    value.modePaiement === "virement" ||
    value.modePaiement === "cheque"
  ) {
    document.modePaiement = value.modePaiement;
  }
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
  const { user, profile } = useAuth();
  const [state, setState] = useState<DocumentsState>({
    uid: null,
    documents: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!user) return;
    let active = true;
    try {
      const documentsCollection = collection(getFirebaseDb(), "documents");
      const documentsQuery =
        profile?.role === "commercial"
          ? query(documentsCollection, where("createdBy", "==", user.uid))
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
              uid: user.uid,
              documents: [],
              loading: false,
              error:
                "Un ou plusieurs documents Firestore sont invalides. Vérifiez leurs données.",
            });
          } else {
            setState({
              uid: user.uid,
              documents: parsed.filter((item): item is Document => item !== null),
              loading: false,
              error: null,
            });
          }
        },
        (snapshotError) => {
          if (!active) return;
          setState({
            uid: user.uid,
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
          uid: user.uid,
          documents: [],
          loading: false,
          error: message,
        });
      }, 0);
      return () => {
        active = false;
      };
    }
  }, [user, profile?.role]);

  const addDocument = useCallback(
    async (candidate: Document): Promise<Document> => {
      if (!user) throw new Error("Vous devez être connecté pour créer un document.");
      const db = getFirebaseDb();
      const documentRef = doc(db, "documents", candidate.id);
      const documentDate = parseDocumentDate(candidate.dateCreation);
      if (Number.isNaN(documentDate.getTime())) {
        throw new Error("La date du document n’est pas valide.");
      }
      try {
        const createdDocument = await runTransaction(db, async (transaction) => {
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
            createdBy: user.uid,
          };
          transaction.set(documentRef, {
            ...nextDocument,
            counterKey: allocation.counterKey,
            sequence: allocation.sequence,
            year: allocation.year,
            yearKey: allocation.yearKey,
            dateCreation: Timestamp.fromDate(documentDate),
            createdAt: serverTimestamp(),
          });
          return nextDocument;
        });
        setState((current) =>
          current.uid === user.uid ? { ...current, error: null } : current,
        );
        return createdDocument;
      } catch (transactionError) {
        const message = firestoreErrorMessage(transactionError);
        setState((current) =>
          current.uid === user.uid
            ? { ...current, error: message }
            : current,
        );
        throw new Error(message);
      }
    },
    [user],
  );

  const clearError = useCallback(() => {
    if (!user) return;
    setState((current) =>
      current.uid === user.uid ? { ...current, error: null } : current,
    );
  }, [user]);
  const isCurrentSession = Boolean(user && state.uid === user.uid);
  const documents = useMemo(
    () => (isCurrentSession ? state.documents : []),
    [isCurrentSession, state.documents],
  );
  const loading = Boolean(user) && (!isCurrentSession || state.loading);
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
