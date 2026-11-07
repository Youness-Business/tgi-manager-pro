"use client";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <section
      role="alert"
      aria-labelledby="error-title"
      className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-card"
    >
      <p className="text-sm font-semibold uppercase tracking-wide text-red-700">
        Une erreur est survenue
      </p>
      <h1 id="error-title" className="mt-2 font-display text-2xl font-bold text-slate-900">
        Impossible d’afficher cette page
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Réessayez. Si le problème persiste, contactez l’administrateur de
        l’application.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        Réessayer
      </button>
    </section>
  );
}
