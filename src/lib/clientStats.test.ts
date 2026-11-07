import assert from "node:assert/strict";
import test from "node:test";
import { clients } from "../data/clients.ts";
import { documents } from "../data/documents.ts";
import {
  documentsByClient,
  totalFacture,
  totalImpaye,
} from "./clientStats.ts";
import { normalizeSearch } from "./normalizeSearch.ts";

test("calculates a client's billed amount and unpaid balance from invoices", () => {
  const dunesDocuments = documentsByClient("client-les-dunes", documents);
  assert.equal(dunesDocuments.length, 2);
  assert.equal(totalFacture("client-les-dunes", documents), 92400);
  assert.equal(totalImpaye("client-les-dunes", documents), 0);

  assert.equal(totalFacture("client-atlas", documents), 22200);
  assert.equal(totalImpaye("client-atlas", documents), 22200);
});

test("matches client names without regard to accents or case", () => {
  const query = normalizeSearch("dûnes");
  assert.equal(
    clients.find((client) => normalizeSearch(client.nom).includes(query))?.id,
    "client-les-dunes",
  );
  assert.equal(normalizeSearch("Résidence").includes(normalizeSearch("residence")), true);
});
