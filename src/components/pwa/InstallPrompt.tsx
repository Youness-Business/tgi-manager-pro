"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type InstallPlatform = "standalone" | "ios" | "other";

function getInstallPlatform(): InstallPlatform {
  if (typeof window === "undefined") return "other";
  if (window.matchMedia("(display-mode: standalone)").matches) return "standalone";
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ? "ios" : "other";
}

function subscribeInstallPlatform(onChange: () => void): () => void {
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", onChange);
  window.addEventListener("appinstalled", onChange);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener("appinstalled", onChange);
  };
}

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [error, setError] = useState("");
  const platform = useSyncExternalStore(
    subscribeInstallPlatform,
    getInstallPlatform,
    () => "other",
  );

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function install() {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setInstallEvent(null);
      setError("");
    } catch (installError) {
      setError(installError instanceof Error ? installError.message : "Installation impossible.");
    }
  }

  const isIos = platform === "ios";
  if (installed || platform === "standalone" || (!installEvent && !isIos)) return null;

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-40 print:hidden">
      {error ? <p role="alert" className="mb-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-800">{error}</p> : null}
      {installEvent ? (
        <button
          type="button"
          onClick={() => void install()}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-950 px-4 text-sm font-semibold text-white shadow-elevated hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <Download size={16} aria-hidden="true" />
          Installer l’application
        </button>
      ) : (
        <details className="max-w-xs rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-card">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold focus-visible:outline-2 focus-visible:outline-blue-600">
            <Share size={16} aria-hidden="true" />
            Installer sur iPhone/iPad
          </summary>
          <p className="mt-2 leading-5">
            Dans Safari, touchez <strong>Partager</strong>, puis <strong>Sur l’écran d’accueil</strong>.
          </p>
        </details>
      )}
    </div>
  );
}
