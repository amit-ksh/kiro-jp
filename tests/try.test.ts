import { test } from "node:test";
import assert from "node:assert/strict";
import { tryLesson as lesson } from "../packages/content/src/try.ts";
import { authoringCurriculum } from "../packages/content/src/authoring.ts";
import { curriculum } from "../packages/content/src/curriculum.ts";
import { checkPreparedLesson } from "../packages/learning-core/src/content-check.ts";
import {
  assessFixed,
  normalizeJapanese,
} from "../packages/learning-core/src/lesson.ts";
import { lessonEntry } from "../packages/learning-core/src/lesson-entry.ts";
import { lessonConversationTarget } from "../packages/learning-core/src/lesson-target.ts";
import { assessNovelSentence } from "../packages/learning-core/src/sentence-assessment.ts";
import { lessonReviewIntroductions } from "../packages/learning-core/src/reviews.ts";
import {
  sessionProjection,
  type StudyEvent,
} from "../packages/learning-core/src/study.ts";
const exercise = (id: string) => lesson.exercises.find((e) => e.id === id)!;

test("the final four-kanji candidate has checked breakdowns and explicit supported prerequisite forms", () => {
  assert.deepEqual(checkPreparedLesson(lesson), []);
  assert.deepEqual(
    lesson.words.map((w) => w.kanji),
    ["買", "作", "食", "見"],
  );
  assert.equal(lesson.exercises.length, 19);
  assert.equal(authoringCurriculum.get("try", 1), lesson);
  assert.equal(curriculum.get("try"), undefined);
  assert(
    authoringCurriculum.get(
      lesson.entry!.prerequisite.lessonId,
      lesson.entry!.prerequisite.version,
    ),
  );
  for (const item of lesson.exercises)
    for (const answer of [...item.accepted, ...(item.romaji ?? [])])
      assert(
        ["independent", "assisted"].includes(
          assessFixed(item, answer, []).outcome,
        ),
        `${item.id}: ${answer}`,
      );
  for (const sentence of [
    ...lesson.words.map((w) => w.example),
    ...lesson.grammar.examples,
    ...lesson.entry!.support.examples,
  ]) {
    assert.equal(
      sentence.segments.map((s) => s.text).join(""),
      sentence.text,
      sentence.id,
    );
    assert.equal(
      normalizeJapanese(sentence.segments.map((s) => s.reading).join("")),
      normalizeJapanese(sentence.reading),
      sentence.id,
    );
  }
  assert(lessonEntry(lesson, "early-n4").allowed);
  assert.equal(lessonEntry(lesson, "foundations").allowed, false);
});

test("try keeps dictionary readings, te-form practice and kana literacy distinct", () => {
  for (const [id, kana, roman, wrong] of [
    ["buy", "かう", "kau", "かって"],
    ["make", "つくる", "tsukuru", "つくって"],
    ["eat", "たべる", "taberu", "たべて"],
    ["watch", "みる", "miru", "みて"],
  ]) {
    const e = exercise(`reading-${id}`);
    assert.equal(assessFixed(e, kana!, []).outcome, "independent");
    assert.equal(assessFixed(e, roman!, []).outcome, "independent");
    assert.equal(assessFixed(e, roman!, []).kanaEvidence, false);
    assert.equal(assessFixed(e, wrong!, []).outcome, "incorrect");
  }
  assert.equal(
    assessFixed(exercise("meaning-eat"), "meal", []).outcome,
    "independent",
  );
  assert.equal(
    assessFixed(exercise("vocabulary-eat"), "meal", []).outcome,
    "incorrect",
  );
  for (const wrong of ["作て", "作る"])
    assert.equal(
      assessFixed(exercise("try-te-form"), wrong, []).outcome,
      "incorrect",
    );
  assert.equal(
    assessFixed(exercise("try-te-form"), "作って", []).outcome,
    "independent",
  );
});

test("try accepts actions, wishes and replies with approved romaji while ordinary watching stays a different pattern", () => {
  const e = exercise("try-own");
  for (const input of [
    "このマンガを買ってみます",
    "onigiri wo tsukutte mimasu",
    "ラーメンを食べてみたいです",
    "hai tsukutte mimasu",
  ]) {
    const result = assessFixed(e, input, []);
    assert.equal(result.outcome, "independent");
    assert(result.targetObserved);
    assert.equal(assessFixed(e, input, ["patternHint"]).outcome, "assisted");
  }
  for (const input of ["アニメを見ます", "raamen o tabetai desu"]) {
    const result = assessFixed(e, input, []);
    assert.equal(result.outcome, "validAlternative");
    assert.equal(result.targetObserved, false);
  }
  const target = lessonConversationTarget(lesson)!;
  assert(target.forms.includes("てみます"));
  assert(target.forms.includes("てみたいです"));
  assert(!target.forms.includes("みます"));
});

test("novel try feedback requires the actual source and te-form target rather than literal see/watch", () => {
  const e = exercise("try-own"),
    input = "manga o katte mitai desu",
    source = { id: "novel-try-source", input, support: [] };
  const semantic = {
    messageId: source.id,
    validity: "appropriate" as const,
    target: "used" as const,
    span: input,
    meaningfulJapanese: true,
    explanation: "The learner expresses wanting to try buying manga.",
  };
  assert.equal(assessFixed(e, input, []).outcome, "pending");
  assert.equal(
    assessNovelSentence(e, source, semantic, lesson).outcome,
    "independent",
  );
  assert.equal(
    assessNovelSentence(
      e,
      source,
      { ...semantic, messageId: "different-source" },
      lesson,
    ).outcome,
    "pending",
  );
  assert.equal(
    assessNovelSentence(
      e,
      source,
      { ...semantic, span: "not in the response" },
      lesson,
    ).outcome,
    "pending",
  );
  const plain = { ...source, input: "anime o mimasu" };
  assert.equal(
    assessNovelSentence(e, plain, { ...semantic, span: plain.input }, lesson)
      .targetObserved,
    false,
  );
});

test("try creates separate word and grammar tracks, with a distinct full-verb meaning and saved phrase", () => {
  const start: StudyEvent = {
    eventId: "try-start-event",
    sessionId: "try-test-session",
    deviceId: "try-test-device",
    sequence: 1,
    lessonId: "try",
    lessonVersion: 1,
    kind: "started",
    stepId: "goal",
    occurredAt: Date.UTC(2026, 9, 15),
    localDay: "2026-10-15",
    timezone: "UTC",
    offsetMinutes: 0,
    support: [],
    spans: [],
    context: {
      theme: "Food",
      band: "early-n4",
      furigana: true,
      romaji: true,
      translations: true,
    },
  };
  const events: StudyEvent[] = [start];
  let sequence = 2;
  for (const e of lesson.exercises) {
    events.push({
      ...start,
      context: undefined,
      eventId: `attempt-${e.id}`,
      sequence: sequence++,
      kind: "attempted",
      stepId: e.id,
      input: e.accepted[0],
    });
    events.push({
      ...start,
      context: undefined,
      eventId: `advance-${e.id}`,
      sequence: sequence++,
      kind: "advanced",
      stepId: e.id,
    });
  }
  assert.equal(sessionProjection(lesson, events).grammarState, "independent");
  const initial = lessonReviewIntroductions(lesson, events);
  assert.equal(initial.length, 13);
  assert.equal(initial.filter((i) => i.card.facet === "grammar").length, 1);
  assert.equal(initial.filter((i) => i.card.facet === "meaning").length, 5);
  events.push({
    ...start,
    context: undefined,
    eventId: "try-save-phrase",
    sequence: sequence++,
    kind: "savedPhrase",
    stepId: "recap",
    input: "try-eat",
  });
  assert.equal(lessonReviewIntroductions(lesson, events).length, 15);
});
