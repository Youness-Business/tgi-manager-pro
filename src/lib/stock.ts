import type {
  Article,
  ArticleCout,
  LigneDocument,
  StockMovementType,
} from "@/types";

export type StockStatus = "ok" | "bas" | "rupture";
export class StockInsufficientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockInsufficientError";
  }
}
export type StockableArticle = Pick<
  Article,
  "type" | "stockQte" | "seuilAlerte" | "designation"
>;

export type StockQuantityLine = {
  articleId: string;
  qte: number;
};

export function getStockStatut(article: StockableArticle): StockStatus {
  if (article.type === "service") return "ok";
  const quantity = article.stockQte ?? 0;
  if (quantity <= 0) return "rupture";
  return quantity <= (article.seuilAlerte ?? 0) ? "bas" : "ok";
}

export function canWithdraw(article: StockableArticle, qte: number): boolean {
  return (
    article.type === "produit" &&
    Number.isFinite(qte) &&
    qte > 0 &&
    qte <= (article.stockQte ?? 0)
  );
}

export function computeMovement(
  article: StockableArticle,
  type: StockMovementType,
  qte: number,
): { qteAvant: number; qteApres: number } {
  if (article.type !== "produit") {
    throw new Error("Un service ne peut pas avoir de mouvement de stock.");
  }
  if (
    !Number.isFinite(qte) ||
    (type === "ajustement" ? qte < 0 : qte <= 0)
  ) {
    throw new Error(
      type === "ajustement"
        ? "La quantité constatée doit être positive ou nulle."
        : "La quantité doit être un nombre positif.",
    );
  }
  const normalizedRequest = normalizeQuantity(qte);
  if (type !== "ajustement" && normalizedRequest <= 0) {
    throw new Error("La quantité est trop petite pour être enregistrée.");
  }

  const qteAvant = article.stockQte ?? 0;
  const qteApres =
    type === "entree"
      ? qteAvant + normalizedRequest
      : type === "sortie"
        ? qteAvant - normalizedRequest
        : normalizedRequest;
  if (qteApres < 0) {
    throw new StockInsufficientError(
      `${article.designation} : stock insuffisant (disponible : ${qteAvant}).`,
    );
  }
  return {
    qteAvant: normalizeQuantity(qteAvant),
    qteApres: normalizeQuantity(qteApres),
  };
}

export function valeurStock(
  articles: readonly Article[],
  couts: readonly ArticleCout[],
): number {
  const costsByArticle = new Map(
    couts.map((cost) => [cost.articleId, cost.prixAchatHT]),
  );
  const value = articles.reduce((sum, article) => {
    if (article.type !== "produit") return sum;
    return sum + (article.stockQte ?? 0) * (costsByArticle.get(article.id) ?? 0);
  }, 0);
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function buildSortiesFromLignes(
  lignes: readonly Pick<LigneDocument, "articleId" | "qte">[],
  articles: readonly Article[],
): StockQuantityLine[] {
  const articlesById = new Map(articles.map((article) => [article.id, article]));
  const quantities = new Map<string, number>();
  for (const ligne of lignes) {
    if (!Number.isFinite(ligne.qte) || ligne.qte <= 0) {
      throw new Error("Les quantités des lignes doivent être positives.");
    }
    const article = articlesById.get(ligne.articleId);
    if (!article) {
      throw new Error(`L’article ${ligne.articleId} n’existe plus au catalogue.`);
    }
    if (article.type === "service") continue;
    quantities.set(
      article.id,
      normalizeQuantity((quantities.get(article.id) ?? 0) + ligne.qte),
    );
  }
  return [...quantities].map(([articleId, qte]) => ({ articleId, qte }));
}

function normalizeQuantity(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}
