import type { LigneDocument } from "@/types";
import { computeTotals } from "./computeTotals.ts";

export type DiscountedTotals = {
  sousTotalHT: number;
  remise: number;
  totalHT: number;
  montantTVA: number;
  totalTTC: number;
};

function roundToCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeDiscountedTotals(
  lignes: readonly LigneDocument[],
  remisePct = 0,
  tauxTva = 0.2,
): DiscountedTotals {
  const { totalHT: sousTotalHT } = computeTotals(lignes, tauxTva);
  const validDiscount = Math.min(100, Math.max(0, remisePct));
  const remise = roundToCents((sousTotalHT * validDiscount) / 100);
  const totalHT = roundToCents(sousTotalHT - remise);
  const montantTVA = roundToCents(totalHT * tauxTva);

  return {
    sousTotalHT,
    remise,
    totalHT,
    montantTVA,
    totalTTC: roundToCents(totalHT + montantTVA),
  };
}
