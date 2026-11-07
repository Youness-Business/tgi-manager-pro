import assert from "node:assert/strict";
import test from "node:test";
import { documents } from "../data/documents.ts";
import { nextDocumentNumber } from "./documentNumber.ts";

test("generates the next sequence independently for every document type", () => {
  const date = new Date(2026, 10, 7);
  assert.equal(
    nextDocumentNumber("facture", documents, date),
    "FAC-2026-0007",
  );
  assert.equal(nextDocumentNumber("devis", documents, date), "DEV-2026-0003");
  assert.equal(nextDocumentNumber("recu", documents, date), "REC-2026-0002");
  assert.equal(
    nextDocumentNumber("bon_livraison", documents, date),
    "BL-2026-0002",
  );
});

test("sequences are scoped to the requested year and keep the maximum", () => {
  const docs = [
    { ...documents[0], numero: "FAC-2025-0009" },
    { ...documents[1], numero: "FAC-2026-0002" },
    { ...documents[2], numero: "FAC-2026-0005" },
  ];

  assert.equal(
    nextDocumentNumber("facture", docs, new Date(2026, 2, 1)),
    "FAC-2026-0006",
  );
});
