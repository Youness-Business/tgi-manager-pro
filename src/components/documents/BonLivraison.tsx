import { DocumentLayout } from "./DocumentLayout";
import type { Client, Document } from "@/types";

type BonLivraisonProps = {
  document: Document;
  client: Client;
};

export function BonLivraison({ document, client }: BonLivraisonProps) {
  if (document.type !== "bon_livraison") {
    throw new Error(
      "Le composant BonLivraison attend un document de type bon de livraison.",
    );
  }

  return <DocumentLayout document={document} client={client} />;
}
