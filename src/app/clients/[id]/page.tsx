import { Suspense } from "react";
import type { Metadata } from "next";
import { ClientDetailsView } from "@/components/clients/ClientDetailsView";

type ClientDetailsPageProps = {
  params: Promise<{ id: string }>;
};

export const instant = false;
export const metadata: Metadata = {
  title: "Fiche client",
  description: "Coordonnées et historique des documents du client.",
};

async function ClientDetailsContent({ params }: ClientDetailsPageProps) {
  const { id } = await params;
  return <ClientDetailsView id={id} />;
}

export default function ClientDetailsPage(props: ClientDetailsPageProps) {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          className="min-h-48 rounded-xl border border-gray-200 bg-white p-8 text-sm text-slate-600 shadow-sm"
        >
          Chargement de la fiche client…
        </div>
      }
    >
      <ClientDetailsContent {...props} />
    </Suspense>
  );
}
