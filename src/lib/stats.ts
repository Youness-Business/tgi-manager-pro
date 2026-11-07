import type { Client, Document } from "@/types";
import { computeDiscountedTotals } from "./computeDiscountedTotals.ts";
import { formatSafeDate } from "./formatSafeDate.ts";

export type MonthlyRevenue = {
  key: string;
  label: string;
  amount: number;
};

export type DashboardStats = {
  revenueThisMonth: number;
  pendingInvoicesCount: number;
  pendingInvoicesAmount: number;
  clientCount: number;
  openQuotesCount: number;
  monthlyRevenue: MonthlyRevenue[];
};

function documentMonthKey(document: Document): string {
  const [, month, year] = formatSafeDate(document.dateCreation).split("/");
  return `${year}-${month}`;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "short" })
    .format(date)
    .replace(/\.$/, "");
}

function invoiceAmount(document: Document, field: "totalHT" | "totalTTC"): number {
  return computeDiscountedTotals(document.lignes, document.remisePct)[field];
}

export function getDashboardStats(
  clients: readonly Client[],
  documents: readonly Document[],
  now: Date = new Date(),
): DashboardStats {
  const currentMonthKey = monthKey(now);
  const pendingInvoices = documents.filter(
    (document) =>
      document.type === "facture" && document.statut === "en_attente",
  );
  const openQuotes = documents.filter(
    (document) => document.type === "devis" && document.statut === "en_attente",
  );
  const pendingInvoicesAmount = pendingInvoices.reduce(
    (sum, invoice) => sum + invoiceAmount(invoice, "totalTTC"),
    0,
  );

  const monthlyRevenue = Array.from({ length: 6 }, (_, index) => {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const key = monthKey(monthDate);
    const amount = documents.reduce((sum, document) => {
      if (
        document.type !== "facture" ||
        document.statut !== "paye" ||
        documentMonthKey(document) !== key
      ) {
        return sum;
      }

      return sum + invoiceAmount(document, "totalHT");
    }, 0);

    return {
      key,
      label: monthLabel(monthDate),
      amount: Math.round((amount + Number.EPSILON) * 100) / 100,
    };
  });

  return {
    revenueThisMonth:
      monthlyRevenue.find((month) => month.key === currentMonthKey)?.amount ?? 0,
    pendingInvoicesCount: pendingInvoices.length,
    pendingInvoicesAmount:
      Math.round((pendingInvoicesAmount + Number.EPSILON) * 100) / 100,
    clientCount: clients.length,
    openQuotesCount: openQuotes.length,
    monthlyRevenue,
  };
}
