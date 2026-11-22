"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "@/lib/router";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { MobileTopbar } from "@/components/layout/MobileTopbar";
import { Sidebar } from "@/components/layout/Sidebar";
import type { PermissionAction, PermissionResource } from "@/lib/permissions";
import { AuthProvider } from "@/context/AuthProvider";
import { FirestoreDataProvider } from "@/context/FirestoreDataProvider";
import { DocumentsProvider } from "@/context/DocumentsProvider";
import { CompanySettingsProvider } from "@/context/CompanySettingsProvider";
import { StockDataProvider } from "@/context/StockDataProvider";
import { RecouvrementDataProvider } from "@/context/RecouvrementDataProvider";
import { OfflineBanner } from "@/components/pwa/OfflineBanner";
import { AppTopbar } from "@/components/layout/AppTopbar";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

function routeAccess(pathname: string): {
  action: PermissionAction;
  resource: PermissionResource;
} {
  if (pathname.startsWith("/parametres")) {
    return { action: "manageCompany", resource: "company" };
  }
  if (pathname.startsWith("/documents/nouveau")) {
    return { action: "create", resource: "documents" };
  }
  if (pathname.startsWith("/contrats/nouveau")) {
    return { action: "create", resource: "contracts" };
  }
  if (pathname.startsWith("/parc/nouveau")) {
    return { action: "create", resource: "elevators" };
  }
  if (pathname.includes("/modifier")) return { action: "update", resource: "elevators" };
  if (pathname.startsWith("/interventions/nouveau")) {
    return { action: "create", resource: "interventions" };
  }
  if (pathname.startsWith("/stock/inventaire")) {
    return { action: "create", resource: "stock" };
  }
  if (pathname.startsWith("/stock")) {
    return { action: "read", resource: "stock" };
  }
  if (pathname.startsWith("/recouvrement")) {
    return { action: "read", resource: "collections" };
  }
  if (pathname.startsWith("/contrats")) return { action: "read", resource: "contracts" };
  if (pathname.startsWith("/parc")) return { action: "read", resource: "elevators" };
  if (pathname.startsWith("/interventions")) return { action: "read", resource: "interventions" };
  if (pathname.startsWith("/clients")) return { action: "read", resource: "clients" };
  if (pathname.startsWith("/catalogue")) {
    return { action: "read", resource: "catalogue" };
  }
  if (pathname.startsWith("/documents")) {
    return { action: "read", resource: "documents" };
  }
  return { action: "read", resource: "dashboard" };
}

export function ClientApplication({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const isOfflinePage = pathname === "/offline";
  const sidebarCollapsed = useSyncExternalStore(
    subscribeSidebarPreference,
    getSidebarPreference,
    () => false,
  );

  function toggleSidebar() {
    const next = !getSidebarPreference();
    window.localStorage.setItem("tgi-sidebar-collapsed", String(next));
    window.dispatchEvent(new Event("tgi-sidebar-preference"));
  }

  return (
    <>
      {isOfflinePage ? (
        children
      ) : (
        <AuthGuard permission={isLoginPage ? undefined : routeAccess(pathname)}>
          {isLoginPage ? (
            children
          ) : (
            <>
              <Sidebar
                collapsed={sidebarCollapsed}
                onToggleCollapsed={toggleSidebar}
              />
              <MobileTopbar />
              <div className={`min-h-screen min-w-0 overflow-x-clip bg-slate-50 pt-16 transition-[padding] duration-200 md:pt-0 motion-reduce:transition-none ${sidebarCollapsed ? "md:pl-[5.25rem]" : "md:pl-64"} print:pl-0 print:pt-0`}>
                <OfflineBanner />
                <AppTopbar />
                <main
                  id="main-content"
                  tabIndex={-1}
                  className="mx-auto min-h-[calc(100vh-4.5rem)] w-full max-w-screen-2xl px-4 py-6 outline-none sm:px-6 md:px-7 md:py-8 xl:px-9 print:min-h-0 print:p-0"
                >
                  {children}
                </main>
              </div>
            </>
          )}
        </AuthGuard>
      )}
      {!isOfflinePage ? <InstallPrompt /> : null}
    </>
  );
}

function getSidebarPreference(): boolean {
  return typeof window !== "undefined" &&
    window.localStorage.getItem("tgi-sidebar-collapsed") === "true";
}

function subscribeSidebarPreference(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener("tgi-sidebar-preference", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("tgi-sidebar-preference", onChange);
  };
}

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <FirestoreDataProvider>
          <StockDataProvider>
            <DocumentsProvider>
              <RecouvrementDataProvider>
                <CompanySettingsProvider>
                  <ClientApplication>{children}</ClientApplication>
                </CompanySettingsProvider>
              </RecouvrementDataProvider>
            </DocumentsProvider>
          </StockDataProvider>
        </FirestoreDataProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
