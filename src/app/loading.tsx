export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="space-y-5"
    >
      <span className="sr-only">Chargement de la page…</span>
      <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
      <div className="h-4 max-w-md animate-pulse rounded bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            aria-hidden="true"
            className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-card motion-reduce:animate-none"
          />
        ))}
      </div>
      <div
        aria-hidden="true"
        className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-card motion-reduce:animate-none"
      />
    </div>
  );
}
