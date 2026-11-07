import {
  Timestamp,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { catalogue } from "@/data/catalogue";
import { clients } from "@/data/clients";
import { documents } from "@/data/documents";
import { getFirebaseDb } from "@/lib/firebase";
import { nextDocumentNumberInTransaction } from "@/lib/documentNumber";
import { nextOperationNumberInTransaction } from "@/lib/operationNumbers";
import { firestoreErrorMessage } from "@/lib/firestoreErrors";
import { computeDiscountedTotals } from "@/lib/computeDiscountedTotals";
import { assertOnline } from "@/lib/online";
import {
  changerStatutPaiement,
  enregistrerPaiement,
  enregistrerRelance,
} from "@/lib/recouvrementTransactions";
import {
  applyStockMovement,
  stockMovementId,
} from "@/lib/stockTransactions";
import type { Ascenseur, Contrat, Document, Intervention, Paiement } from "@/types";

export async function importDemoData(ownerUid: string): Promise<void> {
  assertOnline();
  const db = getFirebaseDb();
  const importRef = doc(db, "settings", "demoImport");

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(importRef);
    const importState = snapshot.exists() ? snapshot.data() : {};
    const status = importState.status;
    if (
      status === "completed" &&
      importState.stockVersion === 1 &&
      importState.recouvrementVersion === 1
    ) {
      throw new Error("Les données de démonstration ont déjà été importées.");
    }
    if (status === "importing") {
      throw new Error("L’import des données de démonstration est déjà en cours.");
    }
    transaction.set(importRef, {
      status: "importing",
      startedBy: ownerUid,
      startedAt: serverTimestamp(),
      lastError: null,
    });
  });

  try {
    await migrateExistingArticles();

    const clientRefs = clients.map((client) => doc(db, "clients", client.id));
    const articleRefs = catalogue.map((article) =>
      doc(db, "articles", article.id),
    );
    const existingRecords = await Promise.all(
      [...clientRefs, ...articleRefs].map((reference) => getDoc(reference)),
    );
    const batch = writeBatch(db);
    let batchWrites = 0;

    clientRefs.forEach((reference, index) => {
      if (existingRecords[index].exists()) return;
      batch.set(reference, clients[index]);
      batchWrites += 1;
    });
    articleRefs.forEach((reference, index) => {
      const article = catalogue[index];
      const existingArticle = existingRecords[index + clientRefs.length];
      const existingData = existingArticle.exists()
        ? existingArticle.data()
        : {};
      if (
        article.type === "service" &&
        typeof existingData.stockQte === "number" &&
        existingData.stockQte > 0
      ) {
        throw new Error(
          `Le service ${article.reference} contient une quantité en stock. Réconciliez-la avant l’import.`,
        );
      }
      const articleData: Record<string, unknown> = {
        ...article,
        ...(article.type === "produit"
          ? {
              stockQte:
                typeof existingData.stockQte === "number"
                  ? existingData.stockQte
                  : 0,
              seuilAlerte: demoStockThreshold(article.id),
              emplacement: demoStockLocation(article.id),
            }
          : {}),
        prixVenteHT: article.prixUnitaireHT,
      };
      if (article.type === "service") {
        articleData.stockQte = deleteField();
        articleData.seuilAlerte = deleteField();
        articleData.emplacement = deleteField();
        articleData.lastStockMovementId = deleteField();
      }
      batch.set(reference, articleData);
      batchWrites += 1;
    });
    if (batchWrites) await batch.commit();

    const costEntries = catalogue.filter((article) => article.type === "produit");
    const costReferences = costEntries.map((article) =>
      doc(db, "articlesCouts", article.id),
    );
    const existingCosts = await Promise.all(
      costReferences.map((reference) => getDoc(reference)),
    );
    const costBatch = writeBatch(db);
    let costWrites = 0;
    costEntries.forEach((article, index) => {
      if (existingCosts[index].exists()) return;
      costBatch.set(costReferences[index], {
        prixAchatHT: Math.round(article.prixUnitaireHT * 0.58 * 100) / 100,
        fournisseurPrincipal: "Fournisseur TGI",
      });
      costWrites += 1;
    });
    if (costWrites) await costBatch.commit();

    await importDemoStock(ownerUid);

    const operationSeeds = demoOperations();
    const operationalRefs = [
      ...operationSeeds.ascenseurs.map((item) => doc(db, "ascenseurs", item.id)),
      ...operationSeeds.contrats.map((item) => doc(db, "contrats", item.id)),
      ...operationSeeds.interventions.map((item) => doc(db, "interventions", item.id)),
    ];
    const existingOperations = await Promise.all(operationalRefs.map((reference) => getDoc(reference)));
    const operationalBatch = writeBatch(db);
    let operationalWrites = 0;
    operationSeeds.ascenseurs.forEach((item, index) => {
      if (existingOperations[index].exists()) return;
      operationalBatch.set(operationalRefs[index], item);
      operationalWrites += 1;
    });
    if (operationalWrites) await operationalBatch.commit();

    const elevatorCount = operationSeeds.ascenseurs.length;
    for (const [index, item] of operationSeeds.contrats.entries()) {
      if (existingOperations[elevatorCount + index].exists()) continue;
      await importContract(ownerUid, item);
    }
    const interventionOffset = elevatorCount + operationSeeds.contrats.length;
    for (const [index, item] of operationSeeds.interventions.entries()) {
      if (existingOperations[interventionOffset + index].exists()) continue;
      await importIntervention(ownerUid, item);
    }

    const existingDocuments = await getDocs(collection(db, "documents"));
    const existingIds = new Set(existingDocuments.docs.map((item) => item.id));
    const receivableDocuments = demoReceivableDocuments();
    const orderedDocuments = [...documents, ...receivableDocuments].sort((left, right) =>
      left.numero.localeCompare(right.numero, "en"),
    );
    for (const demoDocument of orderedDocuments) {
      if (existingIds.has(demoDocument.id)) continue;
      await importDocument(ownerUid, demoDocument);
    }
    await migrateInvoiceReceivableCache();
    await importDemoReceivables(ownerUid, receivableDocuments);

    await setDoc(importRef, {
      status: "completed",
      completedBy: ownerUid,
      completedAt: serverTimestamp(),
      importedClients: clients.length,
      importedArticles: catalogue.length,
      importedStockMovements: 15,
      stockVersion: 1,
      importedDocuments: documents.length + receivableDocuments.length,
      importedReceivables: receivableDocuments.length,
      importedPayments: 3,
      importedReminders: 2,
      recouvrementVersion: 1,
      importedAscenseurs: operationSeeds.ascenseurs.length,
      importedContrats: operationSeeds.contrats.length,
      importedInterventions: operationSeeds.interventions.length,
      lastError: null,
    });
  } catch (error) {
    const message = firestoreErrorMessage(error);
    await setDoc(
      importRef,
      {
        status: "failed",
        failedAt: serverTimestamp(),
        lastError: message,
      },
      { merge: true },
    );
    throw new Error(message);
  }
}

async function migrateExistingArticles(): Promise<void> {
  const db = getFirebaseDb();
  const [articlesSnapshot, costsSnapshot] = await Promise.all([
    getDocs(collection(db, "articles")),
    getDocs(collection(db, "articlesCouts")),
  ]);
  const costIds = new Set(costsSnapshot.docs.map((entry) => entry.id));
  const entries = articlesSnapshot.docs;

  for (let offset = 0; offset < entries.length; offset += 200) {
    const batch = writeBatch(db);
    const chunk = entries.slice(offset, offset + 200);
    for (const entry of chunk) {
      const source = entry.data();
      const isService =
        source.type === "service" || source.categorie === "Services";
      const existingQuantity = source.stockQte;
      if (
        isService &&
        typeof existingQuantity === "number" &&
        existingQuantity > 0
      ) {
        throw new Error(
          `Le service ${entry.id} possède un stock positif. Corrigez-le avant la migration.`,
        );
      }
      if (
        !isService &&
        existingQuantity !== undefined &&
        (typeof existingQuantity !== "number" ||
          !Number.isFinite(existingQuantity) ||
          existingQuantity < 0)
      ) {
        throw new Error(
          `La quantité historique de ${entry.id} est invalide. Corrigez-la avant la migration.`,
        );
      }

      const patch: Record<string, unknown> = {
        type: isService ? "service" : "produit",
        actif: typeof source.actif === "boolean" ? source.actif : true,
      };
      if (isService) {
        patch.stockQte = deleteField();
        patch.seuilAlerte = deleteField();
        patch.emplacement = deleteField();
        patch.lastStockMovementId = deleteField();
      } else {
        patch.stockQte =
          typeof existingQuantity === "number" ? existingQuantity : 0;
        patch.seuilAlerte =
          typeof source.seuilAlerte === "number" &&
          Number.isFinite(source.seuilAlerte) &&
          source.seuilAlerte >= 0
            ? source.seuilAlerte
            : 0;
        patch.emplacement =
          typeof source.emplacement === "string" ? source.emplacement : "";
      }

      if (source.prixAchatHT !== undefined) {
        if (
          (typeof source.prixAchatHT !== "number" ||
            !Number.isFinite(source.prixAchatHT) ||
            source.prixAchatHT < 0) &&
          !costIds.has(entry.id)
        ) {
          throw new Error(
            `Le prix d’achat historique de ${entry.id} est invalide et doit être corrigé avant la migration.`,
          );
        }
        if (
          typeof source.prixAchatHT === "number" &&
          Number.isFinite(source.prixAchatHT) &&
          source.prixAchatHT >= 0 &&
          !costIds.has(entry.id)
        ) {
          batch.set(
            doc(db, "articlesCouts", entry.id),
            {
              prixAchatHT: source.prixAchatHT,
              fournisseurPrincipal:
                typeof source.fournisseurPrincipal === "string"
                  ? source.fournisseurPrincipal
                  : "Fournisseur TGI",
            },
            { merge: true },
          );
        }
        patch.prixAchatHT = deleteField();
      }
      if (source.fournisseurPrincipal !== undefined) {
        patch.fournisseurPrincipal = deleteField();
      }
      batch.update(entry.ref, patch);
    }
    await batch.commit();
  }
}

function demoStockThreshold(articleId: string): number {
  const thresholds: Record<string, number> = {
    "mot-gl-001": 25,
    "mot-gl-002": 5,
    "cab-008": 3,
    "cab-010": 2,
    "por-pal-001": 5,
    "arm-cmd-001": 5,
    "cab-001": 5,
    "cell-opt-001": 5,
    "bout-etg-001": 5,
  };
  return thresholds[articleId] ?? 0;
}

function demoStockLocation(articleId: string): string {
  return `Zone ${articleId.slice(0, 3).toUpperCase()}`;
}

async function importDemoStock(userId: string): Promise<void> {
  const initialQuantities: ReadonlyArray<readonly [string, number]> = [
    ["mot-gl-001", 21],
    ["mot-gl-002", 3],
    ["cab-008", 2],
    ["por-pal-001", 26],
    ["arm-cmd-001", 4],
    ["cab-001", 9],
    ["cell-opt-001", 11],
    ["bout-etg-001", 13],
  ];
  for (const [articleId, quantity] of initialQuantities) {
    await applyStockMovement(
      {
        articleId,
        type: "entree",
        qte: quantity,
        motif: "Stock initial de démonstration",
        source: "inventaire",
        movementId: stockMovementId("inventaire", "demo-stock-initial", articleId),
      },
      userId,
      "Import de démonstration",
    );
  }
  for (const [articleId] of initialQuantities.slice(0, 7)) {
    const quantity = articleId === "cab-008" ? 2 : 1;
    await applyStockMovement(
      {
        articleId,
        type: "sortie",
        qte: quantity,
        motif: "Ajustement des niveaux de démonstration",
        source: "inventaire",
        movementId: stockMovementId("inventaire", "demo-stock-adjustment", articleId),
      },
      userId,
      "Import de démonstration",
    );
  }
}

function demoReceivableDocuments(): Document[] {
  const dateDaysAgo = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return Timestamp.fromDate(date);
  };
  return [
    {
      id: "demo-receivable-1-30",
      type: "facture",
      numero: "FAC-DEMO-1-30",
      clientId: "client-les-dunes",
      dateCreation: dateDaysAgo(45),
      dateEcheance: dateDaysAgo(15),
      statut: "en_attente",
      lignes: [{ articleId: "demo-maintenance", designation: "Maintenance d’ascenseur", qte: 1, prixUnitaireHT: 6000 }],
    },
    {
      id: "demo-receivable-31-60",
      type: "facture",
      numero: "FAC-DEMO-31-60",
      clientId: "client-atlas",
      dateCreation: dateDaysAgo(75),
      dateEcheance: dateDaysAgo(45),
      statut: "en_attente",
      lignes: [{ articleId: "demo-maintenance", designation: "Maintenance d’ascenseur", qte: 1, prixUnitaireHT: 12000 }],
    },
    {
      id: "demo-receivable-61-90",
      type: "facture",
      numero: "FAC-DEMO-61-90",
      clientId: "client-al-bahr",
      dateCreation: dateDaysAgo(105),
      dateEcheance: dateDaysAgo(75),
      statut: "en_attente",
      lignes: [{ articleId: "demo-maintenance", designation: "Maintenance d’ascenseur", qte: 1, prixUnitaireHT: 9000 }],
    },
    {
      id: "demo-receivable-90-plus",
      type: "facture",
      numero: "FAC-DEMO-90-PLUS",
      clientId: "client-riad-vert",
      dateCreation: dateDaysAgo(150),
      dateEcheance: dateDaysAgo(120),
      statut: "en_attente",
      lignes: [{ articleId: "demo-maintenance", designation: "Maintenance d’ascenseur", qte: 1, prixUnitaireHT: 20000 }],
    },
  ];
}

async function importDemoReceivables(
  ownerUid: string,
  receivableDocuments: readonly Document[],
): Promise<void> {
  const db = getFirebaseDb();
  const invoices = new Map(receivableDocuments.map((invoice) => [invoice.id, invoice]));
  const plannedDate = new Date();
  plannedDate.setDate(plannedDate.getDate() + 14);
  const paymentSeeds = [
    {
      paymentId: "demo-payment-transfer-partial",
      documentId: "demo-receivable-1-30",
      clientId: "client-les-dunes",
      montant: 2000,
      mode: "virement" as const,
      reference: "VIR-DEMO-001",
    },
    {
      paymentId: "demo-payment-cheque-portfolio",
      documentId: "demo-receivable-31-60",
      clientId: "client-atlas",
      montant: 2500,
      mode: "cheque" as const,
      reference: "CHQ-DEMO-001",
      banque: "Banque de démonstration",
      dateEncaissementPrevue: plannedDate,
    },
    {
      paymentId: "demo-payment-cheque-bounced",
      documentId: "demo-receivable-90-plus",
      clientId: "client-riad-vert",
      montant: 1500,
      mode: "cheque" as const,
      reference: "CHQ-DEMO-002",
      banque: "Banque de démonstration",
      dateEncaissementPrevue: plannedDate,
    },
  ];

  for (const seed of paymentSeeds) {
    const invoice = invoices.get(seed.documentId);
    if (!invoice) throw new Error(`La facture de démonstration ${seed.documentId} est introuvable.`);
    await enregistrerPaiement({
      ...seed,
    }, ownerUid);
  }

  const bouncedPayment: Paiement = {
    id: "demo-payment-cheque-bounced",
    documentId: "demo-receivable-90-plus",
    clientId: "client-riad-vert",
    montant: 1500,
    mode: "cheque",
    reference: "CHQ-DEMO-002",
    banque: "Banque de démonstration",
    dateEncaissementPrevue: plannedDate,
    statut: "en_portefeuille",
    userId: ownerUid,
    date: new Date(),
  };
  await changerStatutPaiement(bouncedPayment, "impaye", ownerUid, "owner", "Chèque rejeté — scénario de démonstration");

  const existingReminderIds = new Set(
    (await getDocs(collection(db, "relances"))).docs.map((entry) => entry.id),
  );
  const reminderSeeds = [
    {
      id: "demo-relance-1",
      clientId: "client-les-dunes",
      documentIds: ["demo-receivable-1-30"],
      niveau: 1 as const,
      canal: "appel" as const,
      note: "Rappel courtois de démonstration.",
      promessePaiementDate: new Date(Date.now() - 2 * 86_400_000),
      promesseMontant: 5000,
    },
    {
      id: "demo-relance-2",
      clientId: "client-riad-vert",
      documentIds: ["demo-receivable-90-plus"],
      niveau: 3 as const,
      canal: "email" as const,
      note: "Relance formelle de démonstration après rejet du chèque.",
    },
  ];
  for (const reminder of reminderSeeds) {
    if (existingReminderIds.has(reminder.id)) continue;
    const { id, ...values } = reminder;
    await enregistrerRelance(values, ownerUid, id);
  }
}

async function migrateInvoiceReceivableCache(): Promise<void> {
  const db = getFirebaseDb();
  const [documentSnapshot, clientSnapshot] = await Promise.all([
    getDocs(collection(db, "documents")),
    getDocs(collection(db, "clients")),
  ]);
  const paymentDelays = new Map(
    clientSnapshot.docs.map((entry) => {
      const delay = entry.data().delaiPaiementJours;
      return [
        entry.id,
        typeof delay === "number" && Number.isInteger(delay) && delay >= 0
          ? delay
          : 30,
      ] as const;
    }),
  );
  const invoices = documentSnapshot.docs.filter(
    (entry) => entry.data().type === "facture",
  );
  for (let offset = 0; offset < invoices.length; offset += 400) {
    const batch = writeBatch(db);
    let writes = 0;
    for (const entry of invoices.slice(offset, offset + 400)) {
      const source = entry.data();
      const patch: Record<string, unknown> = {};
      if (
        typeof source.montantTTC !== "number" ||
        !Number.isFinite(source.montantTTC) ||
        source.montantTTC < 0
      ) {
        const lines = source.lignes;
        if (!Array.isArray(lines)) {
          throw new Error(`Les lignes de la facture ${entry.id} sont invalides.`);
        }
        const parsedLines = lines.map((line) => {
          if (
            typeof line !== "object" ||
            line === null ||
            !("articleId" in line) ||
            typeof line.articleId !== "string" ||
            !("designation" in line) ||
            typeof line.designation !== "string" ||
            !("qte" in line) ||
            typeof line.qte !== "number" ||
            !("prixUnitaireHT" in line) ||
            typeof line.prixUnitaireHT !== "number"
          ) throw new Error(`Une ligne de la facture ${entry.id} est invalide.`);
          return {
            articleId: line.articleId,
            designation: line.designation,
            qte: line.qte,
            prixUnitaireHT: line.prixUnitaireHT,
          };
        });
        const total = computeDiscountedTotals(
          parsedLines,
          typeof source.remisePct === "number" ? source.remisePct : 0,
        ).totalTTC;
        if (!Number.isFinite(total) || total < 0) {
          throw new Error(`Le total de la facture ${entry.id} est invalide.`);
        }
        patch.montantTTC = total;
      }
      if (
        typeof source.montantPaye !== "number" ||
        !Number.isFinite(source.montantPaye) ||
        source.montantPaye < 0
      ) {
        patch.montantPaye = source.statut === "paye"
          ? patch.montantTTC ?? source.montantTTC
          : 0;
      }
      if (!source.dateEcheance) {
        const createdAt = demoDocumentDate(source.dateCreation);
        if (Number.isNaN(createdAt.getTime())) {
          throw new Error(`La date de la facture ${entry.id} est invalide.`);
        }
        createdAt.setDate(
          createdAt.getDate() + (paymentDelays.get(String(source.clientId)) ?? 30),
        );
        patch.dateEcheance = Timestamp.fromDate(createdAt);
      }
      if (Object.keys(patch).length) {
        batch.update(entry.ref, patch);
        writes += 1;
      }
    }
    if (writes) await batch.commit();
  }
}

function demoOperations(): {
  ascenseurs: Ascenseur[];
  contrats: Omit<Contrat, "numero" | "counterKey" | "sequence" | "year" | "yearKey">[];
  interventions: Omit<Intervention, "numero" | "counterKey" | "sequence" | "year" | "yearKey">[];
} {
  const now = new Date();
  const date = (months: number, dayOffset = 0) => {
    const result = new Date(now.getFullYear(), now.getMonth() + months, now.getDate());
    result.setDate(result.getDate() + dayOffset);
    return Timestamp.fromDate(result);
  };
  const ascenseurs: Ascenseur[] = Array.from({ length: 6 }, (_, index) => ({
    id: `demo-elevator-${String(index + 1).padStart(2, "0")}`,
    clientId: [
      "client-les-dunes",
      "client-atlas",
      "client-al-bahr",
      "client-riad-vert",
      "client-technopark",
      "client-oasis",
    ][index],
    site: `Bâtiment ${index + 1}`,
    adresse: [
      "Avenue des FAR, Agadir",
      "Boulevard Mohammed V, Tanger",
      "Rue de la Plage, Casablanca",
      "Avenue de France, Marrakech",
      "Route de Sefrou, Fès",
      "Avenue Al Massira, Beni Mellal",
    ][index],
    marque: ["Otis", "Schindler", "KONE", "ThyssenKrupp", "Mitsubishi", "Otis"][index],
    modele: ["Gen2", "S3000", "MonoSpace", "Evolution", "Nexiez", "Gen2"][index],
    numeroSerie: `TGI-MA-2026-${String(index + 1).padStart(4, "0")}`,
    annee: 2018 + index,
    capacite: index % 2 ? 8 : 10,
    nbNiveaux: 5 + index,
    typeMachine: index % 2 ? "Hydraulique" : "Gearless",
    dateMiseEnService: date(-36),
    ...(index < 3 ? { contratId: `demo-contract-${String(index + 1).padStart(2, "0")}` } : {}),
    statut: index === 4 ? "en_panne" : "en_service",
    prochaineVisite: date(0, 14 + index),
  }));
  const contrats: Omit<Contrat, "numero" | "counterKey" | "sequence" | "year" | "yearKey">[] = [
    { id: "demo-contract-01", clientId: "client-les-dunes", ascenseurIds: [ascenseurs[0].id], type: "maintenance", dateDebut: date(-12), dateFin: date(12), periodicite: "trimestrielle", montantHT: 3600, visitesParAn: 4, reconductionAuto: true, statut: "actif", conditionsParticulieres: "", prochaineFacturation: date(0), createdBy: "" },
    { id: "demo-contract-02", clientId: "client-atlas", ascenseurIds: [ascenseurs[1].id], type: "maintenance", dateDebut: date(-12), dateFin: date(0, 30), periodicite: "trimestrielle", montantHT: 4800, visitesParAn: 4, reconductionAuto: true, statut: "actif", conditionsParticulieres: "", prochaineFacturation: date(0), createdBy: "" },
    { id: "demo-contract-03", clientId: "client-al-bahr", ascenseurIds: [ascenseurs[2].id], type: "maintenance", dateDebut: date(-24), dateFin: date(0, -1), periodicite: "mensuelle", montantHT: 900, visitesParAn: 12, reconductionAuto: false, statut: "actif", conditionsParticulieres: "", prochaineFacturation: date(0, -90), createdBy: "" },
    { id: "demo-contract-04", clientId: "client-riad-vert", ascenseurIds: [ascenseurs[3].id], type: "installation", dateDebut: date(0), dateFin: date(12), periodicite: "annuelle", montantHT: 12000, visitesParAn: 2, reconductionAuto: false, statut: "brouillon", conditionsParticulieres: "", prochaineFacturation: date(0), createdBy: "" },
  ];
  const interventions: Omit<Intervention, "numero" | "counterKey" | "sequence" | "year" | "yearKey">[] =
    Array.from({ length: 8 }, (_, index) => ({
      id: `demo-intervention-${String(index + 1).padStart(2, "0")}`,
      ascenseurId: ascenseurs[index % ascenseurs.length].id,
      type: index % 3 === 0 ? "depannage" : index % 3 === 1 ? "visite" : "installation",
      date: date(0, index - 3),
      technicien: ["Amine El Fassi", "Omar Berrada", "Yassine El Idrissi"][index % 3],
      rapport: index < 3 ? "Intervention planifiée." : "Contrôle des organes de sécurité réalisé.",
      descriptionProbleme: index % 3 === 0 ? "Contrôle et diagnostic de fonctionnement." : "",
      piecesUtilisees: [],
      statut: index < 3 ? "planifiee" : "terminee",
      duree: index < 3 ? 0 : 90,
      signatureClient: index >= 3,
      nomSignataire: index >= 3 ? "Responsable du site" : "",
      createdBy: "",
    }));
  return { ascenseurs, contrats, interventions };
}

async function importContract(
  ownerUid: string,
  source: ReturnType<typeof demoOperations>["contrats"][number],
): Promise<void> {
  const db = getFirebaseDb();
  const reference = doc(db, "contrats", source.id);
  await runTransaction(db, async (transaction) => {
    if ((await transaction.get(reference)).exists()) return;
    const date = demoDocumentDate(source.dateDebut);
    const allocation = await nextOperationNumberInTransaction(transaction, db, "contrat", date, source.id);
    transaction.set(reference, {
      ...source,
      numero: allocation.numero,
      createdBy: ownerUid,
      counterKind: "contrat",
      counterKey: allocation.counterKey,
      sequence: allocation.sequence,
      year: allocation.year,
      yearKey: allocation.yearKey,
      createdAt: serverTimestamp(),
    });
  });
}

async function importIntervention(
  ownerUid: string,
  source: ReturnType<typeof demoOperations>["interventions"][number],
): Promise<void> {
  const db = getFirebaseDb();
  const reference = doc(db, "interventions", source.id);
  await runTransaction(db, async (transaction) => {
    if ((await transaction.get(reference)).exists()) return;
    const date = demoDocumentDate(source.date);
    const allocation = await nextOperationNumberInTransaction(transaction, db, "intervention", date, source.id);
    transaction.set(reference, {
      ...source,
      numero: allocation.numero,
      createdBy: ownerUid,
      counterKind: "intervention",
      counterKey: allocation.counterKey,
      sequence: allocation.sequence,
      year: allocation.year,
      yearKey: allocation.yearKey,
      createdAt: serverTimestamp(),
    });
  });
}

async function importDocument(
  ownerUid: string,
  sourceDocument: Document,
): Promise<void> {
  const db = getFirebaseDb();
  const documentRef = doc(db, "documents", sourceDocument.id);
  const date = demoDocumentDate(sourceDocument.dateCreation);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`La date du document ${sourceDocument.numero} est invalide.`);
  }
  await runTransaction(db, async (transaction) => {
    const existingDocument = await transaction.get(documentRef);
    if (existingDocument.exists()) return;
    const allocation = await nextDocumentNumberInTransaction(
      transaction,
      db,
      sourceDocument.type,
      date,
      sourceDocument.id,
    );
    const nextDocument: Document = {
      ...sourceDocument,
      numero: allocation.numero,
      createdBy: ownerUid,
    };
    const totals = computeDiscountedTotals(
      sourceDocument.lignes,
      sourceDocument.remisePct,
    );
    const dueDate = sourceDocument.type === "facture"
      ? sourceDocument.dateEcheance
        ? demoDocumentDate(sourceDocument.dateEcheance)
        : new Date(date.getTime() + 30 * 86_400_000)
      : null;
    transaction.set(documentRef, {
      ...nextDocument,
      counterKey: allocation.counterKey,
      sequence: allocation.sequence,
      year: allocation.year,
      yearKey: allocation.yearKey,
      dateCreation: Timestamp.fromDate(date),
      ...(dueDate ? { dateEcheance: Timestamp.fromDate(dueDate) } : {}),
      ...(sourceDocument.type === "facture"
        ? { montantTTC: totals.totalTTC, montantPaye: 0 }
        : {}),
      createdAt: serverTimestamp(),
    });
  });
}

function demoDocumentDate(input: Document["dateCreation"]): Date {
  if (input instanceof Date) return input;
  if (typeof input === "number") {
    return new Date(input < 1e11 ? input * 1000 : input);
  }
  if (typeof input === "string") return new Date(input);
  if (input && "toDate" in input) return input.toDate();
  if (input && "seconds" in input) return new Date(input.seconds * 1000);
  return new Date(Number.NaN);
}
