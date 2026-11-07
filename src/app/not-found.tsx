import Link from "next/link";
import { FileQuestion } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page introuvable",
  description: "La page demandée n’existe pas ou n’est plus disponible.",
};

export default function NotFound() {
  return (
    <section
      aria-labelledby="not-found-title"
      className="flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-card"
    >
      <span
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"
      >
        <FileQuestion size={26} />
      </span>
      <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-blue-700">
        Erreur 404
      </p>
      <h1 id="not-found-title" className="mt-2 font-display text-2xl font-bold text-slate-900">
        Cette page est introuvable
      </h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
        La page ou le document demandé n’existe pas, ou n’est plus disponible.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        Retour au dashboard
      </Link>
    </section>
  );
}
