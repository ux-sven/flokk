import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDateTime, initials } from "./format.ts";

const now = Date.parse("2026-11-16T12:00:00Z");

test("viser ikke årstall for datoer i år", () => {
  assert.doesNotMatch(formatDateTime("2026-11-17T17:00:00Z", now), /2026/);
});

test("viser årstall for datoer i et annet år", () => {
  assert.match(formatDateTime("2027-01-09T17:00:00Z", now), /2027/);
});

test("bruker norsk tid", () => {
  // 17:00 UTC er 18:00 i Oslo om vinteren
  assert.match(formatDateTime("2026-11-17T17:00:00Z", now), /18:00/);
});

test("initialer", () => {
  assert.equal(initials("Kari Nordmann"), "KN");
  assert.equal(initials("  "), "?");
});
