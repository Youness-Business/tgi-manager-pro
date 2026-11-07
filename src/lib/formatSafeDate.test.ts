import assert from "node:assert/strict";
import test from "node:test";
import { formatSafeDate } from "./formatSafeDate.ts";

test("formats all supported date input shapes", () => {
  const date = new Date(2024, 3, 15, 12);
  const timestampMs = date.getTime();
  const timestampSeconds = timestampMs / 1000;

  const cases: Array<[string, Parameters<typeof formatSafeDate>[0], string]> = [
    ["Date", date, "15/04/2024"],
    ["ISO date", "2024-04-15", "15/04/2024"],
    ["French date", "15/04/2024", "15/04/2024"],
    ["seconds", timestampSeconds, "15/04/2024"],
    ["milliseconds", timestampMs, "15/04/2024"],
    [
      "Firestore timestamp",
      { seconds: timestampSeconds, nanoseconds: 0 },
      "15/04/2024",
    ],
    ["toDate object", { toDate: () => date }, "15/04/2024"],
  ];

  for (const [label, input, expected] of cases) {
    assert.equal(formatSafeDate(input), expected, label);
  }
});

test("uses today's French date for invalid or out-of-range values", () => {
  const invalidCases: Array<Parameters<typeof formatSafeDate>[0]> = [
    null,
    undefined,
    "31/02/2024",
    "2024-02-30",
    "15/04/55554",
    "1999-12-31",
    "2101-01-01",
    new Date(Number.NaN),
    { toDate: () => { throw new Error("invalid timestamp"); } },
  ];
  const fallback = new Date().toLocaleDateString("fr-FR");

  for (const input of invalidCases) {
    assert.equal(formatSafeDate(input), fallback);
  }
});
