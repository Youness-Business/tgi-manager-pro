"use client";

import { Menu, Search, X } from "lucide-react";
import Link from "@/lib/router";
import { Suspense } from "react";
import { useEffect, useRef, useState } from "react";
import { Sidebar } from "./Sidebar";

export function MobileTopbar() {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current
      ?.querySelector<HTMLElement>("a[href], button:not([disabled])")
      ?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        return;
      }

      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
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

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      if (document.activeElement instanceof HTMLElement) {
        trigger?.focus();
      }
    };
  }, [isOpen]);

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 md:hidden print:hidden">
      <Link
        href="/dashboard"
        className="flex items-center gap-2 font-bold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        <span
          aria-hidden="true"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white"
        >
          T
        </span>
        <span>TGI ASCENSEURS</span>
      </Link>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Rechercher dans l’application"
          onClick={() => window.dispatchEvent(new Event("tgi-open-search"))}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <Search aria-hidden="true" size={20} />
        </button>
        <button
          ref={triggerRef}
          type="button"
          aria-label={isOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={isOpen}
          aria-controls={isOpen ? "mobile-navigation" : undefined}
          onClick={() => setIsOpen((open) => !open)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          {isOpen ? (
            <X aria-hidden="true" size={22} />
          ) : (
            <Menu aria-hidden="true" size={22} />
          )}
        </button>
      </div>
      {isOpen ? (
        <div
          id="mobile-navigation"
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navigation"
          className="fixed inset-0 top-16 z-40 flex bg-slate-950/50 print:hidden"
          onClick={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <div>
            <Suspense
              fallback={
                <aside
                  aria-hidden="true"
                  className="h-full w-[min(18rem,calc(100vw-3rem))] bg-brand-950"
                />
              }
            >
              <Sidebar
                variant="drawer"
                onNavigate={() => setIsOpen(false)}
              />
            </Suspense>
          </div>
          <button
            type="button"
            aria-label="Fermer le menu de navigation"
            onClick={() => setIsOpen(false)}
            className="min-w-0 flex-1 cursor-default focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-white"
          />
        </div>
      ) : null}
    </header>
  );
}
