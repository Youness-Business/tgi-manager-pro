import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { clients } from "@/data/clients";
import { DocumentRenderer } from "@/components/documents/DocumentRenderer";
import { DocumentLayout } from "@/components/documents/DocumentLayout";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { amountToFrenchWords } from "@/lib/amountToFrenchWords";
import { computeTotals } from "@/lib/computeTotals";
import { documents } from "@/data/documents";
import { nextDocumentNumber } from "@/lib/documentNumber";
import { formatSafeDate } from "@/lib/formatSafeDate";
import type { Document, DocumentType } from "@/types";

describe("tests métier et robustesse des documents", () => {
  it("calcule HT, TVA et TTC en arrondissant au centime", () => {
    expect(
      computeTotals([
        {
          articleId: "article-a",
          designation: "Service",
          qte: 2,
          prixUnitaireHT: 100.005,
        },
        {
          articleId: "article-b",
          designation: "Pièce",
          qte: 1,
          prixUnitaireHT: 50,
        },
      ]),
    ).toEqual({ totalHT: 250.01, montantTVA: 50, totalTTC: 300.01 });
  });

  it("génère les séquences de documents par type et année", () => {
    expect(nextDocumentNumber("facture", documents, new Date(2026, 10, 7))).toBe(
      "FAC-2026-0007",
    );
    expect(
      nextDocumentNumber("bon_livraison", documents, new Date(2026, 10, 7)),
    ).toBe("BL-2026-0002");
    expect(
      nextDocumentNumber("facture", documents, new Date(2027, 0, 1)),
    ).toBe("FAC-2027-0001");
  });

  it("convertit le total en toutes lettres", () => {
    expect(amountToFrenchWords(1234.56)).toBe(
      "Arrêtée la présente facture à la somme de : mille deux cent trente-quatre dirhams et cinquante-six centimes",
    );
  });

  it("accepte les dates usuelles et remplace les dates invalides", () => {
    expect(formatSafeDate("07/11/2026")).toBe("07/11/2026");
    expect(formatSafeDate(new Date(2026, 10, 7, 12).getTime())).toBe(
      "07/11/2026",
    );
    expect(formatSafeDate("31/02/2026")).toBe(
      new Date().toLocaleDateString("fr-FR"),
    );
  });

  it("rend les quatre types et garde intactes les 40 lignes et les textes longs", () => {
    const client = clients[0];
    const reference = "R".repeat(60);
    const designation = "Désignation longue ".repeat(10);
    const lignes = Array.from({ length: 40 }, (_, index) => ({
      articleId: `article-${index}`,
      reference,
      designation,
      qte: 1,
      prixUnitaireHT: 100,
    }));

    for (const type of [
      "facture",
      "devis",
      "recu",
      "bon_livraison",
    ] satisfies DocumentType[]) {
      const document: Document = {
        id: `test-${type}`,
        type,
        numero: `FAC-${reference}`,
        clientId: client.id,
        dateCreation: "2026-11-07",
        lignes,
        statut: "en_attente",
      };
      const html = renderToStaticMarkup(
        createElement(DocumentRenderer, { document, client }),
      );

      expect(html).toContain(reference);
      expect(html).toContain(designation);
      expect(html.match(/<tr/g)).toHaveLength(41);
      expect(html).toContain("break-inside-avoid");
      expect(html).toContain("table-header-group");
      expect(html).toContain("print:bg-[#F8FAFC]");
    }

    const longDocument: Document = {
      id: "test-long-reference",
      type: "facture",
      numero: reference,
      clientId: client.id,
      dateCreation: "2026-11-07",
      lignes: [],
      statut: "paye",
    };
    const html = renderToStaticMarkup(
      createElement(DocumentLayout, { document: longDocument, client }),
    );
    expect(html).toContain("break-all");
    expect(html).toContain(reference);
  });

  it("permet aux références longues de se rompre dans les tableaux mobiles", () => {
    const row = {
      reference: "R".repeat(60),
      designation: "D".repeat(200),
    };
    const columns: DataTableColumn<typeof row>[] = [
      {
        id: "reference",
        header: "Référence",
        render: (item) =>
          createElement("span", { className: "break-all" }, item.reference),
      },
      {
        id: "designation",
        header: "Désignation",
        render: (item) =>
          createElement("span", { className: "break-words" }, item.designation),
      },
    ];
    const html = renderToStaticMarkup(
      createElement(DataTable<typeof row>, {
        caption: "Articles",
        columns,
        rows: [row],
        getRowKey: () => row.reference,
      }),
    );

    expect(html).toContain("xl:hidden");
    expect(html).toContain("overflow-x-auto");
    expect(html).toContain("break-all");
    expect(html).toContain("break-words");
    expect(html).toContain(row.reference);
    expect(html).toContain(row.designation);
  });
});
