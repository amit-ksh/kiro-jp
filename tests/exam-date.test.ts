import { test } from "node:test";
import assert from "node:assert/strict";
import { parseExamDate } from "../packages/learning-core/src/profile.ts";

test("exam dates retain their calendar day, allow valid leap dates and clear explicitly", () => {
  for (const day of [
    "2026-12-06",
    "2028-02-29",
    "2000-02-29",
    "2026-01-01",
    "2026-12-31",
  ])
    assert.equal(parseExamDate(day), day);
  assert.equal(parseExamDate(" 2026-12-06 "), "2026-12-06");
  assert.equal(parseExamDate(""), undefined);
  assert.equal(parseExamDate("   "), undefined);
});
test("invalid dates cannot silently roll over or become timestamps or locale-dependent dates", () => {
  for (const value of [
    "2026-02-29",
    "1900-02-29",
    "2026-02-30",
    "2026-04-31",
    "2026-00-10",
    "2026-13-01",
    "2026-01-00",
    "2026-1-1",
    "06/12/2026",
    "2026-12-06T00:00:00Z",
    "2026-12-06junk",
    "tomorrow",
  ])
    assert.equal(parseExamDate(value), null, value);
});
