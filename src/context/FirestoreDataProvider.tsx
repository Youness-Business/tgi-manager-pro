"use client";

import {
  collection,
  onSnapshot,
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
import type { Article, ArticleCategory, Client } from "@/types";

type CollectionState<T> = {
  items: T[];
  loading: boolean;
  error: string | null;
};

type FirestoreDataValue = {
  clients: CollectionState<Client>;
  articles: CollectionState<Article>;
};

type CollectionSnapshot<T> = CollectionState<T> & { uid: string | null };

const emptyCollection = <T,>(): CollectionSnapshot<T> => ({
  uid: null,
  items: [],
  loading: true,
  error: null,
});

const FirestoreDataContext = createContext<FirestoreDataValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseClient(id: string, source: unknown): Client | null {
  if (!isRecord(source)) return null;
  const value = source;
  if (
    typeof value.nom !== "string" ||
    typeof value.adresse !== "string" ||
    typeof value.telephone !== "string" ||
    typeof value.ice !== "string"
  ) {
    return null;
  }
  return {
    id,
    nom: value.nom,
    adresse: value.adresse,
    telephone: value.telephone,
    ice: value.ice,
    ...(typeof value.email === "string" ? { email: value.email } : {}),
    ...(typeof value.delaiPaiementJours === "number" &&
    Number.isInteger(value.delaiPaiementJours) &&
    value.delaiPaiementJours >= 0
      ? { delaiPaiementJours: value.delaiPaiementJours }
      : {}),
    ...(typeof value.limiteCredit === "number" &&
    Number.isFinite(value.limiteCredit) &&
    value.limiteCredit >= 0
      ? { limiteCredit: value.limiteCredit }
      : {}),
    ...(typeof value.notesRecouvrement === "string"
      ? { notesRecouvrement: value.notesRecouvrement }
      : {}),
  };
}

function parseArticle(id: string, source: unknown): Article | null {
  if (!isRecord(source)) return null;
  const value = source;
  const categories: readonly ArticleCategory[] = [
    "Moteurs",
    "Câbles",
    "Portes",
    "Électronique",
    "Services",
  ];
  const category = categories.find((item) => item === value.categorie);
  if (
    value.type !== undefined &&
    value.type !== "produit" &&
    value.type !== "service"
  ) {
    return null;
  }
  const type =
    value.type === "service" || category === "Services"
      ? "service"
      : "produit";
  if (
    typeof value.reference !== "string" ||
    typeof value.designation !== "string" ||
    typeof value.unite !== "string" ||
    typeof value.prixUnitaireHT !== "number" ||
    !Number.isFinite(value.prixUnitaireHT) ||
    !category
  ) {
    return null;
  }
  if (
    type === "produit" &&
    ((value.stockQte !== undefined &&
      (typeof value.stockQte !== "number" ||
        !Number.isFinite(value.stockQte) ||
        value.stockQte < 0)) ||
      (value.seuilAlerte !== undefined &&
        (typeof value.seuilAlerte !== "number" ||
          !Number.isFinite(value.seuilAlerte) ||
          value.seuilAlerte < 0)) ||
      (value.emplacement !== undefined &&
        typeof value.emplacement !== "string"))
  ) {
    return null;
  }
  const item: Article = {
    id,
    reference: value.reference,
    designation: value.designation,
    categorie: category,
    prixUnitaireHT: value.prixUnitaireHT,
    unite: value.unite,
    type,
    actif: typeof value.actif === "boolean" ? value.actif : true,
  };
  if (type === "produit" && typeof value.stockQte === "number") {
    item.stockQte = value.stockQte;
  }
  if (type === "produit" && typeof value.seuilAlerte === "number") {
    item.seuilAlerte = value.seuilAlerte;
  }
  if (typeof value.prixVenteHT === "number") item.prixVenteHT = value.prixVenteHT;
  if (type === "produit" && typeof value.emplacement === "string") {
    item.emplacement = value.emplacement;
  }
  if (type === "produit" && typeof value.lastStockMovementId === "string") {
    item.lastStockMovementId = value.lastStockMovementId;
  }
  return item;
}

function useCollection<T>(
  collectionName: string,
  parse: (id: string, value: unknown) => T | null,
  uid: string | null,
): CollectionState<T> {
  const [state, setState] = useState<CollectionSnapshot<T>>(emptyCollection);

  useEffect(() => {
    if (!uid) return;

    let active = true;
    try {
      const unsubscribe = onSnapshot(
        collection(getFirebaseDb(), collectionName),
        (snapshot) => {
          if (!active) return;
          const parsed = snapshot.docs.map((item) =>
            parse(item.id, item.data()),
          );
          if (parsed.some((item) => item === null)) {
            setState({
              uid,
              items: [],
              loading: false,
              error: `Les données de la collection « ${collectionName} » sont invalides. Corrigez les documents concernés dans Firestore.`,
            });
            return;
          }
          setState({
            uid,
            items: parsed.filter((item): item is T => item !== null),
            loading: false,
            error: null,
          });
        },
        (snapshotError) => {
          if (!active) return;
          setState({
            uid,
            items: [],
            loading: false,
            error: firestoreErrorMessage(snapshotError),
          });
        },
      );
      return () => {
        active = false;
        unsubscribe();
      };
    } catch (configurationError) {
      const message = firestoreErrorMessage(configurationError);
      window.setTimeout(() => {
        if (!active) return;
        setState({
          uid,
          items: [],
          loading: false,
          error: message,
        });
      }, 0);
      return () => {
        active = false;
      };
    }
  }, [collectionName, uid, parse]);

  if (!uid) return { items: [], loading: false, error: null };
  if (state.uid !== uid) return { items: [], loading: true, error: null };
  return state;
}

export function FirestoreDataProvider({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const readyUid = status === "ready" ? user?.uid ?? null : null;
  const clientState = useCollection("clients", parseClient, readyUid);
  const articleState = useCollection("articles", parseArticle, readyUid);
  const value = useMemo(
    () => ({ clients: clientState, articles: articleState }),
    [clientState, articleState],
  );

  return (
    <FirestoreDataContext.Provider value={value}>
      {children}
    </FirestoreDataContext.Provider>
  );
}

function useFirestoreData(): FirestoreDataValue {
  const context = useContext(FirestoreDataContext);
  if (!context) {
    throw new Error(
      "Les hooks Firestore doivent être utilisés dans FirestoreDataProvider.",
    );
  }
  return context;
}

export function useClients(): CollectionState<Client> {
  return useFirestoreData().clients;
}

export function useArticles(): CollectionState<Article> {
  return useFirestoreData().articles;
}
