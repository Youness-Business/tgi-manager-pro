import type { DocumentStatus, DocumentType } from "@/types";

export const documentTypeLabels: Record<DocumentType, string> = {
  facture: "Facture",
  devis: "Devis",
  recu: "Reçu",
  bon_livraison: "Bon de livraison",
};

export const documentStatusLabels: Record<DocumentStatus, string> = {
  en_attente: "En attente",
  partiel: "Partiellement payé",
  paye: "Payé",
  annule: "Annulé",
};
