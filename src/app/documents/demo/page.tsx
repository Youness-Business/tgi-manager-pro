import Link from "@/lib/router";
import { Facture } from "@/components/documents/Facture";
import type { Client, Document } from "@/types";


const client: Client = {
  id: "client-demo",
  nom: "Résidence Les Dunes",
  adresse: "Avenue des FAR, quartier administratif, Agadir 80000, Maroc",
  telephone: "+212 6 12 34 56 78",
  ice: "002345678000012",
};

const facture: Document = {
  id: "facture-demo",
  type: "facture",
  numero: "FAC-2026-0001",
  clientId: client.id,
  dateCreation: "2026-03-15",
  statut: "en_attente",
  lignes: [
    {
      articleId: "mot-gl-001",
      designation: "Moteur Gearless 8 personnes, fourniture et installation",
      qte: 1,
      prixUnitaireHT: 48500,
    },
    {
      articleId: "cab-008",
      designation: "Câble de traction 8 mm",
      qte: 48,
      prixUnitaireHT: 185,
    },
    {
      articleId: "ser-maint-01",
      designation: "Mise en service et réglage de l'installation",
      qte: 1,
      prixUnitaireHT: 6200,
    },
  ],
};

export default function DemoDocumentPage() {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto mb-4 flex w-full max-w-[210mm] items-center justify-between gap-4 print:hidden">
        <Link
          href="/"
          className="text-sm font-medium text-blue-700 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          ← Retour à l’accueil
        </Link>
        <span className="text-sm text-slate-600">Aperçu de démonstration</span>
      </div>
      <Facture document={facture} client={client} />
    </div>
  );
}
