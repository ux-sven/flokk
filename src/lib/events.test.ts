import { test } from "node:test";
import assert from "node:assert/strict";
import { splitEvents } from "./events.ts";

const now = Date.parse("2026-11-16T12:00:00Z");
const ev = (id: string, starts: string | null, created = "2026-11-01T00:00:00Z") => ({
  id,
  created_at: created,
  chosen: starts ? { starts_at: starts } : null,
});

test("deler i stemming, kommende og tidligere", () => {
  const r = splitEvents(
    [
      ev("gammel", "2026-10-01T17:00:00Z"),
      ev("i-morgen", "2026-11-17T17:00:00Z"),
      ev("neste-uke", "2026-11-23T17:00:00Z"),
      ev("stem-ny", null, "2026-11-10T00:00:00Z"),
      ev("stem-gml", null, "2026-11-02T00:00:00Z"),
    ],
    now,
  );
  assert.deepEqual(r.upcoming.map((e) => e.id), ["i-morgen", "neste-uke"]);
  assert.deepEqual(r.voting.map((e) => e.id), ["stem-ny", "stem-gml"]);
  assert.deepEqual(r.past.map((e) => e.id), ["gammel"]);
});

test("et arrangement regnes som kommende til seks timer etter start", () => {
  const r = splitEvents([ev("for-4t", "2026-11-16T08:00:00Z"), ev("for-8t", "2026-11-16T04:00:00Z")], now);
  assert.deepEqual(r.upcoming.map((e) => e.id), ["for-4t"]);
  assert.deepEqual(r.past.map((e) => e.id), ["for-8t"]);
});
