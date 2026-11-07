import { describe, expect, it } from "vitest";
import {
  buildSortiesFromLignes,
  canWithdraw,
  computeMovement,
  getStockStatut,
  valeurStock,
} from "@/lib/stock";
import type { Article, ArticleCout } from "@/types";

const moteur: Article = {
  id: "moteur",
  reference: "MOT-001",
  designation: "Moteur",
  categorie: "Moteurs",
  prixUnitaireHT: 100,
  unite: "unité",
  type: "produit",
  actif: true,
  stockQte: 4,
  seuilAlerte: 4,
};

const service: Article = {
  id: "maintenance",
  reference: "SRV-001",
  designation: "Maintenance",
  categorie: "Services",
  prixUnitaireHT: 100,
  unite: "forfait",
  type: "service",
  actif: true,
};

describe("logique de stock", () => {
  it("distingue le stock disponible, bas et en rupture", () => {
    expect(getStockStatut(moteur)).toBe("bas");
    expect(getStockStatut({ ...moteur, stockQte: 5 })).toBe("ok");
    expect(getStockStatut({ ...moteur, stockQte: 0 })).toBe("rupture");
    expect(getStockStatut(service)).toBe("ok");
  });

  it("refuse les sorties dépassant le stock et ne calcule jamais un stock négatif", () => {
    expect(canWithdraw(moteur, 4)).toBe(true);
    expect(canWithdraw(moteur, 5)).toBe(false);
    expect(computeMovement(moteur, "sortie", 3)).toEqual({
      qteAvant: 4,
      qteApres: 1,
    });
    expect(() => computeMovement(moteur, "sortie", 5)).toThrow(
      /stock insuffisant/i,
    );
    expect(computeMovement(moteur, "ajustement", 8).qteApres).toBe(8);
    expect(computeMovement(moteur, "ajustement", 0).qteApres).toBe(0);
  });

  it("calcule la valeur uniquement depuis les coûts séparés", () => {
    const costs: ArticleCout[] = [
      { articleId: moteur.id, prixAchatHT: 25.5, fournisseurPrincipal: "Fournisseur A" },
    ];
    expect(valeurStock([moteur, service], costs)).toBe(102);
  });

  it("agrège les sorties répétées par article et ignore les services", () => {
    expect(
      buildSortiesFromLignes(
        [
          { articleId: moteur.id, qte: 2 },
          { articleId: moteur.id, qte: 1.5 },
          { articleId: service.id, qte: 3 },
        ],
        [moteur, service],
      ),
    ).toEqual([{ articleId: moteur.id, qte: 3.5 }]);
  });
});
