import { describe, expect, it } from "vitest";
import {
  authMachineReducer,
  initialAuthMachineState,
} from "@/lib/authMachine";

describe("machine d’états de l’authentification", () => {
  it("attend le profil avant de rendre la session prête", () => {
    const loading = authMachineReducer(initialAuthMachineState, {
      type: "AUTH_LOADING",
    });

    expect(loading.status).toBe("loading");
    expect(loading.user).toBeNull();
    expect(loading.profile).toBeNull();
  });

  it("conserve l’adresse refusée après la fin de la session Firebase", () => {
    const unauthorized = authMachineReducer(initialAuthMachineState, {
      type: "AUTH_UNAUTHORIZED",
      email: "intrus@example.com",
    });
    const signedOut = authMachineReducer(unauthorized, { type: "AUTH_EMPTY" });

    expect(signedOut.status).toBe("unauthorized");
    expect(signedOut.attemptedEmail).toBe("intrus@example.com");
  });

  it("réinitialise une erreur lors d’une nouvelle tentative", () => {
    const failed = authMachineReducer(initialAuthMachineState, {
      type: "AUTH_ERROR",
      error: "Échec de connexion",
      code: "auth/network-request-failed",
    });
    const retry = authMachineReducer(failed, { type: "AUTH_LOADING" });

    expect(retry.status).toBe("loading");
    expect(retry.error).toBeNull();
    expect(retry.errorCode).toBeNull();
  });
});
