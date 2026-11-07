"use client";

import {
  ArrowUpRight,
  ChevronDown,
  Command,
  FilePlus2,
  FileText,
  Package,
  Search,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useAuth } from "@/context/AuthProvider";
import { useDocuments } from "@/context/DocumentsProvider";
import { useArticles, useClients } from "@/context/FirestoreDataProvider";
import { useAscenseurs, useContrats } from "@/context/OperationsDataProvider";
import { roleLabel } from "@/lib/permissions";
import { normalizeSearch } from "@/lib/normalizeSearch";

type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  kind: "Client" | "Article" | "Document" | "Contrat" | "Ascenseur";
};

const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/clients": "Clients",
  "/catalogue": "Catalogue",
  "/documents": "Documents",
  "/contrats": "Contrats",
  "/parc": "Parc d’ascenseurs",
  "/interventions": "Interventions",
  "/stock": "Stock",
  "/recouvrement": "Recouvrement",
  "/parametres": "Paramètres",
};

export function AppTopbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, role, signOut } = useAuth();
  const { items: clients } = useClients();
  const { items: articles } = useArticles();
  const { documents } = useDocuments();
  const { items: contrats } = useContrats();
  const { items: ascenseurs } = useAscenseurs();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const newMenuButtonRef = useRef<HTMLButtonElement>(null);
  const userMenuButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const results = useMemo<SearchResult[]>(() => {
    const needle = normalizeSearch(query);
    const matches = [
      ...clients.map((client): SearchResult => ({
        id: `client-${client.id}`,
        title: client.nom,
        subtitle: `Client · ${client.adresse}`,
        href: `/clients/${client.id}`,
        kind: "Client",
      })),
      ...articles.map((article): SearchResult => ({
        id: `article-${article.id}`,
        title: article.designation,
        subtitle:
          article.type === "produit"
            ? `Article · ${article.reference} · Stock ${article.stockQte ?? 0}`
            : `Service · ${article.reference}`,
        href: article.type === "produit" ? `/stock/${article.id}` : "/catalogue",
        kind: "Article",
      })),
      ...documents.map((document): SearchResult => ({
        id: `document-${document.id}`,
        title: document.numero,
        subtitle: `Document · ${document.type.replace("_", " ")}`,
        href: `/documents/${document.id}`,
        kind: "Document",
      })),
      ...documents
        .filter((document) => document.type === "facture" && document.statut !== "annule")
        .map((document): SearchResult => ({
          id: `receivable-${document.id}`,
          title: document.numero,
          subtitle: `Créance · ${clients.find((client) => client.id === document.clientId)?.nom ?? "Client"}`,
          href: `/recouvrement/creances?q=${encodeURIComponent(document.numero)}`,
          kind: "Document",
        })),
      ...contrats.map((contract): SearchResult => ({
        id: `contract-${contract.id}`,
        title: contract.numero,
        subtitle: `Contrat · ${clients.find((client) => client.id === contract.clientId)?.nom ?? "Client"}`,
        href: `/contrats/${contract.id}`,
        kind: "Contrat",
      })),
      ...ascenseurs.map((elevator): SearchResult => ({
        id: `elevator-${elevator.id}`,
        title: `${elevator.marque} ${elevator.modele}`,
        subtitle: `Ascenseur · ${elevator.numeroSerie} · ${elevator.site}`,
        href: `/parc/${elevator.id}`,
        kind: "Ascenseur",
      })),
    ];
    return matches
      .filter((result) =>
        !needle
          ? true
          : normalizeSearch(`${result.title} ${result.subtitle}`).includes(needle),
      )
      .slice(0, 8);
  }, [articles, ascenseurs, clients, contrats, documents, query]);

  const openPalette = useCallback(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPaletteOpen(true);
    setQuery("");
    setActiveIndex(0);
  }, []);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openPalette();
      }
      if (event.key === "Escape") {
        setPaletteOpen(false);
        if (newMenuOpen) newMenuButtonRef.current?.focus();
        if (userMenuOpen) userMenuButtonRef.current?.focus();
        setNewMenuOpen(false);
        setUserMenuOpen(false);
      }
    }
    function handleOpenSearch() {
      openPalette();
    }
    window.addEventListener("keydown", handleShortcut);
    window.addEventListener("tgi-open-search", handleOpenSearch);
    return () => {
      window.removeEventListener("keydown", handleShortcut);
      window.removeEventListener("tgi-open-search", handleOpenSearch);
    };
  }, [newMenuOpen, openPalette, userMenuOpen]);

  useEffect(() => {
    if (!paletteOpen) {
      previousFocusRef.current?.focus();
      return;
    }
    inputRef.current?.focus();
    function trapFocus(event: KeyboardEvent) {
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'input:not([disabled]), button:not([disabled]), a[href]',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", trapFocus);
    return () => document.removeEventListener("keydown", trapFocus);
  }, [paletteOpen]);

  function navigateToResult(result: SearchResult) {
    setPaletteOpen(false);
    router.push(result.href);
  }

  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && results.length) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp" && results.length) {
      event.preventDefault();
      setActiveIndex((index) => (index + results.length - 1) % results.length);
    } else if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      navigateToResult(results[activeIndex]);
    }
  }

  const currentTitle =
    Object.entries(routeTitles).find(
      ([path]) => pathname === path || pathname.startsWith(`${path}/`),
    )?.[1] ?? "TGI Ascenseurs";

  return (
    <>
      <header className="sticky top-0 z-20 hidden h-[4.5rem] items-center justify-between border-b border-slate-200/80 bg-white/90 px-6 backdrop-blur-xl md:flex xl:px-8 print:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <nav aria-label="Fil d’Ariane" className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">TGI</span>
            <span aria-hidden="true" className="text-slate-300">/</span>
            <span className="truncate font-semibold text-slate-900">{currentTitle}</span>
          </nav>
          <button
            type="button"
            onClick={openPalette}
            className="ml-4 inline-flex h-9 min-w-48 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-left text-xs text-slate-500 transition hover:border-slate-300 hover:bg-white focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <Search size={15} aria-hidden="true" />
            <span className="flex-1">Rechercher partout…</span>
            <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-[10px] text-slate-500">
              Ctrl K
            </kbd>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              ref={newMenuButtonRef}
              type="button"
              aria-haspopup="menu"
              aria-expanded={newMenuOpen}
              onClick={() => {
                setNewMenuOpen((open) => !open);
                setUserMenuOpen(false);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <FilePlus2 size={17} aria-hidden="true" />
              Nouveau
              <ChevronDown size={15} aria-hidden="true" />
            </button>
            {newMenuOpen ? (
              <div role="menu" className="absolute right-0 top-12 z-30 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                {["facture", "devis", "recu", "bon_livraison"].map((type) => (
                  <Link
                    key={type}
                    role="menuitem"
                    href={`/documents/nouveau?type=${type}`}
                    onClick={() => setNewMenuOpen(false)}
                    className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
                  >
                    <FileText size={16} aria-hidden="true" />
                    {type === "recu" ? "Nouveau reçu" : type === "bon_livraison" ? "Bon de livraison" : `Nouveau ${type}`}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          <div className="relative">
            <button
              ref={userMenuButtonRef}
              type="button"
              aria-label="Ouvrir le menu utilisateur"
              aria-expanded={userMenuOpen}
              onClick={() => {
                setUserMenuOpen((open) => !open);
                setNewMenuOpen(false);
              }}
              className="ml-1 inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-blue-50 text-sm font-bold text-blue-800 hover:ring-2 hover:ring-blue-100 focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              {user?.photoURL ? (
                <span aria-hidden="true" className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url("${user.photoURL}")` }} />
              ) : (
                (profile?.nom ?? "T").slice(0, 1)
              )}
            </button>
            {userMenuOpen ? (
              <div className="absolute right-0 top-12 z-30 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                <p className="truncate text-sm font-semibold text-slate-900">{profile?.nom}</p>
                <p className="truncate text-xs text-slate-500">{role ? roleLabel(role) : ""}</p>
                {signOutError ? <p role="alert" className="mt-2 text-xs text-red-700">{signOutError}</p> : null}
                <button
                  type="button"
                  onClick={async () => {
                    setSignOutError("");
                    try {
                      await signOut();
                    } catch (error) {
                      setSignOutError(error instanceof Error ? error.message : "La déconnexion a échoué.");
                    }
                  }}
                  className="mt-3 flex min-h-10 w-full items-center justify-between rounded-lg px-2 text-left text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  Se déconnecter <ArrowUpRight size={15} aria-hidden="true" />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {paletteOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-950/45 px-3 pt-[12vh] backdrop-blur-sm sm:px-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPaletteOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Recherche globale"
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/60 bg-white shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 px-4">
              <Search size={19} className="shrink-0 text-slate-400" aria-hidden="true" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleSearchKeyDown}
                aria-label="Rechercher clients, articles et documents"
                placeholder="Rechercher clients, articles et documents…"
                className="h-14 min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-slate-400 focus-visible:outline-none"
              />
              <button type="button" onClick={() => setPaletteOpen(false)} aria-label="Fermer la recherche" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600">
                <X size={17} aria-hidden="true" />
              </button>
              <kbd className="hidden rounded border border-slate-200 px-1.5 py-1 text-[10px] text-slate-500 sm:block">ESC</kbd>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-2">
              {results.length ? (
                <div role="listbox" aria-label="Résultats de recherche">
                  {results.map((result, index) => {
                    const Icon = result.kind === "Client" ? UsersRound : result.kind === "Article" || result.kind === "Ascenseur" ? Package : FileText;
                    return (
                      <button
                        key={result.id}
                        type="button"
                        role="option"
                        aria-selected={activeIndex === index}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => navigateToResult(result)}
                        className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left ${activeIndex === index ? "bg-blue-50" : "hover:bg-slate-50"}`}
                      >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm"><Icon size={17} aria-hidden="true" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-slate-900">{result.title}</span>
                            <span className="block truncate text-xs text-slate-500">{result.subtitle}</span>
                          </span>
                          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{result.kind}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="px-4 py-10 text-center text-sm text-slate-500">Aucun résultat pour cette recherche.</p>
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-500">
              <Command size={13} aria-hidden="true" /> Naviguer avec ↑ ↓ <span className="mx-1">·</span> Ouvrir avec Entrée
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
