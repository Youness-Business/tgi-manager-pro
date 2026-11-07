import { FilePlus2 } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { DocumentDirectory } from "@/components/documents/DocumentDirectory";
import { PageHeader } from "@/components/ui/PageHeader";
import { firstSearchParam } from "@/lib/searchParams";

export const metadata: Metadata = {
  title: "Documents",
  description: "Factures, devis, reçus et bons de livraison de TGI Ascenseurs.",
};

type DocumentsPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    type?: string | string[];
    statut?: string | string[];
  }>;
};

export const instant = false;

async function DocumentsContent({ searchParams }: DocumentsPageProps) {
  const params = await searchParams;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Consultez et filtrez vos factures, devis, reçus et bons de livraison."
        actions={
          <Link
            href="/documents/nouveau"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <FilePlus2 size={17} aria-hidden="true" />
            Nouveau document
          </Link>
        }
      />
      <DocumentDirectory
        initialQuery={firstSearchParam(params.q)}
        initialType={firstSearchParam(params.type)}
        initialStatus={firstSearchParam(params.statut)}
      />
    </div>
  );
}

export default function DocumentsPage(props: DocumentsPageProps) {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          className="min-h-48 rounded-xl border border-gray-200 bg-white p-8 text-sm text-slate-600 shadow-sm"
        >
          Chargement des documents…
        </div>
      }
    >
      <DocumentsContent {...props} />
    </Suspense>
  );
}
