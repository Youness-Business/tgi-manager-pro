"use client";

import {
  Building2,
  FileText,
  Gauge,
  Wrench,
  LogOut,
  Package,
  Building,
  Boxes,
  PanelLeftClose,
  PanelLeftOpen,
  UsersRound,
  Banknote,
} from "lucide-react";
import Link from "@/lib/router";
import { usePathname } from "@/lib/router";
import { useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useArticles } from "@/context/FirestoreDataProvider";
import { getStockStatut } from "@/lib/stock";
import {
  can,
  roleLabel,
  type PermissionResource,
} from "@/lib/permissions";

const navigation: readonly {
  section: string;
  href: string;
  label: string;
  icon: typeof Gauge;
  resource: PermissionResource;
}[] = [
  { section: "PILOTAGE", href: "/dashboard", label: "Dashboard", icon: Gauge, resource: "dashboard" },
  { section: "COMMERCIAL", href: "/clients", label: "Clients", icon: UsersRound, resource: "clients" },
  { section: "COMMERCIAL", href: "/catalogue", label: "Catalogue", icon: Package, resource: "catalogue" },
  { section: "COMMERCIAL", href: "/documents", label: "Documents", icon: FileText, resource: "documents" },
  { section: "TECHNIQUE", href: "/contrats", label: "Contrats", icon: FileText, resource: "contracts" },
  { section: "TECHNIQUE", href: "/parc", label: "Parc d’ascenseurs", icon: Building, resource: "elevators" },
  { section: "TECHNIQUE", href: "/interventions", label: "Interventions", icon: Wrench, resource: "interventions" },
  { section: "TECHNIQUE", href: "/stock", label: "Stock", icon: Boxes, resource: "stock" },
  { section: "FINANCE", href: "/recouvrement", label: "Recouvrement", icon: Banknote, resource: "collections" },
  { section: "CONFIGURATION", href: "/parametres", label: "Paramètres", icon: Building2, resource: "company" },
];

type SidebarProps = {
  variant?: "desktop" | "drawer";
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

export function Sidebar({
  variant = "desktop",
  onNavigate,
  collapsed = false,
  onToggleCollapsed,
}: SidebarProps) {
  const pathname = usePathname();
  const isDrawer = variant === "drawer";
  const { user, profile, role, signOut } = useAuth();
  const { items: articles } = useArticles();
  const lowStockCount = articles.filter(
    (article) =>
      article.type === "produit" && getStockStatut(article) !== "ok",
  ).length;
  const [signOutError, setSignOutError] = useState<string | null>(null);

  return (
    <aside
      aria-label="Navigation principale"
      className={`${
        isDrawer
          ? "flex h-full w-[min(18rem,calc(100vw-3rem))] flex-col bg-brand-950 text-slate-200"
          : `fixed inset-y-0 left-0 z-30 hidden ${collapsed ? "w-[5.25rem]" : "w-64"} flex-col bg-brand-950 text-slate-200 transition-[width] duration-200 md:flex motion-reduce:transition-none`
      } print:hidden`}
    >
      <Link
        href="/dashboard"
        onClick={onNavigate}
        title={collapsed && !isDrawer ? "TGI Ascenseurs" : undefined}
        className={`flex min-h-20 items-center border-b border-white/10 text-white focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-blue-400 ${collapsed && !isDrawer ? "justify-center px-3" : "gap-3 px-6"}`}
      >
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-blue-700 text-lg font-extrabold shadow-lg shadow-blue-950/30"
        >
          T
        </span>
        {!collapsed || isDrawer ? <span className="min-w-0">
          <span className="block font-bold tracking-wide">TGI ASCENSEURS</span>
          <span className="mt-0.5 block text-xs text-slate-300">
            Gestion interne
          </span>
        </span> : null}
      </Link>

      <nav aria-label="Menu" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-6">
        {navigation
          .filter(({ resource }) =>
            resource === "company"
              ? can(role, "manageCompany", "company")
              : can(role, "read", resource),
          )
          .map(({ href, label, icon: Icon, section }, index, filtered) => {
          const active =
            pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
          const showSection = index === 0 || filtered[index - 1].section !== section;

          return (
            <div key={href} className={showSection ? (index ? "pt-2" : "") : ""}>
              {showSection && (!collapsed || isDrawer) ? (
                <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.16em] text-slate-500">
                  {section}
                </p>
              ) : null}
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                title={collapsed && !isDrawer ? label : undefined}
                className={`relative flex min-h-11 items-center rounded-xl text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${collapsed && !isDrawer ? "justify-center px-2" : "gap-3 px-3"} ${
                  active
                    ? "bg-blue-500/15 text-white before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-blue-400"
                    : "text-slate-300 hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                <Icon size={19} aria-hidden="true" className="shrink-0" />
                {!collapsed || isDrawer ? (
                  <>
                    <span className="min-w-0 flex-1">{label}</span>
                    {href === "/stock" && lowStockCount ? (
                      <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold leading-none text-slate-950">
                        {lowStockCount}
                      </span>
                    ) : null}
                  </>
                ) : href === "/stock" && lowStockCount ? (
                  <span
                    aria-label={`${lowStockCount} articles à réapprovisionner`}
                    className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-brand-950"
                  />
                ) : null}
              </Link>
            </div>
          );
          })}
      </nav>
      {!isDrawer && onToggleCollapsed ? (
        <button
          type="button"
          aria-label={collapsed ? "Déplier la navigation" : "Replier la navigation"}
          aria-expanded={!collapsed}
          onClick={onToggleCollapsed}
          className="mx-3 mb-3 hidden min-h-10 items-center justify-center gap-2 rounded-lg text-xs font-medium text-slate-400 hover:bg-white/[0.07] hover:text-white focus-visible:outline-2 focus-visible:outline-blue-400 md:flex"
        >
          {collapsed ? <PanelLeftOpen size={17} /> : <><PanelLeftClose size={17} /> Réduire le menu</>}
        </button>
      ) : null}
      {user && profile && role ? (
        <div className="mt-auto border-t border-white/10 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-label={user.displayName ?? profile.nom}
              className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-600 bg-cover bg-center text-sm font-bold text-white"
              style={
                user.photoURL
                  ? { backgroundImage: `url("${user.photoURL}")` }
                  : undefined
              }
            >
              {user.photoURL ? (
                <span className="sr-only">{profile.nom}</span>
              ) : (
                profile.nom.slice(0, 1).toLocaleUpperCase("fr")
              )}
            </span>
            {!collapsed || isDrawer ? (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-white">
                  {profile.nom}
                </span>
                <span className="block truncate text-xs text-slate-300">
                  {roleLabel(role)}
                </span>
              </span>
            ) : null}
          </div>
          {signOutError ? (
            <p role="alert" className="mt-2 text-xs leading-5 text-red-300">
              {signOutError}
            </p>
          ) : null}
          <button
            type="button"
            aria-label="Se déconnecter"
            onClick={async () => {
              setSignOutError(null);
              try {
                await signOut();
              } catch (error) {
                setSignOutError(
                  error instanceof Error
                    ? error.message
                    : "La déconnexion a échoué.",
                );
              }
            }}
            title={collapsed && !isDrawer ? "Se déconnecter" : undefined}
            className={`mt-4 inline-flex min-h-10 w-full items-center rounded-lg text-left text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${collapsed && !isDrawer ? "justify-center" : "gap-2 px-3"}`}
          >
            <LogOut aria-hidden="true" size={17} />
            {!collapsed || isDrawer ? "Se déconnecter" : null}
          </button>
        </div>
      ) : null}
    </aside>
  );
}
