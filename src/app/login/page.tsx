import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Connexion sécurisée à l’espace de gestion TGI Ascenseurs.",
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          className="flex min-h-screen items-center justify-center bg-brand-950 text-sm text-white"
        >
          Chargement de la connexion…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}