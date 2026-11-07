import { DocumentLayout } from "./DocumentLayout";
import type { Client, Document, PaymentMethod } from "@/types";

type RecuProps = {
  document: Document;
  client: Client;
  modePaiement?: PaymentMethod;
};

export function Recu({ document, client, modePaiement }: RecuProps) {
  if (document.type !== "recu") {
    throw new Error("Le composant Recu attend un document de type reçu.");
  }

  return (
    <DocumentLayout
      document={document}
      client={client}
      modePaiement={modePaiement}
    />
  );
}
