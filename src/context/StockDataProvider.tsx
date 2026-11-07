"use client";

import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/context/AuthProvider";
import { getFirebaseDb } from "@/lib/firebase";
import { firestoreErrorMessage } from "@/lib/firestoreErrors";
import { can } from "@/lib/permissions";
import type { ArticleCout, DateInput, StockMovement } from "@/types";

export type StockCollection<T> = {
  items: T[];
  loading: boolean;
  error: string | null;
};

const emptyCosts: StockCollection<ArticleCout> = {
  items: [],
  loading: false,
  error: null,
};

const ArticlesCoutsContext = createContext<StockCollection<ArticleCout>>(
  emptyCosts,
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseDate(value: unknown): DateInput | null {
  if (value instanceof Date || typeof value === "string" || typeof value === "number") {
    return value;
  }
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

function parseMovement(id: string, value: unknown): StockMovement | null {
  if (!isRecord(value)) return null;
  const date = parseDate(value.date);
  if (
    typeof value.articleId !== "string" ||
    !["entree", "sortie", "ajustement"].includes(String(value.type)) ||
    !["manuel", "document", "intervention", "inventaire"].includes(
      String(value.source),
    ) ||
    typeof value.qte !== "number" ||
    !Number.isFinite(value.qte) ||
    value.qte <= 0 ||
    typeof value.qteAvant !== "number" ||
    !Number.isFinite(value.qteAvant) ||
    typeof value.qteApres !== "number" ||
    !Number.isFinite(value.qteApres) ||
    value.qteApres < 0 ||
    typeof value.motif !== "string" ||
    !value.motif.trim() ||
    typeof value.userId !== "string" ||
    !date
  ) {
    return null;
  }
  return {
    id,
    articleId: value.articleId,
    type: value.type as StockMovement["type"],
    qte: value.qte,
    qteAvant: value.qteAvant,
    qteApres: value.qteApres,
    motif: value.motif,
    source: value.source as StockMovement["source"],
    userId: value.userId,
    ...(typeof value.userName === "string" ? { userName: value.userName } : {}),
    date,
    ...(typeof value.documentId === "string"
      ? { documentId: value.documentId }
      : {}),
    ...(typeof value.interventionId === "string"
      ? { interventionId: value.interventionId }
      : {}),
    ...(typeof value.fournisseur === "string"
      ? { fournisseur: value.fournisseur }
      : {}),
  };
}

export function StockDataProvider({ children }: { children: ReactNode }) {
  const { user, role, status } = useAuth();
  const canReadCosts = can(role, "readPurchasePrice", "stock");
  const readyUid = status === "ready" ? user?.uid ?? null : null;
  const [state, setState] = useState<{
    uid: string | null;
    value: StockCollection<ArticleCout>;
  }>({ uid: null, value: { ...emptyCosts, loading: true } });

  useEffect(() => {
    if (!readyUid || !canReadCosts) return;
    let active = true;
    const unsubscribe = onSnapshot(
      collection(getFirebaseDb(), "articlesCouts"),
      (snapshot) => {
        if (!active) return;
        const costs: ArticleCout[] = [];
        for (const entry of snapshot.docs) {
          const value: unknown = entry.data();
          if (
            !isRecord(value) ||
            typeof value.prixAchatHT !== "number" ||
            !Number.isFinite(value.prixAchatHT) ||
            value.prixAchatHT < 0 ||
            (value.fournisseurPrincipal !== undefined &&
              typeof value.fournisseurPrincipal !== "string")
          ) {
            setState({
              uid: readyUid,
              value: {
                items: [],
                loading: false,
                error: `Les coûts de l’article « ${entry.id} » sont invalides.`,
              },
            });
            return;
          }
          costs.push({
            articleId: entry.id,
            prixAchatHT: value.prixAchatHT,
            fournisseurPrincipal:
              typeof value.fournisseurPrincipal === "string"
                ? value.fournisseurPrincipal
                : "",
          });
        }
        setState({
          uid: readyUid,
          value: { items: costs, loading: false, error: null },
        });
      },
      (error) => {
        if (!active) return;
        setState({
          uid: readyUid,
          value: { items: [], loading: false, error: firestoreErrorMessage(error) },
        });
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [canReadCosts, readyUid]);

  const costs =
    readyUid && canReadCosts
      ? state.uid === readyUid
        ? state.value
        : { ...emptyCosts, loading: true }
      : emptyCosts;
  return (
    <ArticlesCoutsContext.Provider value={costs}>
      {children}
    </ArticlesCoutsContext.Provider>
  );
}

export function useArticlesCouts(): StockCollection<ArticleCout> {
  return useContext(ArticlesCoutsContext);
}

export function useStockMovements(
  articleId?: string,
): StockCollection<StockMovement> {
  const { user, role, status } = useAuth();
  const canReadMovements = can(role, "readStockMovements", "stock");
  const readyUid = status === "ready" && canReadMovements ? user?.uid ?? null : null;
  const [state, setState] = useState<{
    uid: string | null;
    value: StockCollection<StockMovement>;
  }>({
    uid: null,
    value: { items: [], loading: true, error: null },
  });

  useEffect(() => {
    if (!readyUid) return;
    let active = true;
    const movements = collection(getFirebaseDb(), "stockMovements");
    const movementsQuery = articleId
      ? query(movements, where("articleId", "==", articleId))
      : movements;
    const unsubscribe = onSnapshot(
      movementsQuery,
      (snapshot) => {
        if (!active) return;
        const parsed = snapshot.docs.map((entry) =>
          parseMovement(entry.id, entry.data()),
        );
        if (parsed.some((movement) => movement === null)) {
          setState({
            uid: readyUid,
            value: {
              items: [],
              loading: false,
              error: "Un ou plusieurs mouvements de stock sont invalides.",
            },
          });
          return;
        }
        const items = parsed.filter(
          (movement): movement is StockMovement => movement !== null,
        );
        items.sort(
          (left, right) =>
            stockDateValue(right.date) - stockDateValue(left.date),
        );
        setState({
          uid: readyUid,
          value: { items, loading: false, error: null },
        });
      },
      (error) => {
        if (!active) return;
        setState({
          uid: readyUid,
          value: { items: [], loading: false, error: firestoreErrorMessage(error) },
        });
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [articleId, readyUid]);

  return useMemo(() => {
    if (!readyUid) return { items: [], loading: false, error: null };
    if (state.uid !== readyUid) {
      return { items: [], loading: true, error: null };
    }
    return state.value;
  }, [readyUid, state]);
}

function stockDateValue(value: DateInput): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value < 1e11 ? value * 1000 : value;
  if (typeof value === "string") return Date.parse(value);
  if (value && "toDate" in value) return value.toDate().getTime();
  if (value && "seconds" in value) return value.seconds * 1000;
  return 0;
}
