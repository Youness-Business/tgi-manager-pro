export function assertOnline(): void {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("Cette opération nécessite une connexion Internet.");
  }
}
