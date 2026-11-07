import { doc, updateDoc } from "firebase/firestore";
import { firestoreErrorMessage } from "@/lib/firestoreErrors";
import { getFirebaseDb } from "@/lib/firebase";
import { assertOnline } from "@/lib/online";

export async function saveClientCreditTerms(
  clientId: string,
  values: {
    delaiPaiementJours: number;
    limiteCredit?: number;
    notesRecouvrement: string;
  },
): Promise<void> {
  assertOnline();
  if (
    !Number.isInteger(values.delaiPaiementJours) ||
    values.delaiPaiementJours < 0 ||
    values.delaiPaiementJours > 365 ||
    (values.limiteCredit !== undefined &&
      (!Number.isFinite(values.limiteCredit) || values.limiteCredit < 0))
  ) throw new Error("Vérifiez le délai de paiement et la limite de crédit.");
  try {
    await updateDoc(doc(getFirebaseDb(), "clients", clientId), {
      delaiPaiementJours: values.delaiPaiementJours,
      limiteCredit: values.limiteCredit ?? null,
      notesRecouvrement: values.notesRecouvrement.trim(),
    });
  } catch (error) {
    throw new Error(firestoreErrorMessage(error));
  }
}
