import { test } from "node:test";
import assert from "node:assert/strict";
import { atLimit, planLimitMessage } from "./plan.ts";

test("planLimitMessage viser bare meldinger fra gratisgrensene", () => {
  assert.equal(planLimitMessage({ hint: "plan_limit:members", message: "Flokken er full." }), "Flokken er full.");
  assert.equal(planLimitMessage({ hint: null, message: "duplicate key" }), null);
  assert.equal(planLimitMessage(null), null);
});

test("atLimit: ingen grense når max er null (Pluss)", () => {
  assert.equal(atLimit(8, 8), true);
  assert.equal(atLimit(7, 8), false);
  assert.equal(atLimit(50, null), false);
});
