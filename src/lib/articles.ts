import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { assertOnline } from "@/lib/online";
import { firestoreErrorMessage } from "@/lib/firestoreErrors";
import type { Article } from "@/types";

export type ArticleCostInput = {
  prixAchatHT: number;
  fournisseurPrincipal: string;
};

function articleData(article: Article, isNew: boolean): Record<string, unknown> {
  const data: Record<string, unknown> = {
    reference: article.reference.trim(),
    designation: article.designation.trim(),
    categorie: article.categorie,
    prixUnitaireHT: article.prixUnitaireHT,
    unite: article.unite.trim(),
    type: article.type,
    actif: article.actif,
  };
  if (article.type === "produit") {
    data.seuilAlerte = article.seuilAlerte ?? 0;
    data.emplacement = article.emplacement?.trim() ?? "";
    if (isNew) data.stockQte = 0;
  }
  return data;
}

export async function saveCatalogueArticle(
  article: Article,
  isNew: boolean,
  cost?: ArticleCostInput,
): Promise<void> {
  assertOnline();
  const db = getFirebaseDb();
  const articleRef = doc(db, "articles", article.id);
  const costRef = doc(db, "articlesCouts", article.id);
  try {
    await runTransaction(db, async (transaction) => {
      const current = await transaction.get(articleRef);
      if (isNew && current.exists()) {
        throw new Error("Cette référence existe déjà dans le catalogue.");
      }
      if (!isNew && !current.exists()) {
        throw new Error("Cet article n’existe plus dans le catalogue.");
      }
      if (
        !isNew &&
        current.exists() &&
        current.data().type !== article.type
      ) {
        throw new Error("Le type d’un article existant ne peut pas être modifié.");
      }
      transaction.set(
        articleRef,
        {
          ...articleData(article, isNew),
          ...(isNew ? { createdAt: serverTimestamp() } : {}),
        },
        { merge: true },
      );
      if (
        cost &&
        article.type === "produit" &&
        Number.isFinite(cost.prixAchatHT) &&
        cost.prixAchatHT >= 0
      ) {
        transaction.set(
          costRef,
          {
            prixAchatHT: cost.prixAchatHT,
            fournisseurPrincipal: cost.fournisseurPrincipal.trim(),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }
    });
  } catch (error) {
    throw new Error(firestoreErrorMessage(error));
  }
}
