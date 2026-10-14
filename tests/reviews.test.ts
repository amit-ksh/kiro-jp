import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { requestsLesson } from "../packages/content/src/requests.ts";
import {
  decideReview,
  introduceReview,
  orderReviewAttempts,
  hasStrongRecall,
  validateReviewAttempt,
  type ReviewAttempt,
  type ReviewCard,
  type ReviewTrack,
  type ReviewOpportunity,
  type ReviewReceipt,
} from "../packages/learning-core/src/reviews.ts";
import { localDayAt } from "../packages/learning-core/src/study.ts";
const digest = async (text: string) =>
  createHash("sha256").update(text).digest("hex");
const start = Date.UTC(2026, 8, 1),
  now = Date.UTC(2026, 9, 14);
const card: ReviewCard = {
  id: "requests:1:water:reading",
  facet: "reading",
  source: "lesson",
  sourceId: "requests",
  sourceVersion: 1,
  label: "水",
  exercise: requestsLesson.exercises.find((e) => e.id === "reading-water")!,
};
async function root() {
  return introduceReview(card, start, digest);
}
function attempt(
  track: ReviewTrack,
  opp: ReviewOpportunity,
  id: string,
  input = "みず",
  time = opp.dueAt,
): ReviewAttempt {
  return {
    eventId: `event-${id}-000000`,
    sessionId: `session-${id}-0000`,
    deviceId: "device-test-0000",
    sequence: 1,
    algorithm: 1,
    trackId: track.id,
    opportunityId: opp.id,
    parentResolutionId: opp.parentResolutionId,
    ...(opp.parentEventId ? { parentEventId: opp.parentEventId } : {}),
    baseRevision: opp.revision,
    mode: "due",
    occurredAt: time,
    localDay: localDayAt(time, -330),
    timezone: "Asia/Calcutta",
    offsetMinutes: -330,
    input,
    support: [],
    spans: [],
  };
}
test("review identities match across devices and independent facets have different roots", async () => {
  const a = await root(),
    b = await root();
  assert.deepEqual(a, b);
  const meaning = await introduceReview(
    { ...card, id: "requests:1:water:meaning", facet: "meaning" },
    start,
    digest,
  );
  assert.notEqual(a.opportunity.id, meaning.opportunity.id);
  const event = attempt(a.track, a.opportunity, "same");
  assert.deepEqual(
    await decideReview(a.track, a.opportunity, undefined, event, digest),
    await decideReview(b.track, b.opportunity, undefined, event, digest),
  );
});
test("a current due answer closes exactly once; late failure cannot undo weeks of advancement", async () => {
  const initial = await root();
  let track = initial.track,
    opp = initial.opportunity;
  const first = await decideReview(
    track,
    opp,
    undefined,
    attempt(track, opp, "first"),
    digest,
  );
  assert.equal(first.receipt.status, "applied-to-schedule");
  assert.equal(first.track!.stage, 1);
  assert.equal(first.next!.dueAt, opp.dueAt + 8 * 3600000);
  track = first.track!;
  opp = first.next!;
  for (let i = 0; i < 6; i++) {
    const result = await decideReview(
      track,
      opp,
      undefined,
      attempt(track, opp, `next-${i}`),
      digest,
    );
    track = result.track!;
    opp = result.next!;
  }
  const earned = structuredClone(track);
  const stale = await decideReview(
    track,
    first.closed,
    undefined,
    attempt(initial.track, initial.opportunity, "stale", "sui", opp.dueAt),
    digest,
  );
  assert.equal(stale.receipt.status, "stale-practice");
  assert.equal(stale.receipt.assessment.outcome, "incorrect");
  assert.equal(stale.track, undefined);
  assert.deepEqual(track, earned);
});
test("the first accepted failure wins its opportunity; a later success is retained as stale practice", async () => {
  const { track, opportunity } = await root();
  const failed = await decideReview(
    track,
    opportunity,
    undefined,
    attempt(track, opportunity, "fail", "sui"),
    digest,
  );
  assert.equal(failed.track!.stage, 0);
  assert.equal(failed.track!.dueAt, opportunity.dueAt + 4 * 3600000);
  const success = await decideReview(
    failed.track!,
    failed.closed,
    undefined,
    attempt(track, opportunity, "late-good"),
    digest,
  );
  assert.equal(success.receipt.status, "stale-practice");
  assert.equal(success.receipt.assessment.outcome, "independent");
  assert.equal(success.next, undefined);
});
test("assisted due recall preserves stage; early, correction and same-session retries are practice only", async () => {
  const { track, opportunity } = await root();
  const aided = await decideReview(
    track,
    opportunity,
    undefined,
    { ...attempt(track, opportunity, "hint"), support: ["patternHint"] },
    digest,
  );
  assert.equal(aided.track!.stage, 0);
  assert.equal(aided.track!.qualifyingDays.length, 0);
  const early = await decideReview(
    track,
    opportunity,
    undefined,
    attempt(track, opportunity, "early", "みず", opportunity.dueAt - 1),
    digest,
  );
  assert.equal(early.receipt.status, "extra-practice");
  const retry = await decideReview(
    track,
    opportunity,
    undefined,
    { ...attempt(track, opportunity, "retry"), support: ["correctionRetry"] },
    digest,
  );
  assert.equal(retry.receipt.status, "extra-practice");
  const same = await decideReview(
    aided.track!,
    aided.next,
    undefined,
    {
      ...attempt(aided.track!, aided.next!, "same-session"),
      sessionId: "session-hint-0000",
    },
    digest,
  );
  assert.equal(same.receipt.status, "extra-practice");
});
test("valid multi-day offline chain accepts parent before child with identical successor identities", async () => {
  const initial = await root(),
    parent = attempt(initial.track, initial.opportunity, "parent");
  const first = await decideReview(
    initial.track,
    initial.opportunity,
    undefined,
    parent,
    digest,
  );
  const child = attempt(first.track!, first.next!, "child");
  const second = await decideReview(
    first.track!,
    first.next,
    first.receipt,
    child,
    digest,
  );
  assert.equal(second.track!.stage, 2);
  assert.deepEqual(
    orderReviewAttempts([child, parent]).map((e) => e.eventId),
    [parent.eventId, child.eventId],
  );
  const missing = await decideReview(
    initial.track,
    undefined,
    undefined,
    child,
    digest,
  );
  assert.equal(missing.receipt.status, "awaiting-parent");
  const restored = await decideReview(
    first.track!,
    first.next,
    first.receipt,
    child,
    digest,
    2,
  );
  assert.equal(restored.receipt.revision, 2);
  assert.equal(restored.receipt.resolutionId, second.receipt.resolutionId);
});
test("a conflicting offline branch and descendants retain answers without changing acknowledged schedule", async () => {
  const initial = await root(),
    offline = attempt(initial.track, initial.opportunity, "offline");
  const local = await decideReview(
    initial.track,
    initial.opportunity,
    undefined,
    offline,
    digest,
  );
  const child = attempt(local.track!, local.next!, "offline-child");
  const winner = await decideReview(
    initial.track,
    initial.opportunity,
    undefined,
    attempt(initial.track, initial.opportunity, "winner", "sui"),
    digest,
  );
  const lost = await decideReview(
    winner.track!,
    winner.closed,
    undefined,
    offline,
    digest,
  );
  const descendant = await decideReview(
    winner.track!,
    undefined,
    lost.receipt,
    child,
    digest,
  );
  assert.equal(lost.receipt.status, "stale-practice");
  assert.equal(descendant.receipt.status, "stale-practice");
  assert.equal(descendant.track, undefined);
  assert.equal(winner.track!.stage, 0);
});
test("romaji recall does not grant kana literacy and uncertain grammar keeps its opportunity open", async () => {
  const { track, opportunity } = await root();
  const roman = await decideReview(
    track,
    opportunity,
    undefined,
    attempt(track, opportunity, "roman", "mizu"),
    digest,
  );
  assert.equal(roman.receipt.assessment.kanaEvidence, false);
  assert.equal(roman.receipt.assessment.inputScript, "romaji");
  const grammar = await introduceReview(
    {
      ...card,
      id: "requests:1:grammar",
      facet: "grammar",
      exercise: requestsLesson.exercises.find((e) => e.id === "request-own")!,
    },
    start,
    digest,
  );
  const pending = await decideReview(
    grammar.track,
    grammar.opportunity,
    undefined,
    attempt(grammar.track, grammar.opportunity, "novel", "この本をください"),
    digest,
  );
  assert.equal(pending.receipt.status, "pending-assessment");
  assert.equal(pending.closed, undefined);
  assert.equal(grammar.opportunity.dueAt, start + 86400000);
});
test("mastery needs stage, distinct qualifying days and age; a current lapse clears only its qualifying run", async () => {
  const { track, opportunity } = await root();
  const days = [
    "2026-09-01",
    "2026-09-02",
    "2026-09-03",
    "2026-09-04",
    "2026-09-05",
  ];
  const strong = {
    ...track,
    stage: 6,
    independentDays: days,
    qualifyingDays: days,
  };
  assert.equal(hasStrongRecall(strong, now), true);
  assert.equal(
    hasStrongRecall({ ...strong, qualifyingDays: days.slice(0, 4) }, now),
    false,
  );
  assert.equal(hasStrongRecall(strong, start + 86400000), false);
  const lapse = await decideReview(
    strong,
    { ...opportunity, stage: 6 },
    undefined,
    attempt(strong, opportunity, "lapse", "sui"),
    digest,
  );
  assert.deepEqual(lapse.track!.independentDays, days);
  assert.deepEqual(lapse.track!.qualifyingDays, []);
  assert.equal(hasStrongRecall(lapse.track!, now), false);
});
test("forged parent snapshots, malformed dates, unsupported revisions and cycles cannot close a review", async () => {
  const { track, opportunity } = await root(),
    event = attempt(track, opportunity, "invalid");
  validateReviewAttempt(event, now);
  assert.throws(() =>
    validateReviewAttempt({ ...event, localDay: "2026-01-01" }, now),
  );
  assert.throws(() =>
    validateReviewAttempt({ ...event, baseRevision: -1 }, now),
  );
  const invalid = await decideReview(
    track,
    opportunity,
    undefined,
    { ...event, baseRevision: 2 },
    digest,
  );
  assert.equal(invalid.receipt.status, "invalid-with-reason");
  const child = {
    ...event,
    eventId: "cycle-child-0000",
    parentEventId: event.eventId,
  };
  assert.throws(() =>
    orderReviewAttempts([{ ...event, parentEventId: child.eventId }, child]),
  );
});
