import { FilePlus2 } from "lucide-react";
import { Suspense } from "react";
import { Link, useSearchParams } from "@/lib/router";
import { DocumentDirectory } from "@/components/documents/DocumentDirectory";
import { PageHeader } from "@/components/ui/PageHeader";

export default function DocumentsPage() {
  const params = useSearchParams();
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
          initialQuery={params.get("q") ?? ""}
          initialType={params.get("type") ?? ""}
          initialStatus={params.get("statut") ?? ""}
        />
      </div>
    </Suspense>
  );
}
