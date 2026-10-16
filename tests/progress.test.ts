import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { learningProgress } from "../packages/learning-core/src/progress.ts";
import { curriculum } from "../packages/content/src/curriculum.ts";
import { requestsLesson } from "../packages/content/src/requests.ts";
import { tryLesson } from "../packages/content/src/try.ts";
import { assessFixed } from "../packages/learning-core/src/lesson.ts";
import {
  introduceReview,
  decideReview,
  type ReviewCard,
  type ReviewAttempt,
} from "../packages/learning-core/src/reviews.ts";
import {
  splitStudySpan,
  type StudyEvent,
} from "../packages/learning-core/src/study.ts";
const today = "2026-10-15";
let sequence = 0;
function event(patch: Partial<StudyEvent> = {}): StudyEvent {
  const id = ++sequence;
  return {
    eventId: `progress-event-${id}`,
    deviceId: "progress-device",
    sessionId: "progress-session",
    sequence: id,
    lessonId: "requests",
    lessonVersion: 1,
    occurredAt: Date.parse(`${today}T12:00:00Z`) + id,
    localDay: today,
    timezone: "UTC",
    offsetMinutes: 0,
    kind: "attempted",
    stepId: "meaning-water",
    input: "water",
    support: [],
    spans: [],
    ...patch,
  };
}
const emptyReviews = () => ({ tracks: [], attempts: [], receipts: new Map() });

function introducedWord(
  lesson: typeof requestsLesson,
  wordId: string,
  sessionId: string,
) {
  return ["meaning", "reading"].map((facet) =>
    event({
      kind: "advanced",
      input: undefined,
      lessonId: lesson.id,
      lessonVersion: lesson.version,
      sessionId,
      stepId: `${facet}-${wordId}`,
    }),
  );
}

test("learning totals count distinct kanji and vocabulary across sessions and recall facets", () => {
  const first = introducedWord(requestsLesson, "book", "first-book-session");
  const repeated = introducedWord(
    requestsLesson,
    "book",
    "repeat-book-session",
  );
  const result = progress([...first, ...first, ...repeated]);
  assert.deepEqual(result.inventory.kanji, ["本"]);
  assert.deepEqual(result.inventory.vocabulary, ["本（ほん）"]);
  assert.equal(result.inventory.grammar.length, 0);
});

test("a shown word or meaning-only exercise does not inflate introduced kanji and vocabulary", () => {
  const result = progress([
    event({ kind: "studied", stepId: "teach-water" }),
    event({ kind: "advanced", stepId: "meaning-water" }),
    event({ stepId: "reading-water", input: "mizu" }),
  ]);
  assert.deepEqual(result.inventory.kanji, []);
  assert.deepEqual(result.inventory.vocabulary, []);
});

test("review history restores item totals without treating one recall facet or an unknown source as learned", async () => {
  const exercise = (id: string) =>
    requestsLesson.exercises.find((item) => item.id === id)!;
  const card = (facet: "meaning" | "reading"): ReviewCard => ({
    id: `requests:1:water:${facet}`,
    source: "lesson",
    sourceId: "requests",
    sourceVersion: 1,
    facet,
    label: "水",
    exercise: exercise(`${facet}-water`),
  });
  const meaning = await introduceReview(
    card("meaning"),
    Date.parse(`${today}T09:00:00Z`),
    digest,
  );
  const reading = await introduceReview(
    card("reading"),
    Date.parse(`${today}T09:00:00Z`),
    digest,
  );
  assert.equal(
    progress([], { reviews: { ...emptyReviews(), tracks: [meaning.track] } })
      .inventory.kanji.length,
    0,
  );
  const result = progress([], {
    reviews: {
      ...emptyReviews(),
      tracks: [
        meaning.track,
        reading.track,
        reading.track,
        {
          ...meaning.track,
          card: { ...meaning.track.card, sourceId: "not-real" },
        },
      ],
    },
  });
  assert.deepEqual(result.inventory.kanji, ["水"]);
  assert.deepEqual(result.inventory.vocabulary, ["水（みず）"]);
});

test("grammar totals require an assessed target sentence and completed exercise; pending work stays pending", () => {
  const own = requestsLesson.exercises.find(
    (item) => item.kind === "sentence",
  )!;
  const pending = [
    event({ stepId: own.id, input: "新しい文です" }),
    event({ kind: "advanced", stepId: own.id }),
  ];
  assert.equal(progress(pending).inventory.grammar.length, 0);
  const successful = [
    event({ stepId: own.id, input: own.accepted[0] }),
    event({ kind: "advanced", stepId: own.id }),
  ];
  assert.deepEqual(progress(successful).inventory.grammar, [
    requestsLesson.grammar.pattern,
  ]);
  assert.equal(progress([successful[0]!]).inventory.grammar.length, 0);
});
function progress(
  events: StudyEvent[],
  extra: Partial<Parameters<typeof learningProgress>[0]> = {},
) {
  return learningProgress({
    today,
    dailyMinutes: 15,
    events,
    curriculum,
    reviews: emptyReviews(),
    ...extra,
  });
}
const digest = async (text: string) =>
  createHash("sha256").update(text).digest("hex");
async function review(input: string, patch: Partial<ReviewAttempt> = {}) {
  const exercise = requestsLesson.exercises.find(
    (e) => e.id === "meaning-water",
  )!;
  const card: ReviewCard = {
    id: "requests:1:water:meaning",
    source: "lesson",
    sourceId: "requests",
    sourceVersion: 1,
    facet: "meaning",
    label: "水",
    exercise,
  };
  const initial = await introduceReview(
    card,
    Date.parse("2026-10-01T12:00:00Z"),
    digest,
  );
  const stamp = event();
  const attempt: ReviewAttempt = {
    eventId: stamp.eventId,
    sessionId: stamp.sessionId,
    deviceId: stamp.deviceId,
    sequence: stamp.sequence,
    occurredAt: stamp.occurredAt,
    localDay: stamp.localDay,
    timezone: stamp.timezone,
    offsetMinutes: 0,
    input,
    support: [],
    spans: [],
    algorithm: 1,
    trackId: card.id,
    opportunityId: initial.opportunity.id,
    parentResolutionId: initial.track.parentResolutionId,
    baseRevision: 0,
    mode: "due",
    ...patch,
  };
  const decision = await decideReview(
    initial.track,
    initial.opportunity,
    undefined,
    attempt,
    digest,
  );
  return {
    track: decision.track ?? initial.track,
    attempt,
    receipt: decision.receipt,
  };
}

test("six active minutes and a partial wrong review earn a streak day separately from a fifteen-minute goal", async () => {
  const base = Date.parse(`${today}T10:00:00Z`);
  const events = Array.from({ length: 12 }, (_, i) =>
    event({
      kind: "activity",
      input: undefined,
      occurredAt: base + (i + 1) * 30_000,
      spans: splitStudySpan(base + i * 30_000, base + (i + 1) * 30_000, 0),
    }),
  );
  const r = await review("fire");
  const result = progress([...events, ...events], {
    reviews: {
      tracks: [r.track],
      attempts: [r.attempt, r.attempt],
      receipts: new Map([[r.attempt.eventId, r.receipt]]),
    },
  });
  assert.equal(result.today.milliseconds, 360_000);
  assert.equal(result.today.meaningful, true);
  assert.equal(result.today.goalMet, false);
  assert.equal(result.streak, 1);
  assert.equal(result.skills.meaning.incorrect, 1);
  assert.deepEqual(result.suggestions, []);
});

test("overlapping listening, speaking, conversation and another device count once without inventing graded skills", () => {
  const end = Date.parse(`${today}T12:00:00Z`);
  const spans = splitStudySpan(end - 20_000, end, 0);
  const listening = event({ kind: "audioActivity", input: "listening", spans });
  const speaking = event({ kind: "audioActivity", input: "speaking", spans });
  const conversation = event({
    kind: "conversationActivity",
    lessonId: "conversation",
    stepId: "chat",
    input: undefined,
    spans,
  });
  const result = progress([
    listening,
    speaking,
    conversation,
    {
      ...listening,
      eventId: "second-device-audio",
      deviceId: "another-device",
    },
  ]);
  assert.equal(result.weeklyMilliseconds, 20_000);
  assert.equal(result.listeningMilliseconds, 20_000);
  assert.equal(result.speakingMilliseconds, 20_000);
  assert.equal(result.streak, 0);
  assert.equal(result.skills.grammar.independent, 0);
});

test("offline original days survive midnight and late delivery, with yesterday's streak still live today", () => {
  const end = Date.UTC(2026, 9, 14, 18, 30, 10),
    offsetMinutes = -330;
  const spans = splitStudySpan(end - 20_000, end, offsetMinutes);
  const audio = event({
    kind: "audioActivity",
    input: "listening",
    occurredAt: end,
    spans,
    offsetMinutes,
    timezone: "Asia/Calcutta",
  });
  const answer = event({
    occurredAt: end - 20_000,
    localDay: "2026-10-14",
    offsetMinutes,
    timezone: "Asia/Calcutta",
    input: "wrong",
  });
  const result = progress([audio, answer, audio]);
  assert.equal(
    result.days.find((day) => day.day === "2026-10-14")!.milliseconds,
    10_000,
  );
  assert.equal(result.today.milliseconds, 10_000);
  assert.equal(result.today.meaningful, false);
  assert.equal(result.streak, 1);
  assert.deepEqual(result.earnedDays, ["2026-10-14"]);
});

test("romaji reading recall, explicit kana answers and supported practice retain separate evidence", () => {
  const kana = requestsLesson.exercises.find((item) => item.facet === "kana")!;
  const result = progress([
    event({ stepId: "reading-water", input: "mizu" }),
    event({ stepId: kana.id, input: kana.accepted[0] }),
    event({
      sessionId: "supported-session",
      input: "water",
      support: ["wordBank"],
    }),
    event({ stepId: "request-own", input: "koohii o kudasai" }),
  ]);
  assert.equal(result.skills.reading.independent, 1);
  assert.equal(result.skills.reading.romaji, 1);
  assert.equal(result.skills.reading.kanaEvidence, 0);
  assert.equal(result.skills.kana.kanaEvidence, 1);
  assert.equal(result.skills.meaning.assisted, 1);
});

test("pending and unavailable lesson feedback retain time without becoming errors or meaningful-step evidence", () => {
  const own = requestsLesson.exercises.find((e) => e.kind === "sentence")!;
  const pending = event({ stepId: own.id, input: "koohii o kudasai" });
  const fixed = assessFixed(own, pending.input!, []);
  assert.equal(fixed.outcome, "pending");
  const awaiting = progress([pending]);
  assert.equal(awaiting.skills.grammar.pending, 1);
  assert.equal(awaiting.streak, 0);
  const unavailable = progress([pending], {
    checked: { [pending.eventId]: { ...fixed, outcome: "unassessed" } },
  });
  assert.equal(unavailable.skills.grammar.unassessed, 1);
  assert.equal(unavailable.skills.grammar.incorrect, 0);
  assert.equal(unavailable.streak, 0);
  assert.deepEqual(unavailable.suggestions, []);
});

test("recurrence requires different sessions; an independent success resolves older misses", () => {
  const first = event({ input: "fire" });
  const repeated = event({ input: "fire" });
  assert.deepEqual(progress([first, repeated]).suggestions, []);
  const second = event({
    sessionId: "another-practice-session",
    input: "fire",
  });
  const recurring = progress([first, repeated, second]);
  assert.equal(recurring.suggestions.length, 1);
  assert.equal(recurring.suggestions[0]!.sessions, 2);
  const success = event({
    sessionId: "independent-return-session",
    input: "water",
  });
  assert.deepEqual(
    progress([first, repeated, second, success]).suggestions,
    [],
  );
});

test("lesson and review misses share the real card while recall schedules remain untouched", async () => {
  const first = event({
    input: "fire",
    occurredAt: Date.parse(`${today}T10:00:00Z`),
  });
  const r = await review("fire", { sessionId: "later-review-session" });
  const before = JSON.stringify(r.track);
  const result = progress([first], {
    reviews: {
      tracks: [r.track],
      attempts: [r.attempt],
      receipts: new Map([[r.attempt.eventId, r.receipt]]),
    },
  });
  assert.equal(result.suggestions.length, 1);
  assert.equal(result.suggestions[0]!.trackId, r.track.id);
  assert.equal(result.suggestions[0]!.sessions, 2);
  assert.equal(JSON.stringify(r.track), before);
});

test("kanji and full-verb meaning mistakes cannot clear each other's recommendations", () => {
  const base = { lessonId: tryLesson.id, lessonVersion: 1 };
  const result = progress([
    event({
      ...base,
      sessionId: "first-word-session",
      stepId: "vocabulary-eat",
      input: "meal",
    }),
    event({
      ...base,
      sessionId: "second-word-session",
      stepId: "vocabulary-eat",
      input: "meal",
    }),
    event({
      ...base,
      sessionId: "kanji-meaning-session",
      stepId: "meaning-eat",
      input: "meal",
    }),
  ]);
  assert.equal(result.skills.meaning.incorrect, 2);
  assert.equal(result.skills.meaning.independent, 1);
  assert.equal(result.suggestions.length, 1);
  assert.equal(result.suggestions[0]!.label, "食べる");
});

test("empty activity has no credit and the seven-day calendar crosses year boundaries exactly", () => {
  const result = progress([], { today: "2027-01-01" });
  assert.deepEqual(
    result.days.map((day) => day.day),
    [
      "2026-12-26",
      "2026-12-27",
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
    ],
  );
  assert.equal(result.weeklyMilliseconds, 0);
  assert.equal(result.streak, 0);
  assert.throws(() => progress([], { today: "2026-02-30" }));
  assert.equal(result.days[0]!.goalMet, null);
});

test("recognizing a grammar answer does not resolve recurring own-sentence errors", () => {
  const own = requestsLesson.exercises.find((e) => e.kind === "sentence")!;
  const choice = requestsLesson.exercises.find(
    (e) => e.facet === "grammar" && e.kind === "choice",
  )!;
  const a = event({
    sessionId: "first-own-sentence",
    stepId: own.id,
    input: "mizu ga kudasai",
  });
  const b = event({
    sessionId: "second-own-sentence",
    stepId: own.id,
    input: "mizu ga kudasai",
  });
  const correct = event({
    sessionId: "guided-recognition",
    stepId: choice.id,
    input: choice.accepted[0],
  });
  const checked = Object.fromEntries(
    [a, b].map((e) => [
      e.eventId,
      {
        ...assessFixed(own, e.input!, []),
        outcome: "incorrect" as const,
        targetObserved: false,
      },
    ]),
  );
  const result = progress([a, b, correct], { checked });
  assert.equal(result.suggestions.length, 1);
  assert.equal(result.suggestions[0]!.facet, "grammar");
  assert.equal(result.suggestions[0]!.sessions, 2);
});

test("streaks preserve consecutive original days through today's grace period and a later gap", () => {
  const events = ["2026-10-13", "2026-10-14", "2026-10-15"].map((day) =>
    event({
      sessionId: `practice-${day}`,
      localDay: day,
      occurredAt: Date.parse(`${day}T12:00:00Z`),
    }),
  );
  assert.equal(progress(events).streak, 3);
  assert.equal(progress(events, { today: "2026-10-16" }).streak, 3);
  const later = progress(events, { today: "2026-10-17" });
  assert.equal(later.streak, 0);
  assert.deepEqual(later.earnedDays, [
    "2026-10-13",
    "2026-10-14",
    "2026-10-15",
  ]);
});

test("weekly time counts a simultaneous interval once even when device timezones disagree on its calendar day", () => {
  const end = Date.UTC(2026, 9, 14, 20, 0, 0);
  const utc = event({
    kind: "audioActivity",
    input: "listening",
    occurredAt: end,
    localDay: "2026-10-14",
    offsetMinutes: 0,
    spans: splitStudySpan(end - 20_000, end, 0),
  });
  const india = event({
    kind: "audioActivity",
    input: "listening",
    occurredAt: end,
    localDay: "2026-10-15",
    offsetMinutes: -330,
    timezone: "Asia/Calcutta",
    spans: splitStudySpan(end - 20_000, end, -330),
  });
  const original = JSON.stringify([utc, india]);
  const result = progress([utc, india]);
  assert.equal(result.weeklyMilliseconds, 20_000);
  assert.equal(result.listeningMilliseconds, 20_000);
  assert.equal(result.today.milliseconds, 20_000);
  assert.equal(JSON.stringify([utc, india]), original);
});
