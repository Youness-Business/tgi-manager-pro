export function firestoreErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    if (error.code === "permission-denied") {
      return "Accès refusé par Firestore. Vérifiez votre rôle ou demandez l’accès à l’administrateur.";
    }
    if (
      error.code === "unavailable" ||
      error.code === "deadline-exceeded" ||
      error.code === "network-request-failed"
    ) {
      return "Firestore est momentanément indisponible. Vérifiez votre connexion puis réessayez.";
    }
  }
  return error instanceof Error
    ? error.message
    : "Une erreur de communication avec Firestore est survenue.";
}
