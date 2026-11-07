import assert from "node:assert/strict";
import test from "node:test";
import { amountToFrenchWords } from "./amountToFrenchWords.ts";
import { computeTotals } from "./computeTotals.ts";

test("computes document totals rounded to cents", () => {
  const totals = computeTotals([
    {
      articleId: "a",
      designation: "Service",
      qte: 3,
      prixUnitaireHT: 10.105,
    },
    {
      articleId: "b",
      designation: "Pièce",
      qte: 2,
      prixUnitaireHT: 4.2,
    },
  ]);

  assert.deepEqual(totals, {
    totalHT: 38.72,
    montantTVA: 7.74,
    totalTTC: 46.46,
  });
  assert.deepEqual(computeTotals([]), {
    totalHT: 0,
    montantTVA: 0,
    totalTTC: 0,
  });
});

test("converts amounts to French dirham and centime wording", () => {
  assert.equal(
    amountToFrenchWords(1234.56),
    "Arrêtée la présente facture à la somme de : mille deux cent trente-quatre dirhams et cinquante-six centimes",
  );
  assert.equal(
    amountToFrenchWords(1_000_000),
    "Arrêtée la présente facture à la somme de : un million dirhams et zéro centimes",
  );
});
