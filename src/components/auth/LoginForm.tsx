"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  FileStack,
  Gauge,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/context/AuthProvider";

export function LoginForm() {
  const {
    signIn,
    signOut,
    user,
    status,
    error: authError,
    errorCode,
    attemptedEmail,
    clearError,
  } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [switchError, setSwitchError] = useState("");

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSigningIn(true);
    clearError();
    try {
      await signIn();
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleSwitchAccount() {
    clearError();
    setSwitchError("");
    if (!user) {
      setIsSigningIn(true);
      try {
        await signIn();
      } finally {
        setIsSigningIn(false);
      }
      return;
    }
    try {
      await signOut();
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : "La déconnexion a échoué.");
    }
  }

  const nextPath = searchParams.get("next");
  const safeNextPath =
    nextPath?.startsWith("/") && !nextPath.startsWith("//")
      ? nextPath
      : "/";

  useEffect(() => {
    if (status === "ready") router.replace(safeNextPath);
  }, [router, safeNextPath, status]);

  return (
    <main className="grid min-h-screen min-w-0 bg-white lg:grid-cols-[minmax(0,1.05fr)_minmax(26rem,0.95fr)]">
      <section className="relative hidden min-h-screen min-w-0 overflow-hidden bg-brand-950 px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div aria-hidden="true" className="absolute -right-36 -top-32 h-[34rem] w-[34rem] rounded-full border border-blue-300/10" />
        <div aria-hidden="true" className="absolute -right-12 -top-8 h-[25rem] w-[25rem] rounded-full border border-blue-300/10" />
        <div className="relative z-10 flex items-center gap-3">
          <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-400 to-blue-700 text-xl font-extrabold shadow-lg shadow-blue-950/50">T</span>
          <div>
            <p className="font-bold tracking-wide">TGI ASCENSEURS</p>
            <p className="mt-0.5 text-xs text-slate-400">Plateforme de gestion</p>
          </div>
        </div>
        <div className="relative z-10 max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">Une gestion plus fluide</p>
          <h1 className="mt-5 font-display text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
            Pilotez votre activité, <span className="text-blue-300">en toute clarté.</span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
            Retrouvez vos clients, votre catalogue et vos documents dans un espace unique, pensé pour les équipes TGI.
          </p>
          <ul className="mt-10 space-y-4">
            {[
              { icon: Gauge, title: "Vue d’ensemble", detail: "Les indicateurs essentiels à portée de main." },
              { icon: FileStack, title: "Documents fiables", detail: "Devis et factures prêts à être imprimés." },
              { icon: ShieldCheck, title: "Accès sécurisé", detail: "Un espace adapté à votre rôle dans l’équipe." },
            ].map(({ icon: Icon, title, detail }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-blue-300"><Icon size={18} aria-hidden="true" /></span>
                <span><span className="block text-sm font-semibold text-white">{title}</span><span className="mt-1 block text-sm text-slate-400">{detail}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-xs text-slate-500">TGI Ascenseurs · Espace interne sécurisé</p>
      </section>

      <section className="flex min-h-screen min-w-0 flex-col items-center justify-center bg-slate-50 px-5 py-10 sm:px-8">
        <div className="w-full min-w-0 max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-lg font-extrabold text-white">T</span>
            <div>
              <p className="font-bold tracking-wide text-slate-900">TGI ASCENSEURS</p>
              <p className="text-xs text-slate-500">Espace de gestion sécurisé</p>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-9">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <ShieldCheck aria-hidden="true" size={22} />
            </div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Bienvenue</p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-950">
              Connexion à votre espace
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Connectez-vous avec votre compte Google professionnel autorisé.
            </p>

            <form onSubmit={handleSignIn} className="mt-8 space-y-4">
              {status === "unauthorized" ? (
                <div role="alert" className="space-y-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
                  <p className="font-semibold">{authError ?? "Accès non autorisé"}</p>
                  <p>Compte utilisé : <span className="break-all font-medium">{attemptedEmail ?? "Adresse indisponible"}</span></p>
                  <button type="button" onClick={handleSwitchAccount} className="min-h-9 rounded-lg px-2 font-semibold text-red-800 underline underline-offset-2 hover:text-red-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">
                    Changer de compte
                  </button>
                </div>
              ) : authError ? (
                <p role="alert" className="flex min-w-0 gap-2 break-words rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800 [overflow-wrap:anywhere]">
                  <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0" size={17} />
                  <span className="min-w-0 [overflow-wrap:anywhere]">{authError}</span>
                </p>
              ) : null}
              {switchError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{switchError}</p> : null}
              <input type="hidden" name="next" value={safeNextPath} />
              <button
                type="submit"
                disabled={isSigningIn || status === "loading"}
                className="group flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition duration-150 hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-70 motion-reduce:transition-none"
              >
                {isSigningIn || status === "loading" ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" size={19} />
                ) : <GoogleMark />}
                {isSigningIn || status === "loading" ? "Connexion en cours…" : "Continuer avec Google"}
                {!isSigningIn && status !== "loading" ? <ArrowRight aria-hidden="true" size={17} className="ml-auto transition-transform group-hover:translate-x-0.5" /> : null}
              </button>
              <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-xs leading-5 text-slate-500">
                <CheckCircle2 size={14} aria-hidden="true" className="text-emerald-700" />
                Accès réservé aux comptes autorisés par TGI.
              </p>
            </form>
          </div>
          {process.env.NODE_ENV !== "production" ? (
            <details className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
              <summary className="cursor-pointer font-semibold text-slate-700">Diagnostic Firebase</summary>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt>État</dt><dd className="font-mono">{status}</dd>
                <dt>Code Firebase</dt><dd className="break-all font-mono">{errorCode ?? "—"}</dd>
              </dl>
            </details>
          ) : null}
          <p className="mt-5 text-center text-xs text-slate-500">Connexion sécurisée par Google</p>
        </div>
      </section>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5 shrink-0">
      <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11c-.5 2.5-2 4.7-4.2 6.1v5h6.8c4-3.7 6-9 6-14.8Z" />
      <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.8-5c-1.9 1.3-4.2 2-6.7 2-5.2 0-9.6-3.5-11.2-8.2H5.8v5.1C9.2 39.6 16 44 24 44Z" />
      <path fill="#FBBC05" d="M12.8 28c-.4-1.2-.7-2.6-.7-4s.3-2.8.7-4v-5.1H5.8C4.4 17.7 3.5 20.7 3.5 24s.9 6.3 2.3 9.1l7-5.1Z" />
      <path fill="#EA4335" d="M24 11.8c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 5.8 29.5 4 24 4 16 4 9.2 8.4 5.8 14.9l7 5.1c1.6-4.7 6-8.2 11.2-8.2Z" />
    </svg>
  );
}