import assert from "node:assert/strict";
import test from "node:test";
import { clients } from "../data/clients.ts";
import { documents } from "../data/documents.ts";
import { getDashboardStats } from "./stats.ts";

test("calculates dashboard KPIs and six-month HT revenue from mock documents", () => {
  const stats = getDashboardStats(clients, documents, new Date(2026, 10, 7));

  assert.equal(stats.revenueThisMonth, 45000);
  assert.equal(stats.pendingInvoicesCount, 2);
  assert.equal(stats.pendingInvoicesAmount, 55800);
  assert.equal(stats.clientCount, 6);
  assert.equal(stats.openQuotesCount, 2);
  assert.deepEqual(
    stats.monthlyRevenue.map(({ amount }) => amount),
    [32000, 45500, 62000, 0, 0, 45000],
  );
});
