import type { DateInput } from "@/types";

const FALLBACK_DATE = () => new Date().toLocaleDateString("fr-FR");

function isValidDate(date: Date): boolean {
  const year = date.getFullYear();
  return (
    Number.isFinite(date.getTime()) &&
    year >= 2000 &&
    year <= 2100
  );
}

function isRealCalendarDate(year: number, month: number, day: number): boolean {
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function parseString(value: string): Date | null {
  const frenchDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (frenchDate) {
    const day = Number(frenchDate[1]);
    const month = Number(frenchDate[2]);
    const year = Number(frenchDate[3]);
    if (!isRealCalendarDate(year, month, day)) return null;

    const date = new Date(0);
    date.setFullYear(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  const isoDate = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(value);
  if (!isoDate) return null;

  const year = Number(isoDate[1]);
  const month = Number(isoDate[2]);
  const day = Number(isoDate[3]);
  if (!isRealCalendarDate(year, month, day)) return null;

  if (!value.includes("T")) {
    const date = new Date(0);
    date.setFullYear(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function parseInput(input: DateInput): Date | null {
  if (input instanceof Date) return input;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    return new Date(input < 1e11 ? input * 1000 : input);
  }
  if (typeof input === "string") return parseString(input);
  if (input === null || input === undefined) return null;

  if (typeof input !== "object") return null;

  if ("toDate" in input && typeof input.toDate === "function") {
    const date = input.toDate();
    return date instanceof Date ? date : null;
  }

  if ("seconds" in input && typeof input.seconds === "number") {
    const nanoseconds =
      "nanoseconds" in input && typeof input.nanoseconds === "number"
        ? input.nanoseconds
        : 0;
    if (!Number.isFinite(input.seconds) || !Number.isFinite(nanoseconds)) {
      return null;
    }
    return new Date(input.seconds * 1000 + nanoseconds / 1e6);
  }

  return null;
}

export function formatSafeDate(input: DateInput): string {
  try {
    const date = parseInput(input);
    if (!date || !isValidDate(date)) return FALLBACK_DATE();

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${date.getFullYear()}`;
  } catch {
    return FALLBACK_DATE();
  }
}
