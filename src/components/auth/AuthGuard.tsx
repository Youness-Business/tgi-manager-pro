"use client";

import { usePathname, useRouter } from "@/lib/router";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/context/AuthProvider";
import { can, type PermissionAction, type PermissionResource } from "@/lib/permissions";
import type { UserRole } from "@/types";

type AuthGuardProps = {
  children: ReactNode;
  allowedRoles?: readonly UserRole[];
  permission?: {
    action: PermissionAction;
    resource: PermissionResource;
  };
};

function AccessLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-sm text-slate-600"
    >
      <span className="sr-only">Vérification de la session…</span>
      <div className="w-full max-w-sm animate-pulse space-y-3">
        <div className="h-8 rounded-lg bg-slate-200" />
        <div className="h-24 rounded-2xl bg-white shadow-card" />
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <section
      role="alert"
      className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-card"
    >
      <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
        Accès refusé
      </p>
      <h1 className="mt-2 font-display text-2xl font-bold text-slate-900">
        Vous n’avez pas accès à cette page
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Votre rôle ne permet pas cette action. Contactez le propriétaire du compte si nécessaire.
      </p>
    </section>
  );
}

export function AuthGuard({
  children,
  allowedRoles,
  permission,
}: AuthGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, status } = useAuth();
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (status === "loading" || isLoginPage) return;
    if (status !== "ready" || !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, user, isLoginPage, pathname, router]);

  if (isLoginPage) {
    return status === "loading" ? <AccessLoading /> : children;
  }
  if (status === "loading") return <AccessLoading />;
  if (status !== "ready" || !user || !role) return <AccessLoading />;
  if (allowedRoles && !allowedRoles.includes(role)) return <AccessDenied />;
  if (permission && !can(role, permission.action, permission.resource)) {
    return <AccessDenied />;
  }

  return children;
}