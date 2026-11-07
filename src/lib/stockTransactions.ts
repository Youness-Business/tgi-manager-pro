import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  type Firestore,
  type Transaction,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { firestoreErrorMessage } from "@/lib/firestoreErrors";
import { computeMovement, StockInsufficientError } from "@/lib/stock";
import { assertOnline } from "@/lib/online";
import type {
  LigneDocument,
  StockMovement,
  StockMovementSource,
  StockMovementType,
} from "@/types";

export type StockMovementRequest = {
  articleId: string;
  type: StockMovementType;
  qte: number;
  motif: string;
  source: StockMovementSource;
  movementId?: string;
  documentId?: string;
  interventionId?: string;
  fournisseur?: string;
};

type PlannedMovement = {
  articleRef: ReturnType<typeof doc>;
  movementRef: ReturnType<typeof doc>;
  movement: Omit<StockMovement, "date">;
};

export type StockMovementPlan = {
  movements: PlannedMovement[];
  alreadyApplied: boolean;
};

export async function planStockMovementsFromLines(
  transaction: Transaction,
  db: Firestore,
  lignes: readonly Pick<LigneDocument, "articleId" | "qte">[],
  options: {
    source: "document" | "intervention";
    parentId: string;
    motif: string;
    documentId?: string;
    interventionId?: string;
  },
): Promise<StockMovementPlan> {
  const articleIds = [...new Set(lignes.map((line) => line.articleId))];
  const snapshots = await Promise.all(
    articleIds.map((articleId) =>
      transaction.get(doc(db, "articles", articleId)),
    ),
  );
  const typeById = new Map<string, "produit" | "service">();
  snapshots.forEach((snapshot, index) => {
    if (!snapshot.exists()) {
      throw new Error(`L’article ${articleIds[index]} n’existe plus au catalogue.`);
    }
    const data = snapshot.data();
    const type =
      data.type === "service" || data.categorie === "Services"
        ? "service"
        : data.type === "produit" || data.type === undefined
          ? "produit"
          : null;
    if (!type) throw new Error(`Le type de l’article ${articleIds[index]} est invalide.`);
    typeById.set(articleIds[index], type);
  });

  const quantities = new Map<string, number>();
  for (const line of lignes) {
    if (!Number.isFinite(line.qte) || line.qte <= 0) {
      throw new Error("Les quantités des lignes doivent être positives.");
    }
    if (typeById.get(line.articleId) === "service") continue;
    quantities.set(line.articleId, (quantities.get(line.articleId) ?? 0) + line.qte);
  }
  const requests = [...quantities].map(([articleId, qte]) => ({
    articleId,
    type: "sortie" as const,
    qte,
    motif: options.motif,
    source: options.source,
    movementId: stockMovementId(options.source, options.parentId, articleId),
    ...(options.documentId ? { documentId: options.documentId } : {}),
    ...(options.interventionId
      ? { interventionId: options.interventionId }
      : {}),
  }));
  return planStockMovements(transaction, db, requests);
}

export function stockMovementId(
  source: StockMovementSource,
  parentId: string,
  articleId: string,
): string {
  return `${source}-${encodeURIComponent(parentId)}-${encodeURIComponent(articleId)}`;
}

export async function planStockMovements(
  transaction: Transaction,
  db: Firestore,
  requests: readonly StockMovementRequest[],
): Promise<StockMovementPlan> {
  if (!requests.length) return { movements: [], alreadyApplied: false };
  const articleIds = new Set(requests.map((request) => request.articleId));
  if (articleIds.size !== requests.length) {
    throw new Error("Un mouvement par article est requis pour chaque opération.");
  }
  for (const request of requests) {
    if (!request.motif.trim()) throw new Error("Le motif du mouvement est obligatoire.");
    if (
      !Number.isFinite(request.qte) ||
      (request.type === "ajustement" ? request.qte < 0 : request.qte <= 0)
    ) {
      throw new Error(
        request.type === "ajustement"
          ? "La quantité constatée doit être positive ou nulle."
          : "La quantité du mouvement doit être positive.",
      );
    }
    if (request.type === "entree" && !request.fournisseur?.trim() && request.source === "manuel") {
      throw new Error("Le fournisseur est obligatoire pour une entrée manuelle.");
    }
  }

  const prepared = requests.map((request) => {
    const articleRef = doc(db, "articles", request.articleId);
    const movementId =
      request.movementId ?? doc(collection(db, "stockMovements")).id;
    return {
      request,
      articleRef,
      movementRef: doc(db, "stockMovements", movementId),
    };
  });
  const snapshots = await Promise.all(
    prepared.flatMap(({ articleRef, movementRef }) => [
      transaction.get(articleRef),
      transaction.get(movementRef),
    ]),
  );
  const movements: PlannedMovement[] = [];
  let existingCount = 0;
  const shortages: string[] = [];

  prepared.forEach((entry, index) => {
    const articleSnapshot = snapshots[index * 2];
    const movementSnapshot = snapshots[index * 2 + 1];
    if (movementSnapshot.exists()) {
      existingCount += 1;
      return;
    }
    if (!articleSnapshot.exists()) {
      throw new Error(`L’article ${entry.request.articleId} n’existe plus.`);
    }
    const data = articleSnapshot.data();
    const type =
      data.type === "service" || data.categorie === "Services"
        ? "service"
        : data.type === "produit" || data.type === undefined
          ? "produit"
          : null;
    if (!type) throw new Error(`Le type de l’article ${entry.request.articleId} est invalide.`);
    if (type === "service") {
      throw new Error("Un service ne peut pas avoir de mouvement de stock.");
    }
    const stockQte =
      typeof data.stockQte === "number" && Number.isFinite(data.stockQte)
        ? data.stockQte
        : 0;
    if (stockQte < 0) throw new Error("Le stock actuel est invalide.");
    let computed: { qteAvant: number; qteApres: number };
    try {
      computed = computeMovement(
        {
          type,
          stockQte,
          designation:
            typeof data.designation === "string"
              ? data.designation
              : entry.request.articleId,
        },
        entry.request.type,
        entry.request.qte,
      );
    } catch (error) {
      if (error instanceof StockInsufficientError) {
        shortages.push(error.message);
        return;
      }
      throw error;
    }
    const movementQuantity =
      entry.request.type === "ajustement"
        ? Math.abs(computed.qteApres - computed.qteAvant)
        : normalizeQuantity(entry.request.qte);
    if (movementQuantity === 0) {
      throw new Error("Le stock constaté est identique au stock actuel.");
    }
    const movementId = entry.movementRef.id;
    movements.push({
      articleRef: entry.articleRef,
      movementRef: entry.movementRef,
      movement: {
        id: movementId,
        articleId: entry.request.articleId,
        type: entry.request.type,
        qte: movementQuantity,
        qteAvant: computed.qteAvant,
        qteApres: computed.qteApres,
        motif: entry.request.motif.trim(),
        source: entry.request.source,
        ...(entry.request.documentId
          ? { documentId: entry.request.documentId }
          : {}),
        ...(entry.request.interventionId
          ? { interventionId: entry.request.interventionId }
          : {}),
        ...(entry.request.fournisseur?.trim()
          ? { fournisseur: entry.request.fournisseur.trim() }
          : {}),
        userId: "",
      },
    });
  });

  if (existingCount > 0) {
    if (existingCount === requests.length) {
      return { movements: [], alreadyApplied: true };
    }
    if (shortages.length) {
      throw new StockInsufficientError(shortages.join("\n"));
    }
    throw new Error(
      "L’opération contient des mouvements déjà enregistrés et ne peut pas être rejouée.",
    );
  }
  return { movements, alreadyApplied: false };
}

export function commitStockMovementPlan(
  transaction: Transaction,
  plan: StockMovementPlan,
  userId: string,
  userName?: string,
): void {
  if (plan.alreadyApplied) return;
  for (const { articleRef, movementRef, movement } of plan.movements) {
    transaction.update(articleRef, {
      stockQte: movement.qteApres,
      lastStockMovementId: movement.id,
    });
    transaction.set(movementRef, {
      ...movement,
      userId,
      ...(userName ? { userName } : {}),
      date: serverTimestamp(),
    });
  }
}

export async function applyStockMovement(
  request: StockMovementRequest,
  userId: string,
  userName?: string,
): Promise<string> {
  assertOnline();
  const db = getFirebaseDb();
  const movementId =
    request.movementId ?? doc(collection(db, "stockMovements")).id;
  try {
    await runTransaction(db, async (transaction) => {
      const plan = await planStockMovements(transaction, db, [
        { ...request, movementId },
      ]);
      commitStockMovementPlan(transaction, plan, userId, userName);
    });
    return movementId;
  } catch (error) {
    throw new Error(firestoreErrorMessage(error));
  }
}

export async function applyStockMovements(
  requests: readonly StockMovementRequest[],
  userId: string,
  userName?: string,
): Promise<void> {
  assertOnline();
  const db = getFirebaseDb();
  try {
    await runTransaction(db, async (transaction) => {
      const plan = await planStockMovements(transaction, db, requests);
      commitStockMovementPlan(transaction, plan, userId, userName);
    });
  } catch (error) {
    throw new Error(firestoreErrorMessage(error));
  }
}

export async function applyDocumentStockMovement(
  documentId: string,
  userId: string,
  userName?: string,
): Promise<void> {
  assertOnline();
  const db = getFirebaseDb();
  const documentRef = doc(db, "documents", documentId);
  try {
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(documentRef);
      if (!snapshot.exists()) throw new Error("Ce bon de livraison n’existe plus.");
      const documentData = snapshot.data();
      if (documentData.type !== "bon_livraison") {
        throw new Error("Seul un bon de livraison peut valider une sortie de stock.");
      }
      if (documentData.statut === "annule") {
        throw new Error("Un bon de livraison annulé ne peut pas être validé.");
      }
      if (documentData.stockApplied === true) {
        throw new Error("Le stock a déjà été décompté pour ce bon de livraison.");
      }
      if (!Array.isArray(documentData.lignes)) {
        throw new Error("Les lignes du bon de livraison sont invalides.");
      }
      const lignes = documentData.lignes.map((line: unknown) => {
        if (
          typeof line !== "object" ||
          line === null ||
          !("articleId" in line) ||
          typeof line.articleId !== "string" ||
          !("qte" in line) ||
          typeof line.qte !== "number"
        ) {
          throw new Error("Une ligne du bon de livraison est invalide.");
        }
        return { articleId: line.articleId, qte: line.qte };
      });
      const plan = await planStockMovementsFromLines(transaction, db, lignes, {
        source: "document",
        parentId: documentId,
        documentId,
        motif: `Sortie liée au bon de livraison ${documentData.numero ?? documentId}`,
      });
      commitStockMovementPlan(transaction, plan, userId, userName);
      transaction.update(documentRef, {
        stockApplied: true,
        stockAppliedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    throw new Error(firestoreErrorMessage(error));
  }
}

function normalizeQuantity(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}
