import {
  doc,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import {
  allowedAccountForEmail,
  getRoleForEmail,
  normalizeEmail,
} from "@/config/access";
import type { DateInput, UserProfile } from "@/types";

export type FirebaseIdentity = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  photoURL: string | null;
};

function isDateInput(value: unknown): value is DateInput {
  if (value instanceof Date || typeof value === "string") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || value === null) return false;
  if ("toDate" in value && typeof value.toDate === "function") return true;
  return "seconds" in value && typeof value.seconds === "number";
}

export function parseUserProfile(
  uid: string,
  source: unknown,
  identity: FirebaseIdentity,
): UserProfile {
  const account = allowedAccountForEmail(identity.email);
  const normalizedEmail = normalizeEmail(identity.email);
  const expectedRole = getRoleForEmail(identity.email, identity.emailVerified);
  if (
    typeof source !== "object" ||
    source === null ||
    !account ||
    !normalizedEmail ||
    !expectedRole
  ) {
    throw new Error("Accès non autorisé");
  }
  const value = source as Record<string, unknown>;
  if (
    typeof value.email !== "string" ||
    normalizeEmail(value.email) !== normalizedEmail ||
    value.role !== expectedRole ||
    typeof value.nom !== "string" ||
    typeof value.actif !== "boolean" ||
    !value.actif
  ) {
    throw new Error("Le profil utilisateur est invalide ou désactivé. Contactez l’administrateur.");
  }
  if (value.createdAt !== undefined && !isDateInput(value.createdAt)) {
    throw new Error("La date de création du profil est invalide.");
  }
  if (value.photoURL !== undefined && typeof value.photoURL !== "string") {
    throw new Error("La photo du profil utilisateur est invalide.");
  }
  return {
    uid,
    email: normalizedEmail,
    nom: value.nom,
    role: expectedRole,
    actif: true,
    ...(isDateInput(value.createdAt) ? { createdAt: value.createdAt } : {}),
    ...(typeof value.photoURL === "string" ? { photoURL: value.photoURL } : {}),
  };
}

export async function ensureUserProfile(
  db: Firestore,
  identity: FirebaseIdentity,
): Promise<UserProfile> {
  const account = allowedAccountForEmail(identity.email);
  const normalizedEmail = normalizeEmail(identity.email);
  const role = getRoleForEmail(identity.email, identity.emailVerified);
  if (!identity.emailVerified || !account || !normalizedEmail || !role) {
    throw new Error("Accès non autorisé");
  }

  const profileRef = doc(db, "users", identity.uid);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(profileRef);
    if (snapshot.exists()) {
      return parseUserProfile(identity.uid, snapshot.data(), identity);
    }

    const newProfile: Omit<UserProfile, "uid"> = {
      email: normalizedEmail,
      nom: account.nom || identity.displayName || normalizedEmail,
      role,
      actif: true,
      ...(identity.photoURL ? { photoURL: identity.photoURL } : {}),
    };
    transaction.set(profileRef, {
      ...newProfile,
      createdAt: serverTimestamp(),
    });
    return { ...newProfile, uid: identity.uid };
  });
}
