import assert from "node:assert/strict";
import test from "node:test";
import { effectiveDateError, isQualityCalendarDate, qualityToday } from "../lib/quality-effective-date.ts";

test("effective dates follow midnight in Thailand rather than the server timezone", () => {
  assert.equal(qualityToday(new Date("2026-10-26T16:59:59Z")), "2026-10-26");
  assert.equal(qualityToday(new Date("2026-10-26T17:00:00Z")), "2026-10-27");
});

test("effective dates reject invalid calendar dates and past dates", () => {
  assert.equal(isQualityCalendarDate("2028-02-29"), true);
  for (const value of ["2026-02-30", "2026-02-29", "2026-13-01", "2026-01-32", "2026-1-1", "0000-01-01", null, {}]) assert.equal(isQualityCalendarDate(value), false);
  assert.ok(effectiveDateError("")); assert.ok(effectiveDateError("2000-01-01"));
  assert.equal(effectiveDateError(qualityToday()), null);
  assert.equal(effectiveDateError(qualityToday(new Date(Date.now() + 86400000))), null);
});
