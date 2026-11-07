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
    email: "yl.younesslaaassas@gmail.com",
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

export function allowedAccountForEmail(
  email: string | null | undefined,
): AllowedAccount | null {
  if (!email) return null;
  const normalizedEmail = email.trim().toLocaleLowerCase("en-US");
  return (
    accessWhitelist.find((account) => account.email === normalizedEmail) ?? null
  );
}