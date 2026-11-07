"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { DocumentRenderer } from "@/components/documents/DocumentRenderer";
import { useDocuments } from "@/context/DocumentsProvider";
import { useClients } from "@/context/FirestoreDataProvider";

export function DocumentDetails({ id }: { id: string }) {
  const { role } = useAuth();
  const { documents, loading, error } = useDocuments();
  const { items: clients, loading: clientsLoading, error: clientsError } = useClients();
  const document = documents.find((item) => item.id === id);
  const client = document
    ? clients.find((item) => item.id === document.clientId)
    : undefined;
  if ((!document || !client) && !loading && !clientsLoading && !error && !clientsError) {
    if (role === "commercial") {
      return (
        <section
          role="alert"
          className="mx-auto max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-center"
        >
          <h1 className="text-lg font-semibold text-slate-900">Accès refusé</h1>
          <p className="mt-2 text-sm text-slate-700">
            Ce document n’existe pas ou ne vous appartient pas.
          </p>
        </section>
      );
    }
    notFound();
  }
  if (!document || !client) {
    return (
      <p
        role={error || clientsError ? "alert" : "status"}
        className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-slate-700 shadow-sm print:hidden"
      >
        {error ?? clientsError ?? "Chargement du document…"}
      </p>
    );
  }

  return (
    <div className="space-y-5 print:space-y-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/documents"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          Retour aux documents
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <Printer size={17} aria-hidden="true" />
          Imprimer / Exporter PDF
        </button>
      </div>
      <div className="min-w-0 overflow-x-auto print:overflow-visible">
        <DocumentRenderer document={document} client={client} />
      </div>
    </div>
  );
}
