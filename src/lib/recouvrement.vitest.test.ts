import { describe, expect, it } from "vitest";
import {
  computeBalanceAgee,
  computeDSO,
  computeSolde,
  computeTauxRecouvrement,
  canTransitionPaymentStatus,
  getDocumentStatut,
  getRetardJours,
  getTrancheAge,
  isPromesseNonTenue,
  suggestRelanceNiveau,
} from "@/lib/recouvrement";
import type { Document, Paiement, Relance } from "@/types";

const today = new Date(2026, 10, 7, 12);

function invoice(
  id: string,
  due: string,
  amount = 1200,
): Document {
  return {
    id,
    type: "facture",
    numero: `FAC-${id}`,
    clientId: "client-1",
    dateCreation: "2026-10-01",
    dateEcheance: due,
    lignes: [{ articleId: "a1", designation: "Maintenance", qte: 1, prixUnitaireHT: amount / 1.2 }],
    statut: "en_attente",
  };
}

describe("calculs de recouvrement", () => {
  it("n’autorise que les transitions valides des chèques et paiements", () => {
    expect(canTransitionPaymentStatus("en_portefeuille", "remis_banque")).toBe(true);
    expect(canTransitionPaymentStatus("remis_banque", "encaisse")).toBe(true);
    expect(canTransitionPaymentStatus("encaisse", "annule")).toBe(true);
    expect(canTransitionPaymentStatus("annule", "encaisse")).toBe(false);
    expect(canTransitionPaymentStatus("impaye", "remis_banque")).toBe(false);
  });

  it("recalcule le solde à partir des paiements encaissés et dérive le statut", () => {
    const bill = invoice("1", "2026-11-30");
    const payments: Paiement[] = [
      {
        id: "p1",
        documentId: bill.id,
        clientId: bill.clientId,
        montant: 300,
        mode: "virement",
        reference: "V-1",
        statut: "valide",
        userId: "u1",
        date: "2026-10-15",
      },
      {
        id: "p2",
        documentId: bill.id,
        clientId: bill.clientId,
        montant: 400,
        mode: "cheque",
        reference: "C-1",
        statut: "en_portefeuille",
        userId: "u1",
        date: "2026-10-20",
      },
    ];
    expect(computeSolde(bill, payments)).toBe(900);
    expect(getDocumentStatut(bill, payments)).toBe("partiel");
    expect(
      computeSolde(bill, payments.map((payment) => ({ ...payment, statut: "encaisse" }))),
    ).toBe(500);
  });

  it("préserve les anciennes factures marquées payées sans recréer de paiements fictifs", () => {
    const legacy = { ...invoice("legacy", "2026-10-01"), statut: "paye" as const };
    expect(computeSolde(legacy, [])).toBe(0);
    expect(getDocumentStatut(legacy, [])).toBe("paye");
  });

  it("calcule le retard et les seuils de tranches sur des exemples vérifiables", () => {
    expect(getRetardJours("2026-11-07", today)).toBe(0);
    expect(getRetardJours("2026-10-08", today)).toBe(30);
    expect(getRetardJours("2026-09-07", today)).toBe(61);
    expect(getTrancheAge(0)).toBe("non_echue");
    expect(getTrancheAge(30)).toBe("1-30");
    expect(getTrancheAge(31)).toBe("31-60");
    expect(getTrancheAge(61)).toBe("61-90");
    expect(getTrancheAge(91)).toBe("90+");
  });

  it("regroupe les créances ouvertes par ancienneté", () => {
    const bills = [
      invoice("due", "2026-11-20"),
      invoice("30", "2026-10-08"),
      invoice("61", "2026-09-07"),
      invoice("91", "2026-08-08"),
    ];
    const aged = computeBalanceAgee(bills, [], today);
    expect(aged.non_echue.montant).toBe(1200);
    expect(aged["1-30"].montant).toBe(1200);
    expect(aged["61-90"].montant).toBe(1200);
    expect(aged["90+"].montant).toBe(1200);
  });

  it("détecte une promesse échue et suggère un niveau croissant", () => {
    const reminder: Relance = {
      id: "r1",
      clientId: "client-1",
      documentIds: ["1"],
      niveau: 1,
      canal: "appel",
      note: "",
      promessePaiementDate: "2026-11-01",
      promesseMontant: 500,
      userId: "u1",
      date: "2026-10-20",
    };
    expect(isPromesseNonTenue(reminder, [], today)).toBe(true);
    expect(suggestRelanceNiveau(10, [reminder], [], today)).toBe(2);
    expect(suggestRelanceNiveau(15, [], [], today)).toBe(2);
    expect(suggestRelanceNiveau(45, [], [], today)).toBe(3);
  });

  it("calcule les indicateurs de recouvrement sans dépasser 100 %", () => {
    const bill = invoice("1", "2026-11-30", 1200);
    const payments: Paiement[] = [{
      id: "p1",
      documentId: bill.id,
      clientId: bill.clientId,
      montant: 600,
      mode: "virement",
      reference: "V-1",
      statut: "valide",
      userId: "u1",
      date: "2026-10-15",
    }];
    expect(computeTauxRecouvrement([bill], payments, new Date("2026-10-01"), new Date("2026-11-01"))).toBe(50);
    expect(computeDSO([bill], payments, new Date("2026-11-07"), 90)).toBe(45);
  });
});
