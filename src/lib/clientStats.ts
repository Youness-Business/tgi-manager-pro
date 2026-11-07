import type { Document } from "@/types";
import { computeDiscountedTotals } from "./computeDiscountedTotals.ts";

function roundToCents(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function documentsByClient(
  clientId: string,
  allDocuments: readonly Document[],
): Document[] {
  return allDocuments.filter((document) => document.clientId === clientId);
}

export function totalFacture(
  clientId: string,
  allDocuments: readonly Document[],
): number {
  return roundToCents(
    documentsByClient(clientId, allDocuments).reduce((sum, document) => {
      if (document.type !== "facture" || document.statut === "annule") {
        return sum;
      }

      return (
        sum +
        computeDiscountedTotals(document.lignes, document.remisePct).totalTTC
      );
    }, 0),
  );
}

export function totalImpaye(
  clientId: string,
  allDocuments: readonly Document[],
): number {
  return roundToCents(
    documentsByClient(clientId, allDocuments).reduce((sum, document) => {
      if (document.type !== "facture" || document.statut !== "en_attente") {
        return sum;
      }

      return (
        sum +
        computeDiscountedTotals(document.lignes, document.remisePct).totalTTC
      );
    }, 0),
  );
}
