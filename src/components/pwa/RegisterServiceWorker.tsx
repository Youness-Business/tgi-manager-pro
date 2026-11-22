"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/primitives";

export function RegisterServiceWorker() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let active = true;
    const handleControllerChange = () => window.location.reload();

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((result) => {
        if (!active) return;
        setRegistration(result);
        if (result.waiting && navigator.serviceWorker.controller) setUpdateReady(true);
        result.addEventListener("updatefound", () => {
          const worker = result.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (
              active &&
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            ) setUpdateReady(true);
            if (active && worker.state === "redundant") {
              setError("Le service worker n’a pas pu être installé. Vérifiez la connexion et les ressources PWA.");
            }
          });
        });
      })
      .catch((registrationError: unknown) => {
        if (!active) return;
        setError(
          registrationError instanceof Error
            ? registrationError.message
            : "Le service worker n’a pas pu être enregistré.",
        );
      });

    return () => {
      active = false;
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  function activateUpdate() {
    if (!registration?.waiting) return;
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  }

  if (error) return <p role="status" className="fixed bottom-4 right-4 z-[100] max-w-sm rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 shadow-card print:hidden">Mode hors ligne indisponible : {error}</p>;
  if (!updateReady) return null;
  return (
    <div role="status" className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-[100] mx-auto flex max-w-lg flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-floating print:hidden">
      <p className="text-sm font-medium text-slate-800">Une nouvelle version est disponible.</p>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" onClick={activateUpdate}><RefreshCw size={15} aria-hidden="true" /> Actualiser</Button>
        <button type="button" aria-label="Masquer l’avis de mise à jour" onClick={() => setUpdateReady(false)} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"><X size={16} aria-hidden="true" /></button>
      </div>
    </div>
  );
}
