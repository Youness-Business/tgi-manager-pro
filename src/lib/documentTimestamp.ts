import type { DateInput } from "@/types";
import { formatSafeDate } from "@/lib/formatSafeDate";

export function documentTimestamp(input: DateInput): number {
  const [day, month, year] = formatSafeDate(input).split("/").map(Number);
  return new Date(year, month - 1, day).getTime();
}
