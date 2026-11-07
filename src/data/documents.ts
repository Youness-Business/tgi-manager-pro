import type { Document } from "@/types";

const juneTimestampSeconds = Date.UTC(2026, 5, 12, 10) / 1000;
const julyTimestampMilliseconds = Date.UTC(2026, 6, 9, 10);

export const documents: Document[] = [
  {
    id: "doc-fac-2026-0001",
    type: "facture",
    numero: "FAC-2026-0001",
    clientId: "client-les-dunes",
    dateCreation: "2026-06-12",
    statut: "paye",
    lignes: [
      {
        articleId: "mot-gl-001",
        designation: "Moteur Gearless 8 personnes",
        qte: 1,
        prixUnitaireHT: 25000,
      },
      {
        articleId: "inst-mes-001",
        designation: "Installation et mise en service",
        qte: 1,
        prixUnitaireHT: 7000,
      },
    ],
  },
  {
    id: "doc-dev-2026-0001",
    type: "devis",
    numero: "DEV-2026-0001",
    clientId: "client-atlas",
    dateCreation: { seconds: juneTimestampSeconds + 11 * 86400, nanoseconds: 0 },
    statut: "en_attente",
    lignes: [
      {
        articleId: "por-pal-001",
        designation: "Porte palière automatique coupe-feu",
        qte: 4,
        prixUnitaireHT: 7800,
      },
      {
        articleId: "ctr-maint-ann",
        designation: "Contrat de maintenance annuel",
        qte: 1,
        prixUnitaireHT: 9600,
      },
    ],
  },
  {
    id: "doc-fac-2026-0002",
    type: "facture",
    numero: "FAC-2026-0002",
    clientId: "client-al-bahr",
    dateCreation: julyTimestampMilliseconds,
    statut: "paye",
    lignes: [
      {
        articleId: "arm-cmd-001",
        designation: "Armoire de commande avec variateur",
        qte: 1,
        prixUnitaireHT: 18500,
      },
      {
        articleId: "mot-gl-002",
        designation: "Moteur Gearless 13 personnes",
        qte: 1,
        prixUnitaireHT: 27000,
    },
    ],
  },
  {
    id: "doc-bl-2026-0001",
    type: "bon_livraison",
    numero: "BL-2026-0001",
    clientId: "client-al-bahr",
    dateCreation: julyTimestampMilliseconds + 3 * 86400000,
    statut: "paye",
    lignes: [
      {
        articleId: "arm-cmd-001",
        designation: "Armoire de commande avec variateur",
        qte: 1,
        prixUnitaireHT: 18500,
      },
    ],
  },
  {
    id: "doc-fac-2026-0003",
    type: "facture",
    numero: "FAC-2026-0003",
    clientId: "client-riad-vert",
    dateCreation: { seconds: Date.UTC(2026, 7, 4, 9) / 1000 },
    statut: "paye",
    lignes: [
      {
        articleId: "mot-gl-002",
        designation: "Moteur Gearless 13 personnes",
        qte: 1,
        prixUnitaireHT: 45000,
      },
      {
        articleId: "cab-008",
        designation: "Câble de traction 8 mm",
        qte: 40,
        prixUnitaireHT: 300,
      },
      {
        articleId: "inst-mes-001",
        designation: "Installation et mise en service",
        qte: 1,
        prixUnitaireHT: 5000,
      },
    ],
  },
  {
    id: "doc-rec-2026-0001",
    type: "recu",
    numero: "REC-2026-0001",
    clientId: "client-riad-vert",
    dateCreation: "2026-08-06T11:30:00.000Z",
    statut: "paye",
    lignes: [
      {
        articleId: "ctr-maint-ann",
        designation: "Acompte sur contrat de maintenance annuel",
        qte: 1,
        prixUnitaireHT: 5000,
      },
    ],
  },
  {
    id: "doc-fac-2026-0004",
    type: "facture",
    numero: "FAC-2026-0004",
    clientId: "client-technopark",
    dateCreation: "2026-09-16",
    statut: "en_attente",
    lignes: [
      {
        articleId: "arm-cmd-001",
        designation: "Armoire de commande avec variateur",
        qte: 1,
        prixUnitaireHT: 18500,
      },
      {
        articleId: "cab-008",
        designation: "Câble de traction 8 mm",
        qte: 50,
        prixUnitaireHT: 190,
      },
    ],
  },
  {
    id: "doc-dev-2026-0002",
    type: "devis",
    numero: "DEV-2026-0002",
    clientId: "client-oasis",
    dateCreation: Date.UTC(2026, 9, 3, 10),
    statut: "en_attente",
    lignes: [
      {
        articleId: "cab-001",
        designation: "Cabine ascenseur finition inox",
        qte: 1,
        prixUnitaireHT: 22500,
      },
      {
        articleId: "por-pal-001",
        designation: "Porte palière automatique coupe-feu",
        qte: 2,
        prixUnitaireHT: 7800,
      },
    ],
  },
  {
    id: "doc-fac-2026-0005",
    type: "facture",
    numero: "FAC-2026-0005",
    clientId: "client-les-dunes",
    dateCreation: "2026-11-02T09:00:00.000Z",
    statut: "paye",
    lignes: [
      {
        articleId: "mot-gl-001",
        designation: "Moteur Gearless 8 personnes",
        qte: 1,
        prixUnitaireHT: 35000,
      },
      {
        articleId: "cab-008",
        designation: "Câble de traction 8 mm",
        qte: 50,
        prixUnitaireHT: 200,
      },
    ],
  },
  {
    id: "doc-fac-2026-0006",
    type: "facture",
    numero: "FAC-2026-0006",
    clientId: "client-atlas",
    dateCreation: { seconds: Date.UTC(2026, 10, 5, 14) / 1000, nanoseconds: 0 },
    statut: "en_attente",
    lignes: [
      {
        articleId: "ctr-maint-ann",
        designation: "Contrat de maintenance annuel",
        qte: 1,
        prixUnitaireHT: 9600,
      },
      {
        articleId: "visit-tech-001",
        designation: "Intervention et visite technique",
        qte: 1,
        prixUnitaireHT: 8900,
      },
    ],
  },
];
