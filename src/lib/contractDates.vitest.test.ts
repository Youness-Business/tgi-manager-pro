import { describe, expect, it } from "vitest";
import {
  addMonths,
  computeProchaineVisite,
  contratNeedsRenewal,
  getContratStatut,
  periodeFacturation,
} from "@/lib/contractDates";

describe("calculs de dates contractuelles", () => {
  it("ajoute des mois en préservant la fin de mois valide", () => {
    expect(addMonths(new Date(2026, 0, 31), 1)).toEqual(new Date(2026, 1, 28));
    expect(addMonths(new Date(2024, 0, 31), 1)).toEqual(new Date(2024, 1, 29));
    expect(addMonths(new Date(2026, 0, 31), 12)).toEqual(new Date(2027, 0, 31));
  });

  it("dérive le statut expiré sans modifier le contrat", () => {
    const contract = { statut: "actif" as const, dateFin: new Date(2026, 5, 9) };
    const before = structuredClone(contract);
    expect(getContratStatut(contract, new Date(2026, 5, 10))).toBe("expire");
    expect(contract).toEqual(before);
    expect(getContratStatut(contract, new Date(2026, 5, 9))).toBe("actif");
    expect(getContratStatut({ statut: "brouillon", dateFin: new Date(2020, 0, 1) }, new Date(2026, 0, 1))).toBe("brouillon");
    expect(getContratStatut({ statut: "resilie", dateFin: new Date(2020, 0, 1) }, new Date(2026, 0, 1))).toBe("resilie");
  });

  it("signale uniquement les contrats actifs dont l’échéance est sous 60 jours", () => {
    const today = new Date(2026, 4, 1);
    expect(contratNeedsRenewal({ statut: "actif", dateFin: new Date(2026, 5, 30, 12) }, today)).toBe(true);
    expect(contratNeedsRenewal({ statut: "actif", dateFin: new Date(2026, 6, 1) }, today)).toBe(false);
    expect(contratNeedsRenewal({ statut: "actif", dateFin: new Date(2026, 3, 30) }, today)).toBe(false);
    expect(contratNeedsRenewal({ statut: "brouillon", dateFin: new Date(2026, 4, 15) }, today)).toBe(false);
  });

  it("calcule la prochaine visite selon la périodicité", () => {
    expect(computeProchaineVisite(new Date(2026, 0, 31), "mensuelle")).toEqual(new Date(2026, 1, 28));
    expect(computeProchaineVisite(new Date(2026, 0, 31), "trimestrielle")).toEqual(new Date(2026, 3, 30));
    expect(computeProchaineVisite(new Date(2026, 0, 31), "annuelle")).toEqual(new Date(2027, 0, 31));
  });

  it("calcule une période de facturation stable et la limite à la fin du contrat", () => {
    const contract = {
      dateDebut: new Date(2026, 0, 1),
      dateFin: new Date(2026, 1, 15),
      prochaineFacturation: new Date(2026, 0, 1),
      periodicite: "trimestrielle" as const,
    };
    const period = periodeFacturation(contract);
    expect(period.key).toBe("2026-01-01_2026-02-15");
    expect(period.debut).toEqual(new Date(2026, 0, 1));
    expect(period.fin).toEqual(new Date(2026, 1, 15));
  });
});
