import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import { allowedAccountForEmail } from "@/config/access";
import type { UserProfile } from "@/types";

type FirebaseIdentity = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

function isProfile(value: unknown): value is Omit<UserProfile, "uid"> {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.email === "string" &&
    typeof candidate.nom === "string" &&
    (candidate.role === "owner" ||
      candidate.role === "dg" ||
      candidate.role === "commercial") &&
    typeof candidate.actif === "boolean"
  );
}

export async function ensureUserProfile(
  db: Firestore,
  identity: FirebaseIdentity,
): Promise<UserProfile> {
  const account = allowedAccountForEmail(identity.email);
  if (!account) throw new Error("Accès non autorisé");

  const profileRef = doc(db, "users", identity.uid);
  const snapshot = await getDoc(profileRef);
  if (snapshot.exists()) {
    const data: unknown = snapshot.data();
    if (!isProfile(data)) {
      throw new Error("Le profil utilisateur est invalide. Contactez l’administrateur.");
    }
    if (!data.actif) throw new Error("Ce compte est désactivé.");
    if (data.email.toLocaleLowerCase("en-US") !== account.email) {
      throw new Error("L’adresse e-mail du profil ne correspond pas au compte Google.");
    }
    if (data.role !== account.role) {
      throw new Error("Le rôle du compte est incohérent. Contactez l’administrateur.");
    }
    return { ...data, uid: identity.uid };
  }

  const newProfile: Omit<UserProfile, "uid"> = {
    email: account.email,
    nom: account.nom || identity.displayName || account.email,
    role: account.role,
    actif: true,
    ...(identity.photoURL ? { photoURL: identity.photoURL } : {}),
    createdAt: new Date(),
  };
  await setDoc(profileRef, { ...newProfile, createdAt: serverTimestamp() });
  return { ...newProfile, uid: identity.uid };
}