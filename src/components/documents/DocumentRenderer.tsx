import { BonLivraison } from "./BonLivraison";
import { Devis } from "./Devis";
import { Facture } from "./Facture";
import { Recu } from "./Recu";
import type { Client, Document } from "@/types";

type DocumentRendererProps = {
  document: Document;
  client: Client;
};

export function DocumentRenderer({
  document,
  client,
}: DocumentRendererProps) {
  switch (document.type) {
    case "facture":
      return <Facture document={document} client={client} />;
    case "devis":
      return <Devis document={document} client={client} />;
    case "recu":
      return <Recu document={document} client={client} />;
    case "bon_livraison":
      return <BonLivraison document={document} client={client} />;
    default: {
      const exhaustiveCheck: never = document.type;
      return exhaustiveCheck;
    }
  }
}
