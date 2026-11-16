import { test } from "node:test";
import assert from "node:assert/strict";
import { eventIcs } from "./ics.ts";

const ics = eventIcs({
  id: "abc",
  title: "Badstu, øl; og prat",
  description: "Ta med håndkle\nog badetøy",
  location: "Sjøterrassen, Stathelle",
  lat: 59.04,
  lng: 9.69,
  startsAt: "2026-11-21T17:00:00Z",
  url: "https://flokk.example/vest-bamble/arrangement/abc",
  groupName: "Vest-Bamble Badstuforening med et veldig langt navn som må brettes over flere linjer",
});

test("har start, slutt to timer senere og påminnelse", () => {
  assert.match(ics, /\r\nDTSTART:20261121T170000Z\r\n/);
  assert.match(ics, /\r\nDTEND:20261121T190000Z\r\n/);
  assert.match(ics, /\r\nTRIGGER:-PT2H\r\n/);
});

test("escaper komma, semikolon og linjeskift", () => {
  assert.ok(ics.includes(String.raw`SUMMARY:Badstu\, øl\; og prat`));
  assert.ok(ics.includes(String.raw`DESCRIPTION:Ta med håndkle\nog badetøy`));
});

test("bretter linjer over 75 byte og bruker CRLF", () => {
  for (const line of ics.split("\r\n")) {
    assert.ok(new TextEncoder().encode(line).length <= 75, `for lang linje: ${line}`);
  }
  assert.ok(!/[^\r]\n/.test(ics), "linjeskift uten CR");
});
