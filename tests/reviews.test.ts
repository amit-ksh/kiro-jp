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
  projectReviews,
  reviewEarnsStreak,
  reviewQueue,
  type ReviewAttempt,
  type ReviewCard,
  type ReviewTrack,
  type ReviewOpportunity,
  type ReviewReceipt,
} from "../packages/learning-core/src/reviews.ts";
import { localDayAt } from "../packages/learning-core/src/study.ts";
import { assessNovelSentence } from "../packages/learning-core/src/sentence-assessment.ts";
const digest = async (text: string) =>
  createHash("sha256").update(text).digest("hex");

test("daily due selection retains pending answers without blocking other cards or rewriting schedules", async () => {
  const grammarCard: ReviewCard = {
    ...card,
    id: "grammar-daily-0000",
    facet: "grammar",
    exercise: requestsLesson.exercises.find((e) => e.kind === "sentence")!,
  };
  const pending = await introduceReview(grammarCard, start, digest);
  const event = attempt(
    pending.track,
    pending.opportunity,
    "pending-daily",
    "sono manga o kudasai",
    now,
  );
  const decision = await decideReview(
    pending.track,
    pending.opportunity,
    undefined,
    event,
    digest,
  );
  assert.equal(decision.receipt.assessment.outcome, "pending");
  const cards = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      introduceReview({ ...card, id: `daily-${i}` }, start + i, digest),
    ),
  );
  const tracks = [pending.track, ...cards.map((item) => item.track)];
  const original = JSON.stringify(tracks);
  const source = {
    tracks: tracks.toReversed(),
    attempts: [event],
    receipts: new Map([[event.eventId, decision.receipt]]),
  };
  const queue = reviewQueue(source, now);
  assert.deepEqual(
    queue.ready.map((item) => item.id),
    cards.map((item) => item.track.id),
  );
  assert.deepEqual(
    queue.awaitingFeedback.map((item) => item.id),
    [pending.track.id],
  );
  assert.equal(queue.ready.slice(0, 8).length, 8);
  assert.equal(queue.ready.slice(8).length, 2);
  assert.equal(JSON.stringify(tracks), original);
  assert.deepEqual(reviewQueue(source, start).ready, []);
  const invalid = {
    ...decision.receipt,
    status: "invalid-with-reason" as const,
  };
  assert.equal(
    reviewQueue(
      { ...source, receipts: new Map([[event.eventId, invalid]]) },
      now,
    ).ready.length,
    11,
  );
  const extra = { ...event, mode: "extra" as const };
  assert.equal(
    reviewQueue({ ...source, attempts: [extra] }, now).ready.length,
    11,
  );
  const changed = { ...pending.track, opportunityId: "next-daily-opportunity" };
  const moved = reviewQueue({ ...source, tracks: [changed] }, now);
  assert.equal(moved.ready.length, 1);
  assert.equal(moved.awaitingFeedback.length, 0);
});
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
  const grammarStrong = {
    ...strong,
    stage: 5,
    card: { ...strong.card, facet: "grammar" as const },
  };
  assert.equal(hasStrongRecall(grammarStrong, now), true);
  assert.equal(hasStrongRecall({ ...grammarStrong, stage: 4 }, now), false);
  assert.equal(hasStrongRecall({ ...strong, stage: 5 }, now), false);
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

test("offline projections keep delivered answers until canonical pull and never replay acknowledged closures by occurrence time", async () => {
  const initial = await root(),
    parent = attempt(initial.track, initial.opportunity, "overlay-parent");
  const first = await decideReview(
      initial.track,
      initial.opportunity,
      undefined,
      parent,
      digest,
    ),
    child = attempt(first.track!, first.next!, "overlay-child");
  const introduced = { kind: "introduced" as const, ...initial };
  const local = [
    { event: parent, acknowledged: false },
    { event: child, acknowledged: false },
  ];
  const offline = await projectReviews([introduced], local, [], digest);
  assert.equal(offline.tracks[0]!.stage, 2);
  assert(offline.provisional.has(card.id));
  const partially = await projectReviews(
    [introduced, { kind: "attempt", event: parent, ...first }],
    local,
    [],
    digest,
  );
  assert.equal(partially.tracks[0]!.stage, 2);
  assert(partially.provisional.has(card.id));
  const second = await decideReview(
    first.track!,
    first.next,
    first.receipt,
    child,
    digest,
  );
  const acknowledged = await projectReviews(
    [
      introduced,
      { kind: "attempt", event: parent, ...first },
      { kind: "attempt", event: child, ...second },
    ],
    local.map((row) => ({ ...row, acknowledged: true })),
    [],
    digest,
  );
  assert.equal(acknowledged.tracks[0]!.stage, 2);
  assert.equal(acknowledged.provisional.size, 0);
  const stale = attempt(
    initial.track,
    initial.opportunity,
    "old-overlay",
    "sui",
    initial.opportunity.dueAt - 1,
  );
  const merged = await projectReviews(
    [
      introduced,
      { kind: "attempt", event: parent, ...first },
      { kind: "attempt", event: child, ...second },
    ],
    [{ event: stale, acknowledged: false }],
    [],
    digest,
  );
  assert.equal(merged.tracks[0]!.stage, 2);
  assert.equal(merged.receipts.get(stale.eventId)!.status, "stale-practice");
});

test("canonical conflicting closure replaces only an unacknowledged branch and retains each attempt", async () => {
  const initial = await root(),
    local = attempt(initial.track, initial.opportunity, "divergent-local");
  const branch = await decideReview(
      initial.track,
      initial.opportunity,
      undefined,
      local,
      digest,
    ),
    child = attempt(branch.track!, branch.next!, "divergent-child");
  const winnerEvent = attempt(
      initial.track,
      initial.opportunity,
      "remote-winner",
      "sui",
    ),
    winner = await decideReview(
      initial.track,
      initial.opportunity,
      undefined,
      winnerEvent,
      digest,
    );
  const projection = await projectReviews(
    [
      { kind: "introduced", ...initial },
      { kind: "attempt", event: winnerEvent, ...winner },
    ],
    [
      { event: child, acknowledged: false },
      { event: local, acknowledged: false },
    ],
    [],
    digest,
  );
  assert.equal(projection.tracks[0]!.stage, 0);
  assert.equal(projection.attempts.length, 3);
  assert.equal(projection.provisional.size, 0);
  assert.equal(
    projection.receipts.get(local.eventId)!.status,
    "stale-practice",
  );
  assert.equal(
    projection.receipts.get(child.eventId)!.status,
    "stale-practice",
  );
});

test("a cached lesson introduction creates provisional offline cards without changing a server-owned introduction", async () => {
  const initial = await root();
  const offline = await projectReviews(
    [],
    [],
    [{ card, introducedAt: start }],
    digest,
  );
  assert.equal(offline.tracks[0]!.opportunityId, initial.opportunity.id);
  assert(offline.provisional.has(card.id));
  const returned = await projectReviews(
    [{ kind: "introduced", ...initial }],
    [],
    [{ card, introducedAt: start + 86400000 }],
    digest,
  );
  assert.equal(returned.tracks[0]!.introducedAt, start);
  assert.equal(returned.provisional.size, 0);
});

async function novelGrammar(id: string, input = "この本をください") {
  const grammar = await introduceReview(
    {
      ...card,
      id: "requests:1:request-kudasai:grammar",
      facet: "grammar",
      exercise: requestsLesson.exercises.find((e) => e.id === "request-own")!,
    },
    start,
    digest,
  );
  const event = attempt(grammar.track, grammar.opportunity, id, input);
  const assessment = assessNovelSentence(
    grammar.track.card.exercise,
    { id: event.eventId, input, support: event.support },
    {
      messageId: event.eventId,
      validity: "appropriate",
      meaningfulJapanese: true,
      target: "used",
      span: input,
      explanation:
        "The item is followed by をください to make a polite request.",
    },
  );
  return { ...grammar, event, assessment };
}
test("a source-bound delayed grammar grade closes only its still-open opportunity", async () => {
  const value = await novelGrammar("delayed-grade"),
    pending = await decideReview(
      value.track,
      value.opportunity,
      undefined,
      value.event,
      digest,
    );
  assert.equal(pending.receipt.status, "pending-assessment");
  assert.equal(pending.track, undefined);
  const checked = await decideReview(
    value.track,
    value.opportunity,
    undefined,
    value.event,
    digest,
    4,
    value.assessment,
  );
  assert.equal(checked.receipt.status, "applied-to-schedule");
  assert.equal(checked.track!.stage, 1);
  assert.equal(checked.track!.dueAt, value.event.occurredAt + 3 * 86400000);
  assert.deepEqual(checked.track!.qualifyingDays, [value.event.localDay]);
  assert.equal(checked.receipt.assessment.kanaEvidence, false);
});
test("a late appropriate grade retains its language evidence without replacing a competing closure", async () => {
  const value = await novelGrammar("late-grade"),
    winnerEvent = attempt(
      value.track,
      value.opportunity,
      "fixed-winner",
      "本をください",
    );
  const winner = await decideReview(
    value.track,
    value.opportunity,
    undefined,
    winnerEvent,
    digest,
  );
  const late = await decideReview(
    winner.track!,
    winner.closed,
    undefined,
    value.event,
    digest,
    4,
    value.assessment,
  );
  assert.equal(late.receipt.status, "stale-practice");
  assert.equal(late.receipt.assessment.outcome, "independent");
  assert.equal(late.track, undefined);
  assert.equal(winner.closed!.resolution!.eventId, winnerEvent.eventId);
});
test("crossed semantic input cannot grade another answer; corrected retries remain extra practice", async () => {
  const value = await novelGrammar("bound-grade");
  const crossed = await decideReview(
    value.track,
    value.opportunity,
    undefined,
    value.event,
    digest,
    4,
    { ...value.assessment, normalized: "another answer" },
  );
  assert.equal(crossed.receipt.status, "pending-assessment");
  const wrongExpected = await decideReview(
    value.track,
    value.opportunity,
    undefined,
    value.event,
    digest,
    4,
    { ...value.assessment, expected: "another pattern" },
  );
  assert.equal(wrongExpected.receipt.status, "pending-assessment");
  const assisted = { ...value.event, support: ["correctionRetry" as const] };
  const retry = await decideReview(
    value.track,
    value.opportunity,
    undefined,
    assisted,
    digest,
    4,
    value.assessment,
  );
  assert.equal(retry.receipt.status, "extra-practice");
  assert.equal(retry.receipt.assessment.outcome, "assisted");
  assert.equal(retry.track, undefined);
});
test("resolved missing-parent feedback survives provisional replay and later canonical classification", async () => {
  const value = await novelGrammar("grammar-root", "水をください"),
    parent = await decideReview(
      value.track,
      value.opportunity,
      undefined,
      value.event,
      digest,
    );
  const child = attempt(
    parent.track!,
    parent.next!,
    "grammar-child",
    "この本をください",
  );
  const assessment = assessNovelSentence(
    parent.track!.card.exercise,
    { id: child.eventId, input: child.input!, support: [] },
    {
      messageId: child.eventId,
      validity: "appropriate",
      meaningfulJapanese: true,
      target: "used",
      span: child.input!,
      explanation: "A polite request using the target pattern.",
    },
  );
  const waiting = await decideReview(
    value.track,
    undefined,
    undefined,
    child,
    digest,
    4,
    assessment,
  );
  waiting.receipt.feedback = { status: "ready", attempt: 1, updatedAt: now };
  assert.equal(waiting.receipt.status, "awaiting-parent");
  const projection = await projectReviews(
    [
      {
        kind: "introduced",
        track: value.track,
        opportunity: value.opportunity,
      },
      { kind: "attempt", event: child, ...waiting },
      { kind: "attempt", event: value.event, ...parent },
    ],
    [{ event: child, acknowledged: true }],
    [],
    digest,
  );
  assert.equal(projection.tracks[0]!.stage, 2);
  assert(projection.provisional.has(value.track.id));
  assert.equal(
    projection.receipts.get(child.eventId)!.feedback!.status,
    "ready",
  );
  const accepted = await decideReview(
    parent.track!,
    parent.next,
    parent.receipt,
    child,
    digest,
    5,
    assessment,
  );
  assert.equal(accepted.receipt.status, "applied-to-schedule");
});

test("a completed pending review earns effort credit without claiming skill or mastery", async () => {
  const value = await novelGrammar("effort-not-grade"),
    pending = await decideReview(
      value.track,
      value.opportunity,
      undefined,
      value.event,
      digest,
    );
  assert.equal(reviewEarnsStreak(value.event, pending.receipt), true);
  assert.equal(pending.receipt.assessment.outcome, "pending");
  assert.equal(pending.track, undefined);
  assert.equal(hasStrongRecall(value.track, now), false);
  assert.equal(
    reviewEarnsStreak(
      { ...value.event, input: "  ", dontKnow: false },
      pending.receipt,
    ),
    false,
  );
  assert.equal(
    reviewEarnsStreak(
      { ...value.event, input: "", dontKnow: true },
      pending.receipt,
    ),
    true,
  );
  assert.equal(reviewEarnsStreak(value.event, undefined), false);
  assert.equal(
    reviewEarnsStreak(value.event, {
      ...pending.receipt,
      status: "stale-practice",
    }),
    true,
  );
});
