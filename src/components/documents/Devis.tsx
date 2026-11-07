import { DocumentLayout } from "./DocumentLayout";
import type { Client, Document } from "@/types";

type DevisProps = {
  document: Document;
  client: Client;
};

export function Devis({ document, client }: DevisProps) {
  if (document.type !== "devis") {
    throw new Error("Le composant Devis attend un document de type devis.");
  }

  return <DocumentLayout document={document} client={client} />;
}
