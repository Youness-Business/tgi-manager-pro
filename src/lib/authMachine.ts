import type { User } from "firebase/auth";
import type { UserProfile, UserRole } from "@/types";

export type AuthStatus =
  | "loading"
  | "unauthenticated"
  | "unauthorized"
  | "ready"
  | "error";

export type AuthMachineState = {
  status: AuthStatus;
  user: User | null;
  profile: UserProfile | null;
  error: string | null;
  errorCode: string | null;
  attemptedEmail: string | null;
};

export type AuthMachineEvent =
  | { type: "AUTH_LOADING"; user?: User | null }
  | { type: "AUTH_READY"; user: User; profile: UserProfile }
  | { type: "AUTH_EMPTY" }
  | { type: "AUTH_UNAUTHORIZED"; email: string | null; message?: string }
  | { type: "AUTH_ERROR"; error: string; code?: string | null; email?: string | null }
  | { type: "CLEAR_MESSAGE" }
  | { type: "RESET" };

export const initialAuthMachineState: AuthMachineState = {
  status: "loading",
  user: null,
  profile: null,
  error: null,
  errorCode: null,
  attemptedEmail: null,
};

export function authMachineReducer(
  state: AuthMachineState,
  event: AuthMachineEvent,
): AuthMachineState {
  switch (event.type) {
    case "AUTH_LOADING":
      return {
        status: "loading",
        user: event.user ?? null,
        profile: null,
        error: null,
        errorCode: null,
        attemptedEmail: null,
      };
    case "AUTH_READY":
      return {
        status: "ready",
        user: event.user,
        profile: event.profile,
        error: null,
        errorCode: null,
        attemptedEmail: event.user.email,
      };
    case "AUTH_EMPTY":
      return state.status === "unauthorized"
        ? { ...state, user: null, profile: null }
        : {
            status: "unauthenticated",
            user: null,
            profile: null,
            error: null,
            errorCode: null,
            attemptedEmail: null,
          };
    case "AUTH_UNAUTHORIZED":
      return {
        status: "unauthorized",
        user: null,
        profile: null,
        error: event.message ?? "Accès non autorisé",
        errorCode: null,
        attemptedEmail: event.email,
      };
    case "AUTH_ERROR":
      return {
        status: "error",
        user: event.email ? state.user : null,
        profile: null,
        error: event.error,
        errorCode: event.code ?? null,
        attemptedEmail: event.email ?? state.attemptedEmail,
      };
    case "CLEAR_MESSAGE":
      return state.status === "unauthorized" || state.status === "error"
        ? {
            status: "unauthenticated",
            user: null,
            profile: null,
            error: null,
            errorCode: null,
            attemptedEmail: null,
          }
        : { ...state, error: null, errorCode: null };
    case "RESET":
      return {
        status: "unauthenticated",
        user: null,
        profile: null,
        error: null,
        errorCode: null,
        attemptedEmail: null,
      };
  }
}

export function authRole(profile: UserProfile | null): UserRole | null {
  return profile?.role ?? null;
}
