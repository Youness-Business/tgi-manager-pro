import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { DocumentGenerator } from "@/components/documents/DocumentGenerator";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Nouveau document",
  description: "Créer une facture, un devis, un reçu ou un bon de livraison.",
};

export const instant = false;

export default function NewDocumentPage() {
  return (
    <div className="space-y-6 print:block">
      <div className="print:hidden">
        <PageHeader
          title="Nouveau document"
          description="Composez un document, vérifiez son aperçu, puis enregistrez-le."
          actions={
            <Link
              href="/documents"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <ArrowLeft size={17} aria-hidden="true" />
              Retour aux documents
            </Link>
          }
        />
      </div>
      <Suspense
        fallback={
          <div
            role="status"
            className="min-h-48 rounded-xl border border-gray-200 bg-white p-8 text-sm text-slate-600 shadow-sm print:hidden"
          >
            Préparation du générateur…
          </div>
        }
      >
        <DocumentGenerator />
      </Suspense>
    </div>
  );
}
