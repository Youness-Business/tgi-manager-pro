import type { LigneDocument } from "@/types";

export type DocumentTotals = {
  totalHT: number;
  montantTVA: number;
  totalTTC: number;
};

function roundToCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeTotals(
  lignes: readonly LigneDocument[],
  tauxTva = 0.2,
): DocumentTotals {
  const totalHT = roundToCents(
    lignes.reduce(
      (total, ligne) => total + ligne.qte * ligne.prixUnitaireHT,
      0,
    ),
  );
  const montantTVA = roundToCents(totalHT * tauxTva);

  return {
    totalHT,
    montantTVA,
    totalTTC: roundToCents(totalHT + montantTVA),
  };
}
