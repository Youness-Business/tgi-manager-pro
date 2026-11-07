"use client";

import {
  browserLocalPersistence,
  getRedirectResult,
  onAuthStateChanged,
  GoogleAuthProvider,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { isEmailAllowed } from "@/config/access";
import {
  authMachineReducer,
  initialAuthMachineState,
} from "@/lib/authMachine";
import { ensureUserProfile, parseUserProfile } from "@/lib/ensureUserProfile";
import { firestoreErrorMessage } from "@/lib/firestoreErrors";
import {
  FirebaseConfigurationError,
  getFirebaseAuth,
  getFirebaseDb,
  missingFirebaseVariables,
} from "@/lib/firebase";

type AuthContextValue = {
  user: User | null;
  profile: ReturnType<typeof parseUserProfile> | null;
  role: ReturnType<typeof parseUserProfile>["role"] | null;
  status: "loading" | "unauthenticated" | "unauthorized" | "ready" | "error";
  loading: boolean;
  error: string | null;
  errorCode: string | null;
  attemptedEmail: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function firebaseErrorCode(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return null;
}

function readableAuthError(error: unknown): string {
  const code = firebaseErrorCode(error);
  const messages: Record<string, string> = {
    "auth/popup-blocked": "La fenêtre de connexion a été bloquée. Autorisez les fenêtres pop-up ou réessayez.",
    "auth/unauthorized-domain": "Ce domaine n’est pas autorisé. Ajoutez-le dans Firebase Authentication → Paramètres → Domaines autorisés.",
    "auth/operation-not-allowed": "La connexion Google n’est pas activée dans Firebase Authentication → Sign-in method.",
    "auth/network-request-failed": "Connexion réseau impossible. Vérifiez votre accès à Internet puis réessayez.",
    "auth/internal-error": "Firebase Authentication a rencontré une erreur interne. Réessayez dans quelques instants.",
    "auth/invalid-api-key": "La configuration Firebase est invalide. Vérifiez les variables NEXT_PUBLIC_FIREBASE_*.",
    "permission-denied": "Accès au profil Firestore refusé. Vérifiez les règles déployées, le rôle et l’état actif du compte.",
    "firestore/permission-denied": "Accès au profil Firestore refusé. Vérifiez les règles déployées, le rôle et l’état actif du compte.",
  };
  if (code && messages[code]) return messages[code];
  if (error instanceof FirebaseConfigurationError || error instanceof Error) {
    return error.message;
  }
  return "Une erreur de connexion est survenue. Réessayez.";
}

function identityFromUser(user: User) {
  return {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authMachineReducer, initialAuthMachineState);
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    let active = true;
    let unsubscribeAuth = () => {};
    let unsubscribeProfile = () => {};
    let currentUid: string | null = null;
    let creatingProfileUid: string | null = null;
    let redirectError: unknown = null;

    const missing = missingFirebaseVariables();
    if (missing.length) {
      dispatch({
        type: "AUTH_ERROR",
        error: new FirebaseConfigurationError(missing).message,
        code: "firebase/configuration-incomplete",
      });
      return () => {
        active = false;
      };
    }

    async function initializeAuth() {
      try {
        const auth = getFirebaseAuth();
        await setPersistence(auth, browserLocalPersistence);
        if (!active) return;
        try {
          await getRedirectResult(auth);
        } catch (redirectFailure) {
          if (!active) return;
          redirectError = redirectFailure;
          dispatch({
            type: "AUTH_ERROR",
            error: readableAuthError(redirectFailure),
            code: firebaseErrorCode(redirectFailure),
          });
        }
        const db = getFirebaseDb();
        unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
          if (!active) return;
          if (!firebaseUser) {
            unsubscribeProfile();
            unsubscribeProfile = () => {};
            currentUid = null;
            creatingProfileUid = null;
            if (redirectError) {
              dispatch({
                type: "AUTH_ERROR",
                error: readableAuthError(redirectError),
                code: firebaseErrorCode(redirectError),
              });
            } else {
              dispatch({ type: "AUTH_EMPTY" });
            }
            return;
          }
          if (currentUid === firebaseUser.uid) return;

          unsubscribeProfile();
          unsubscribeProfile = () => {};
          currentUid = firebaseUser.uid;
          creatingProfileUid = null;
          const identity = identityFromUser(firebaseUser);
          dispatch({ type: "AUTH_LOADING", user: firebaseUser });

          if (!isEmailAllowed(identity.email, identity.emailVerified)) {
            dispatch({
              type: "AUTH_UNAUTHORIZED",
              email: identity.email?.trim() || null,
            });
            void firebaseSignOut(auth).catch((signOutError: unknown) => {
              if (!active) return;
              dispatch({
                type: "AUTH_ERROR",
                error: readableAuthError(signOutError),
                code: firebaseErrorCode(signOutError),
                email: identity.email,
              });
            });
            return;
          }

          const profileReference = doc(db, "users", firebaseUser.uid);
          unsubscribeProfile = onSnapshot(
            profileReference,
            (snapshot) => {
              if (!active || currentUid !== firebaseUser.uid) return;
              if (snapshot.exists()) {
                try {
                  const profile = parseUserProfile(
                    firebaseUser.uid,
                    snapshot.data(),
                    identity,
                  );
                  creatingProfileUid = null;
                  dispatch({ type: "AUTH_READY", user: firebaseUser, profile });
                } catch (profileError) {
                  const message = profileError instanceof Error
                    ? profileError.message
                    : "Le profil utilisateur est invalide.";
                  dispatch({
                    type: "AUTH_ERROR",
                    error: message,
                    code: "auth/invalid-user-profile",
                    email: identity.email,
                  });
                }
                return;
              }

              dispatch({ type: "AUTH_LOADING", user: firebaseUser });
              if (creatingProfileUid === firebaseUser.uid) return;
              creatingProfileUid = firebaseUser.uid;
              void ensureUserProfile(db, identity).then(
                (profile) => {
                  if (active && currentUid === firebaseUser.uid) {
                    dispatch({ type: "AUTH_READY", user: firebaseUser, profile });
                  }
                },
                (profileError: unknown) => {
                  if (!active || currentUid !== firebaseUser.uid) return;
                  creatingProfileUid = null;
                  dispatch({
                    type: "AUTH_ERROR",
                    error: readableAuthError(profileError),
                    code: firebaseErrorCode(profileError),
                    email: identity.email,
                  });
                },
              );
            },
            (snapshotError) => {
              if (!active || currentUid !== firebaseUser.uid) return;
              dispatch({
                type: "AUTH_ERROR",
                error: readableAuthError(snapshotError) || firestoreErrorMessage(snapshotError),
                code: firebaseErrorCode(snapshotError),
                email: identity.email,
              });
            },
          );
        });
      } catch (initializationError) {
        if (!active) return;
        dispatch({
          type: "AUTH_ERROR",
          error: readableAuthError(initializationError),
          code: firebaseErrorCode(initializationError),
        });
      }
    }

    void initializeAuth();
    return () => {
      active = false;
      unsubscribeProfile();
      unsubscribeAuth();
    };
  }, []);

  const signIn = useCallback(async () => {
    dispatch({ type: "AUTH_LOADING" });
    try {
      const auth = getFirebaseAuth();
      await setPersistence(auth, browserLocalPersistence);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      try {
        await signInWithPopup(auth, provider);
      } catch (popupError) {
        if (firebaseErrorCode(popupError) === "auth/popup-blocked") {
          await signInWithRedirect(auth, provider);
          return;
        }
        if (
          firebaseErrorCode(popupError) === "auth/popup-closed-by-user" ||
          firebaseErrorCode(popupError) === "auth/cancelled-popup-request"
        ) {
          dispatch({ type: "AUTH_EMPTY" });
          return;
        }
        throw popupError;
      }
    } catch (signInError) {
      dispatch({
        type: "AUTH_ERROR",
        error: readableAuthError(signInError),
        code: firebaseErrorCode(signInError),
      });
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(getFirebaseAuth());
      dispatch({ type: "RESET" });
      router.replace("/login");
      showToast("Vous êtes déconnecté");
    } catch (signOutError) {
      dispatch({
        type: "AUTH_ERROR",
        error: readableAuthError(signOutError),
        code: firebaseErrorCode(signOutError),
        email: state.user?.email,
      });
      throw signOutError;
    }
  }, [router, showToast, state.user?.email]);

  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_MESSAGE" });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: state.user,
      profile: state.profile,
      role: state.profile?.role ?? null,
      status: state.status,
      loading: state.status === "loading",
      error: state.error,
      errorCode: state.errorCode,
      attemptedEmail: state.attemptedEmail,
      signIn,
      signOut,
      clearError,
    }),
    [state, signIn, signOut, clearError],
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
