import { test } from "node:test";
import assert from "node:assert/strict";
import { recommendLevel, shouldOfferFollowups } from "../packages/learning-core/src/placement.ts";
import type { PlacementQuestion } from "../packages/learning-core/src/placement.ts";
import type { PlacementResponse } from "../packages/learning-core/src/profile.ts";
import { placementBank } from "../packages/content/src/index.ts";
const bank: readonly PlacementQuestion[] = placementBank;
function responses(correct: string[], unavailable: string[] = []): PlacementResponse[] { return bank.map(q => ({ questionId: q.id, bankVersion: q.bankVersion, outcome: unavailable.includes(q.id) ? "unavailable" : correct.includes(q.id) ? "correct" : "dontKnow" })); }
test("no answers and completely unsupported placement start with foundations", () => { assert.equal(recommendLevel(bank, []).band, "foundations"); });
test("unavailable listening is unassessed, never a reading-derived listening score", () => {
  const result = recommendLevel(bank, responses(bank.filter(q => q.domain !== "listening").map(q => q.id), bank.filter(q => q.domain === "listening").map(q => q.id)));
  assert.equal(result.assessed, 6); assert.equal(result.band, "early-n5"); assert.match(result.explanation, /Listening is not assessed/);
});
test("a strong vocabulary and kana result without grammar or listening does not infer higher level", () => { assert.equal(recommendLevel(bank, responses(["kana-a", "kana-ka", "vocab-water", "vocab-book"])).band, "foundations"); });
test("early N4 requires strong starter plus follow-up grammar and listening", () => {
  const starter = bank.filter(q => q.phase === "starter").map(q => q.id);
  assert.equal(recommendLevel(bank, responses([...starter, "follow-kana", "follow-vocab", "follow-grammar"])).band, "early-n5");
  assert.equal(recommendLevel(bank, responses([...starter, "follow-vocab", "follow-grammar", "follow-listen"])).band, "early-n4");
  assert.equal(shouldOfferFollowups(bank, responses(starter)), true);
});
test("old bank answers are ignored and a revised answer is used once", () => {
  const old: PlacementResponse[] = bank.map(q => ({ questionId: q.id, bankVersion: 0, outcome: "correct" }));
  assert.equal(recommendLevel(bank, old).assessed, 0);
  const repeated: PlacementResponse[] = [{ questionId: "kana-a", bankVersion: 1, outcome: "correct" }, { questionId: "kana-a", bankVersion: 1, outcome: "dontKnow" }];
  assert.equal(recommendLevel(bank, repeated).correct, 0); assert.equal(recommendLevel(bank, repeated).assessed, 1);
});
