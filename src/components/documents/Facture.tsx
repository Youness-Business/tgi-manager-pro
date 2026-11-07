import { DocumentLayout } from "./DocumentLayout";
import type { Client, Document } from "@/types";

type FactureProps = {
  document: Document;
  client: Client;
};

export function Facture({ document, client }: FactureProps) {
  if (document.type !== "facture") {
    throw new Error("Le composant Facture attend un document de type facture.");
  }

  return <DocumentLayout document={document} client={client} />;
}
