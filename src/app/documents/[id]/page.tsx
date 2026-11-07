import { Suspense } from "react";
import type { Metadata } from "next";
import { DocumentDetails } from "@/components/documents/DocumentDetails";

export const metadata: Metadata = {
  title: "Document",
  description: "Détail et aperçu imprimable d’un document TGI Ascenseurs.",
};

type DocumentDetailsPageProps = {
  params: Promise<{ id: string }>;
};

export const instant = false;

async function DocumentDetailsContent({ params }: DocumentDetailsPageProps) {
  const { id } = await params;
  return <DocumentDetails id={id} />;
}

export default function DocumentDetailsPage(props: DocumentDetailsPageProps) {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          className="min-h-48 rounded-xl border border-gray-200 bg-white p-8 text-sm text-slate-600 shadow-sm print:hidden"
        >
          Chargement du document…
        </div>
      }
    >
      <DocumentDetailsContent {...props} />
    </Suspense>
  );
}
