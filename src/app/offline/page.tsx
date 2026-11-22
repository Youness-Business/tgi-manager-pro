import Link from "@/lib/router";
import { WifiOff } from "lucide-react";
import { OfflineRetryButton } from "@/components/pwa/OfflineRetryButton";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-card sm:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
          <WifiOff size={28} aria-hidden="true" />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">TGI Ascenseurs</p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-950">Connexion indisponible</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Cette page ne peut pas être chargée hors ligne. Vérifiez votre connexion, puis réessayez.
          Les données financières et les modifications ne sont pas stockées hors ligne.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <OfflineRetryButton />
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Retour à la connexion
          </Link>
        </div>
      </section>
    </main>
  );
}
