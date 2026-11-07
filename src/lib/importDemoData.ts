import {
  Timestamp,
  collection,
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
import type { Ascenseur, Contrat, Document, Intervention } from "@/types";

export async function importDemoData(ownerUid: string): Promise<void> {
  const db = getFirebaseDb();
  const importRef = doc(db, "settings", "demoImport");

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(importRef);
    const status = snapshot.exists() ? snapshot.data().status : undefined;
    if (status === "completed") {
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
      if (existingRecords[index + clientRefs.length].exists()) return;
      const article = catalogue[index];
      batch.set(reference, {
        ...article,
        type: article.categorie === "Services" ? "service" : "produit",
        stockQte: 0,
        seuilAlerte: 0,
        prixVenteHT: article.prixUnitaireHT,
      });
      batchWrites += 1;
    });
    if (batchWrites) await batch.commit();

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
    const orderedDocuments = [...documents].sort((left, right) =>
      left.numero.localeCompare(right.numero, "en"),
    );
    for (const demoDocument of orderedDocuments) {
      if (existingIds.has(demoDocument.id)) continue;
      await importDocument(ownerUid, demoDocument);
    }

    await setDoc(importRef, {
      status: "completed",
      completedBy: ownerUid,
      completedAt: serverTimestamp(),
      importedClients: clients.length,
      importedArticles: catalogue.length,
      importedDocuments: documents.length,
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
    transaction.set(documentRef, {
      ...nextDocument,
      counterKey: allocation.counterKey,
      sequence: allocation.sequence,
      year: allocation.year,
      yearKey: allocation.yearKey,
      dateCreation: Timestamp.fromDate(date),
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
