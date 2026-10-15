import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { directionsLesson } from "../packages/content/src/directions.ts";
import { checkPreparedLesson } from "../packages/learning-core/src/content-check.ts";
import { assessFixed } from "../packages/learning-core/src/lesson.ts";
import {
  lessonReviewIntroductions,
  introduceReview,
  decideReview,
  type ReviewAttempt,
} from "../packages/learning-core/src/reviews.ts";
import {
  sessionProjection,
  type StudyEvent,
} from "../packages/learning-core/src/study.ts";
const lesson = directionsLesson,
  now = Date.UTC(2026, 9, 14, 8);
const digest = async (text: string) =>
  createHash("sha256").update(text).digest("hex");
function exercise(id: string) {
  return lesson.exercises.find((e) => e.id === id)!;
}
function events(stepId: string, input: string): StudyEvent[] {
  const base = {
    sessionId: "directions-test-session",
    deviceId: "directions-test-device",
    lessonId: lesson.id,
    lessonVersion: 1,
    occurredAt: now,
    localDay: "2026-10-14",
    offsetMinutes: 0,
    timezone: "UTC",
    support: [],
    spans: [],
  };
  return [
    {
      ...base,
      eventId: "directions-start-event",
      sequence: 1,
      kind: "started",
      stepId: "goal",
      context: {
        theme: "Shrines",
        band: "foundations",
        furigana: true,
        romaji: true,
        translations: true,
      },
    },
    {
      ...base,
      eventId: "directions-answer-event",
      sequence: 2,
      kind: "attempted",
      stepId,
      input,
    },
    {
      ...base,
      eventId: "directions-advance-event",
      sequence: 3,
      kind: "advanced",
      stepId,
    },
  ];
}
test("directions contains checked original exercises, complete breakdowns and its approved four kanji", () => {
  assert.deepEqual(checkPreparedLesson(lesson), []);
  assert.deepEqual(
    lesson.words.map((w) => w.kanji),
    ["入", "出", "右", "左"],
  );
  assert.deepEqual(
    lesson.words.map((w) => w.reading),
    ["いりぐち", "でぐち", "みぎ", "ひだり"],
  );
  for (const e of lesson.exercises)
    for (const answer of [...e.accepted, ...(e.romaji ?? [])])
      assert(
        ["independent", "assisted"].includes(
          assessFixed(e, answer, []).outcome,
        ),
        `${e.id}: ${answer}`,
      );
  assert(
    lesson.grammar.examples.every((s) =>
      s.segments.some((p) => p.grammar === lesson.grammar.id),
    ),
  );
});
test("kanji enter, the whole-word entrance meaning and its reading are independent questions", () => {
  assert.equal(
    assessFixed(exercise("meaning-entrance"), "enter", []).outcome,
    "independent",
  );
  assert.equal(
    assessFixed(exercise("meaning-entrance"), "entrance", []).outcome,
    "incorrect",
  );
  assert.equal(
    assessFixed(exercise("vocabulary-entrance"), "entrance", []).outcome,
    "independent",
  );
  assert.equal(
    assessFixed(exercise("vocabulary-entrance"), "enter", []).outcome,
    "incorrect",
  );
  const reading = assessFixed(exercise("reading-entrance"), "iriguchi", []);
  assert.equal(reading.outcome, "independent");
  assert.equal(reading.kanaEvidence, false);
  assert.equal(
    assessFixed(exercise("reading-entrance"), "nyuu", []).outcome,
    "incorrect",
  );
});
test("location practice accepts approved Japanese and romaji, preserves assistance and recognizes another valid pattern", () => {
  for (const input of [
    "入口はどこですか。",
    "出口はどこですか",
    "いりぐちはどこですか",
    "iriguchi wa doko desu ka",
  ]) {
    const a = assessFixed(exercise("location-own"), input, []);
    assert.equal(a.outcome, "independent");
    assert.equal(a.targetObserved, true);
  }
  assert.equal(
    assessFixed(exercise("location-own"), "iriguchi wa doko desu ka", [
      "wordBank",
    ]).outcome,
    "assisted",
  );
  const other = assessFixed(
    exercise("location-own"),
    "入口はどこにありますか",
    [],
  );
  assert.equal(other.outcome, "validAlternative");
  assert.equal(other.targetObserved, false);
  assert.equal(
    assessFixed(exercise("location-own"), "神社はどこですか", []).outcome,
    "pending",
  );
});
test("vocabulary meaning introduces its own review track without awarding kanji, reading or grammar knowledge", async () => {
  const source = events("vocabulary-entrance", "entrance"),
    projection = sessionProjection(lesson, source);
  assert.deepEqual(projection.initiallyLearned, []);
  assert.equal(projection.grammarState, "notObserved");
  const intros = lessonReviewIntroductions(lesson, source);
  assert.equal(intros.length, 1);
  assert.equal(intros[0]!.card.id, "directions:1:entrance:vocabulary-meaning");
  assert.equal(intros[0]!.card.label, "入口");
  const intro = await introduceReview(intros[0]!.card, now, digest);
  const attempt: ReviewAttempt = {
    eventId: "vocabulary-review-test",
    sessionId: "vocabulary-review-session",
    deviceId: "directions-test-device",
    sequence: 1,
    algorithm: 1,
    trackId: intro.track.id,
    opportunityId: intro.opportunity.id,
    parentResolutionId: intro.track.parentResolutionId,
    baseRevision: intro.track.revision,
    mode: "due",
    input: "entrance",
    support: [],
    spans: [],
    occurredAt: intro.track.dueAt,
    localDay: "2026-10-14",
    offsetMinutes: 0,
    timezone: "UTC",
  };
  const result = await decideReview(
    intro.track,
    intro.opportunity,
    undefined,
    attempt,
    digest,
  );
  assert.equal(result.receipt.status, "applied-to-schedule");
  assert.equal(result.track!.id, intro.track.id);
  assert.equal(result.track!.stage, 1);
});
test("a compound gloss cannot pass the content gate without its own approved meaning exercise", () => {
  const missing = {
    ...lesson,
    exercises: lesson.exercises.filter((e) => e.id !== "vocabulary-entrance"),
  };
  assert(
    checkPreparedLesson(missing).some((e) =>
      e.includes("separate vocabulary meaning: entrance"),
    ),
  );
});
