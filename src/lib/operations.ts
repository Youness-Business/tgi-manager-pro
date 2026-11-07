import {
  Timestamp,
  doc,
  runTransaction,
  serverTimestamp,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { firestoreErrorMessage } from "@/lib/firestoreErrors";
import { addMonths, getContratStatut, periodeFacturation, computeProchaineVisite } from "@/lib/contractDates";
import { nextDocumentNumberInTransaction } from "@/lib/documentNumber";
import { nextOperationNumberInTransaction } from "@/lib/operationNumbers";
import { computeTotals } from "@/lib/computeTotals";
import { parseContrat } from "@/context/OperationsDataProvider";
import type {
  Ascenseur,
  AscenseurStatut,
  Contrat,
  ContratStatut,
  Document as TgiDocument,
  Intervention,
  LigneDocument,
  Periodicite,
  PieceIntervention,
} from "@/types";

function readableError(error: unknown): Error {
  return new Error(firestoreErrorMessage(error));
}

function asDate(input: Contrat["dateDebut"]): Date {
  if (input instanceof Date) return new Date(input.getTime());
  if (typeof input === "number") return new Date(input < 1e11 ? input * 1000 : input);
  if (typeof input === "string") return new Date(input);
  if (input && "toDate" in input && typeof input.toDate === "function") return input.toDate();
  if (input && "seconds" in input) return new Date(input.seconds * 1000);
  throw new Error("La date fournie est invalide.");
}

export type NewContract = Omit<
  Contrat,
  "id" | "numero" | "statut" | "createdAt" | "createdBy" | "counterKey" | "sequence" | "year" | "yearKey"
>;

export async function createContract(
  input: NewContract,
  userId: string,
): Promise<Contrat> {
  const db = getFirebaseDb();
  const id = crypto.randomUUID();
  const contractRef = doc(db, "contrats", id);
  const date = asDate(input.dateDebut);
  try {
    return await runTransaction(db, async (transaction) => {
      const number = await nextOperationNumberInTransaction(transaction, db, "contrat", date, id);
      const contract: Contrat = {
        ...input,
        id,
        numero: number.numero,
        statut: "brouillon",
        createdBy: userId,
        counterKey: number.counterKey,
        sequence: number.sequence,
        year: number.year,
        yearKey: number.yearKey,
      };
      transaction.set(contractRef, {
        ...contract,
        counterKind: "contrat",
        dateDebut: Timestamp.fromDate(asDate(contract.dateDebut)),
        dateFin: Timestamp.fromDate(asDate(contract.dateFin)),
        prochaineFacturation: Timestamp.fromDate(asDate(contract.prochaineFacturation)),
        createdAt: serverTimestamp(),
      });
      return contract;
    });
  } catch (error) {
    throw readableError(error);
  }
}

export async function saveElevator(
  elevator: Omit<Ascenseur, "createdAt"> & { createdAt?: Ascenseur["createdAt"] },
  isNew: boolean,
): Promise<void> {
  const db = getFirebaseDb();
  const reference = doc(db, "ascenseurs", elevator.id);
  const values = {
    ...elevator,
    dateMiseEnService: Timestamp.fromDate(asDate(elevator.dateMiseEnService)),
    prochaineVisite: Timestamp.fromDate(asDate(elevator.prochaineVisite)),
  };
  try {
    if (isNew) {
      await setDoc(reference, { ...values, createdAt: serverTimestamp() });
    } else {
      await updateDoc(reference, values);
    }
  } catch (error) {
    throw readableError(error);
  }
}

export async function updateElevatorStatus(
  elevatorId: string,
  status: AscenseurStatut,
): Promise<void> {
  try {
    await updateDoc(doc(getFirebaseDb(), "ascenseurs", elevatorId), { statut: status });
  } catch (error) {
    throw readableError(error);
  }
}

export async function createIntervention(
  values: Pick<Intervention, "ascenseurId" | "type" | "date" | "technicien" | "descriptionProbleme">,
  userId: string,
): Promise<Intervention> {
  const db = getFirebaseDb();
  const id = crypto.randomUUID();
  const reference = doc(db, "interventions", id);
  const date = asDate(values.date);
  try {
    return await runTransaction(db, async (transaction) => {
      const elevator = await transaction.get(doc(db, "ascenseurs", values.ascenseurId));
      if (!elevator.exists()) throw new Error("L’ascenseur sélectionné n’existe plus.");
      const number = await nextOperationNumberInTransaction(transaction, db, "intervention", date, id);
      const intervention: Intervention = {
        ...values,
        id,
        numero: number.numero,
        date,
        technicien: values.technicien.trim(),
        rapport: "",
        piecesUtilisees: [],
        statut: "planifiee",
        duree: 0,
        signatureClient: false,
        nomSignataire: "",
        createdBy: userId,
        counterKey: number.counterKey,
        sequence: number.sequence,
        year: number.year,
        yearKey: number.yearKey,
      };
      transaction.set(reference, {
        ...intervention,
        counterKind: "intervention",
        date: Timestamp.fromDate(date),
        createdAt: serverTimestamp(),
      });
      return intervention;
    });
  } catch (error) {
    throw readableError(error);
  }
}

export type CloseInterventionInput = {
  rapport: string;
  duree: number;
  piecesUtilisees: PieceIntervention[];
  signatureClient: boolean;
  nomSignataire: string;
};

export async function closeIntervention(
  intervention: Intervention,
  input: CloseInterventionInput,
  resumeElevatorAfterBreakdown: boolean,
): Promise<void> {
  const db = getFirebaseDb();
  const interventionRef = doc(db, "interventions", intervention.id);
  const elevatorRef = doc(db, "ascenseurs", intervention.ascenseurId);
  try {
    await runTransaction(db, async (transaction) => {
      const [current, elevatorSnapshot] = await Promise.all([
        transaction.get(interventionRef),
        transaction.get(elevatorRef),
      ]);
      if (!current.exists() || !elevatorSnapshot.exists()) {
        throw new Error("L’intervention ou l’ascenseur n’existe plus.");
      }
      if (current.data().statut === "terminee") {
        throw new Error("Cette intervention est déjà clôturée.");
      }
      const contractId = elevatorSnapshot.data().contratId;
      let nextVisit: Date | null = null;
      if (intervention.type === "visite" && typeof contractId === "string") {
        const contractSnapshot = await transaction.get(doc(db, "contrats", contractId));
        if (contractSnapshot.exists()) {
          const contract = parseContrat(contractSnapshot.id, contractSnapshot.data());
          if (contract) nextVisit = computeProchaineVisite(intervention.date, contract.periodicite);
        }
      }
      transaction.update(interventionRef, {
        ...input,
        rapport: input.rapport.trim(),
        nomSignataire: input.nomSignataire.trim(),
        statut: "terminee",
        closedAt: serverTimestamp(),
      });
      if (nextVisit) {
        transaction.update(elevatorRef, { prochaineVisite: Timestamp.fromDate(nextVisit) });
      }
      if (intervention.type === "depannage" && resumeElevatorAfterBreakdown) {
        transaction.update(elevatorRef, { statut: "en_service" });
      }
      // TODO(Phase 6D): create stock movements for the parts used by this intervention.
    });
  } catch (error) {
    throw readableError(error);
  }
}

export async function setContractStatus(
  contractId: string,
  status: ContratStatut,
  reason?: string,
): Promise<void> {
  const db = getFirebaseDb();
  const contractRef = doc(db, "contrats", contractId);
  try {
    await runTransaction(db, async (transaction) => {
      const contractSnapshot = await transaction.get(contractRef);
      if (!contractSnapshot.exists()) throw new Error("Ce contrat n’existe plus.");
      const contract = parseContrat(contractId, contractSnapshot.data());
      if (!contract) throw new Error("Les données du contrat sont invalides.");
      const elevatorRefs = contract.ascenseurIds.map((id) => doc(db, "ascenseurs", id));
      const elevators = await Promise.all(elevatorRefs.map((reference) => transaction.get(reference)));
      if (status !== "actif") {
        transaction.update(contractRef, {
          statut: status,
          ...(status === "resilie" ? { motifResiliation: reason?.trim() ?? "" } : {}),
        });
        elevators.forEach((snapshot, index) => {
          if (snapshot.exists() && snapshot.data().contratId === contractId) {
            transaction.update(elevatorRefs[index], { contratId: null });
          }
        });
      } else {
        for (const snapshot of elevators) {
          if (!snapshot.exists()) throw new Error("Un ascenseur lié au contrat est introuvable.");
          const assignedContractId = snapshot.data().contratId;
          if (!assignedContractId || assignedContractId === contractId) continue;
          const otherContract = await transaction.get(doc(db, "contrats", assignedContractId));
          if (otherContract.exists()) {
            const otherData = parseContrat(otherContract.id, otherContract.data());
            if (otherData && getContratStatut(otherData) === "actif") {
              throw new Error("Un ascenseur sélectionné est déjà lié à un contrat actif.");
            }
          }
        }
        transaction.update(contractRef, { statut: status });
        elevators.forEach((snapshot, index) => {
          if (snapshot.exists()) transaction.update(elevatorRefs[index], { contratId: contractId });
        });
      }
    });
  } catch (error) {
    throw readableError(error);
  }
}

export async function renewContract(
  contract: Contrat,
  userId: string,
): Promise<Contrat> {
  const oldStart = asDate(contract.dateDebut);
  const oldEnd = asDate(contract.dateFin);
  const start = new Date(oldEnd.getTime());
  start.setDate(start.getDate() + 1);
  const durationMonths = Math.max(
    1,
    (oldEnd.getFullYear() - oldStart.getFullYear()) * 12 +
      oldEnd.getMonth() - oldStart.getMonth(),
  );
  const end = addMonths(start, durationMonths);
  const renewed = await createContract(
    {
      clientId: contract.clientId,
      ascenseurIds: contract.ascenseurIds,
      type: contract.type,
      dateDebut: start,
      dateFin: end,
      periodicite: contract.periodicite,
      montantHT: contract.montantHT,
      visitesParAn: contract.visitesParAn,
      reconductionAuto: contract.reconductionAuto,
      conditionsParticulieres: contract.conditionsParticulieres,
      prochaineFacturation: start,
    },
    userId,
  );
  await updateDoc(doc(getFirebaseDb(), "contrats", renewed.id), { renewedFrom: contract.id });
  return renewed;
}

export async function generateContractInvoice(
  contractId: string,
  userId: string,
): Promise<TgiDocument> {
  const db = getFirebaseDb();
  const contractRef = doc(db, "contrats", contractId);
  const invoiceId = crypto.randomUUID();
  const invoiceRef = doc(db, "documents", invoiceId);
  try {
    return await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(contractRef);
      if (!snapshot.exists()) throw new Error("Ce contrat n’existe plus.");
      const contract = parseContrat(snapshot.id, snapshot.data());
      if (!contract) throw new Error("Les données du contrat sont invalides.");
      if (getContratStatut(contract) !== "actif") {
        throw new Error("Seul un contrat actif peut être facturé.");
      }
      const period = periodeFacturation(contract);
      if (period.debut > period.fin) throw new Error("La période de facturation est invalide.");
      if (contract.facturesPeriodes?.some((item) => item.key === period.key)) {
        throw new Error("Cette période a déjà été facturée.");
      }
      const lines: LigneDocument[] = [{
        articleId: `contrat-${contract.id}`,
        reference: contract.numero,
        designation: `${contract.type === "maintenance" ? "Contrat de maintenance" : "Contrat d’installation"} n° ${contract.numero} — période du ${period.debut.toLocaleDateString("fr-FR")} au ${period.fin.toLocaleDateString("fr-FR")}`,
        qte: 1,
        prixUnitaireHT: contract.montantHT,
      }];
      const allocation = await nextDocumentNumberInTransaction(
        transaction,
        db,
        "facture",
        period.debut,
        invoiceId,
      );
      const invoice: TgiDocument = {
        id: invoiceId,
        type: "facture",
        numero: allocation.numero,
        clientId: contract.clientId,
        dateCreation: period.debut,
        lignes: lines,
        statut: "en_attente",
        createdBy: userId,
      };
      transaction.set(invoiceRef, {
        ...invoice,
        counterKey: allocation.counterKey,
        sequence: allocation.sequence,
        year: allocation.year,
        yearKey: allocation.yearKey,
        dateCreation: Timestamp.fromDate(period.debut),
        createdAt: serverTimestamp(),
        contractId,
        periodKey: period.key,
      });
      const next = addMonths(period.debut, contract.periodicite === "mensuelle" ? 1 : contract.periodicite === "trimestrielle" ? 3 : 12);
      transaction.update(contractRef, {
        facturesPeriodes: [
          ...(contract.facturesPeriodes ?? []),
          {
            key: period.key,
            debut: Timestamp.fromDate(period.debut),
            fin: Timestamp.fromDate(period.fin),
            documentId: invoiceId,
          },
        ],
        prochaineFacturation: Timestamp.fromDate(next),
      });
      return invoice;
    });
  } catch (error) {
    throw readableError(error);
  }
}

export function annualContractRevenue(
  contract: Pick<Contrat, "periodicite" | "montantHT">,
): number {
  const periods: Record<Periodicite, number> = {
    mensuelle: 12,
    trimestrielle: 4,
    annuelle: 1,
  };
  const annualLines: LigneDocument[] = [{
    articleId: "annual-contract",
    designation: "Contrat annuel",
    qte: periods[contract.periodicite],
    prixUnitaireHT: contract.montantHT,
  }];
  return computeTotals(annualLines).totalHT;
}
