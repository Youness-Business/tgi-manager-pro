import { Suspense } from "react";
import { DocumentDetails } from "@/components/documents/DocumentDetails";
import { useParams } from "@/lib/router";

export default function DocumentDetailsPage() {
  const { id = "" } = useParams<{ id: string }>();
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
      <DocumentDetails id={id} />
    </Suspense>
  );
}
