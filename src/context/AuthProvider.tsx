"use client";

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { UserProfile, UserRole } from "@/types";
import { ensureUserProfile } from "@/lib/ensureUserProfile";
import {
  FirebaseConfigurationError,
  getFirebaseAuth,
  getFirebaseDb,
  missingFirebaseVariables,
} from "@/lib/firebase";

const initialConfigurationError = (() => {
  const missing = missingFirebaseVariables();
  return missing.length ? new FirebaseConfigurationError(missing).message : null;
})();

type AuthContextValue = {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readableAuthError(error: unknown): string {
  if (error instanceof Error && error.message === "Accès non autorisé") {
    return error.message;
  }
  if (error instanceof Error && error.message.includes("Configuration Firebase")) {
    return error.message;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "permission-denied"
  ) {
    return "Accès refusé par les règles Firestore. Vérifiez le profil et les règles de sécurité.";
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code.startsWith("auth/")
  ) {
    return "La connexion Google a échoué. Vérifiez que le fournisseur Google est activé dans Firebase.";
  }
  return error instanceof Error
    ? error.message
    : "Une erreur de connexion est survenue. Réessayez.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(initialConfigurationError === null);
  const [error, setError] = useState<string | null>(initialConfigurationError);

  useEffect(() => {
    if (initialConfigurationError) return;
    let active = true;
    let unsubscribe = () => {};

    try {
      const auth = getFirebaseAuth();
      const db = getFirebaseDb();
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (!active) return;
        if (!firebaseUser) {
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        setLoading(true);
        try {
          const userProfile = await ensureUserProfile(db, firebaseUser);
          if (!active) return;
          setUser(firebaseUser);
          setProfile(userProfile);
          setError(null);
        } catch (profileError) {
          await firebaseSignOut(auth);
          if (!active) return;
          setUser(null);
          setProfile(null);
          setError(readableAuthError(profileError));
        } finally {
          if (active) setLoading(false);
        }
      });
    } catch (configurationError) {
      const message = readableAuthError(configurationError);
      window.setTimeout(() => {
        if (!active) return;
        setError(message);
        setLoading(false);
      }, 0);
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    try {
      const auth = getFirebaseAuth();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
    } catch (signInError) {
      setError(readableAuthError(signInError));
      throw signInError;
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      await firebaseSignOut(getFirebaseAuth());
      setUser(null);
      setProfile(null);
    } catch (signOutError) {
      setError(readableAuthError(signOutError));
      throw signOutError;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      role: profile?.role ?? null,
      loading,
      error,
      signIn,
      signOut,
      clearError: () => setError(null),
    }),
    [user, profile, loading, error, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit être utilisé dans un AuthProvider.");
  }
  return context;
}