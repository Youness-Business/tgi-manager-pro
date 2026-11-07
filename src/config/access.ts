import type { UserRole } from "@/types";

export type AllowedAccount = {
  email: string;
  nom: string;
  role: UserRole;
  roleLabel: string;
};

export const accessWhitelist: readonly AllowedAccount[] = [
  {
    email: "laassas.youness65@gmail.com",
    nom: "Youness Laassas",
    role: "owner",
    roleLabel: "Propriétaire",
  },
  {
    email: "yl.younesslaassas@gmail.com",
    nom: "Youness Laassas",
    role: "commercial",
    roleLabel: "Commercial",
  },
  {
    email: "techniquegi39@gmail.com",
    nom: "Khalid Laassas",
    role: "dg",
    roleLabel: "Directeur Général",
  },
];

export function normalizeEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase();
  return normalized || null;
}

export function getRoleForEmail(
  email: string | null | undefined,
  emailVerified: boolean,
): UserRole | null {
  if (!emailVerified) return null;
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  return accessWhitelist.find((account) => account.email === normalizedEmail)?.role ?? null;
}

export function isEmailAllowed(
  email: string | null | undefined,
  emailVerified: boolean,
): boolean {
  return getRoleForEmail(email, emailVerified) !== null;
}

export function allowedAccountForEmail(
  email: string | null | undefined,
): AllowedAccount | null {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  return (
    accessWhitelist.find((account) => account.email === normalizedEmail) ?? null
  );
}