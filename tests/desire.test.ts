import { test } from "node:test";
import assert from "node:assert/strict";
import { desireLesson as lesson } from "../packages/content/src/desire.ts";
import { checkPreparedLesson } from "../packages/learning-core/src/content-check.ts";
import {
  assessFixed,
  normalizeJapanese,
} from "../packages/learning-core/src/lesson.ts";
import { lessonConversationTarget } from "../packages/learning-core/src/lesson-target.ts";
import { assessNovelSentence } from "../packages/learning-core/src/sentence-assessment.ts";
import { lessonReviewIntroductions } from "../packages/learning-core/src/reviews.ts";
import {
  sessionProjection,
  type StudyEvent,
} from "../packages/learning-core/src/study.ts";
const exercise = (id: string) =>
  lesson.exercises.find((item) => item.id === id)!;

test("desire has checked keys, four approved kanji and complete matching text/reading breakdowns", () => {
  assert.deepEqual(checkPreparedLesson(lesson), []);
  assert.deepEqual(
    lesson.words.map((word) => word.kanji),
    ["行", "見", "食", "飲"],
  );
  assert.equal(lesson.exercises.length, 18);
  for (const item of lesson.exercises)
    for (const answer of [...item.accepted, ...(item.romaji ?? [])])
      assert(
        ["independent", "assisted"].includes(
          assessFixed(item, answer, []).outcome,
        ),
        `${item.id}: ${answer}`,
      );
  for (const sentence of [
    ...lesson.words.map((word) => word.example),
    ...lesson.grammar.examples,
  ]) {
    assert.equal(
      sentence.segments.map((part) => part.text).join(""),
      sentence.text,
    );
    assert.equal(
      normalizeJapanese(sentence.segments.map((part) => part.reading).join("")),
      normalizeJapanese(sentence.reading),
    );
  }
});
test("word questions keep complete dictionary readings and approved 行く variants separate from desire forms", () => {
  for (const input of ["いく", "ゆく", "iku", "yuku"])
    assert.equal(
      assessFixed(exercise("reading-go"), input, []).outcome,
      "independent",
    );
  for (const [id, valid, wrong] of [
    ["watch", "miru", ["mi", "mitai"]],
    ["eat", "taberu", ["tabe", "tabetai", "shoku"]],
    ["drink", "nomu", ["nomi", "nomitai", "in"]],
  ] as const) {
    assert.equal(
      assessFixed(exercise(`reading-${id}`), valid, []).outcome,
      "independent",
    );
    assert.equal(
      assessFixed(exercise(`reading-${id}`), valid, []).kanaEvidence,
      false,
    );
    for (const answer of wrong)
      assert.equal(
        assessFixed(exercise(`reading-${id}`), answer, []).outcome,
        "incorrect",
      );
  }
  assert.equal(
    assessFixed(exercise("meaning-eat"), "meal", []).outcome,
    "independent",
  );
  assert.equal(
    assessFixed(exercise("vocabulary-eat"), "meal", []).outcome,
    "incorrect",
  );
  assert.equal(
    assessFixed(exercise("vocabulary-eat"), "to eat", []).outcome,
    "independent",
  );
});
test("both object particles and supported destination variants demonstrate the desire target", () => {
  const own = exercise("desire-own");
  for (const input of [
    "水を飲みたいです",
    "水が飲みたいです",
    "anime ga mitai desu",
    "sushi wo tabetai desu",
    "日本へ行きたいです",
    "nihon ni ikitai desu",
  ]) {
    const result = assessFixed(own, input, []);
    assert.equal(result.outcome, "independent");
    assert(result.targetObserved);
    assert.equal(result.kanaEvidence, false);
  }
  assert.equal(
    assessFixed(own, "アニメが好きです", []).outcome,
    "validAlternative",
  );
  assert.equal(
    assessFixed(own, "anime o mitai desu", ["wordBank"]).outcome,
    "assisted",
  );
  assert.equal(
    assessFixed(exercise("desire-tiles"), "アニメを見たいです", []).outcome,
    "assisted",
  );
});
test("katakana recognition is distinct from supported whole-word reading and assisted kana practice", () => {
  assert.deepEqual(
    lesson.kana.map((kana) => kana.character),
    ["ア", "ニ", "メ"],
  );
  for (const kana of lesson.kana) {
    const item = exercise(`kana-${kana.sound}`);
    assert.equal(item.japanese, kana.character);
    assert(assessFixed(item, kana.sound, []).kanaEvidence);
    assert.equal(
      assessFixed(item, kana.sound, ["example"]).kanaEvidence,
      false,
    );
  }
});
test("novel desire use requires appropriate exact learner evidence rather than a bare substring or quoted pattern", () => {
  const own = exercise("desire-own"),
    target = lessonConversationTarget(lesson)!;
  assert(target.forms.includes("たいです"));
  const source = {
    id: "desire-new-answer",
    input: "eiga ga mitai desu",
    support: [],
  };
  const semantic = {
    messageId: source.id,
    validity: "appropriate" as const,
    meaningfulJapanese: true,
    target: "used" as const,
    span: source.input,
    explanation: "An appropriate wish to watch a movie.",
  };
  assert.equal(
    assessNovelSentence(own, source, semantic, lesson).outcome,
    "independent",
  );
  assert.equal(
    assessNovelSentence(
      own,
      { ...source, input: "「映画が見たいです」という例です" },
      { ...semantic, span: "映画が見たいです" },
      lesson,
    ).outcome,
    "pending",
  );
  assert.equal(
    assessNovelSentence(
      own,
      { ...source, input: "sushi o taberu tai desu" },
      {
        ...semantic,
        validity: "needsCorrection",
        span: "sushi o taberu tai desu",
        explanation: "Use the taught stem 食べ before たいです.",
      },
      lesson,
    ).outcome,
    "incorrect",
  );
});
test("desire introduces thirteen distinct review tracks and two more from a checked saved phrase", () => {
  const base = {
    sessionId: "desire-session",
    deviceId: "desire-device",
    lessonId: "desire",
    lessonVersion: 1,
    occurredAt: Date.UTC(2026, 9, 15),
    localDay: "2026-10-15",
    timezone: "UTC",
    offsetMinutes: 0,
    support: [],
    spans: [],
  } as const;
  let sequence = 1;
  const events: StudyEvent[] = [
    {
      ...base,
      eventId: "desire-start",
      sequence: sequence++,
      kind: "started",
      stepId: "goal",
      context: {
        theme: "Anime",
        band: "early-n5",
        romaji: true,
        furigana: true,
        translations: true,
      },
    },
  ];
  for (const item of lesson.exercises) {
    events.push({
      ...base,
      eventId: `attempt-${item.id}`,
      sequence: sequence++,
      kind: "attempted",
      stepId: item.id,
      input: item.accepted[0]!,
    });
    events.push({
      ...base,
      eventId: `advance-${item.id}`,
      sequence: sequence++,
      kind: "advanced",
      stepId: item.id,
    });
  }
  assert.equal(sessionProjection(lesson, events).grammarState, "independent");
  const initial = lessonReviewIntroductions(lesson, events);
  assert.equal(initial.length, 13);
  assert.equal(initial.filter((item) => item.card.facet === "kana").length, 3);
  events.push({
    ...base,
    eventId: "save-desire",
    sequence: sequence++,
    kind: "savedPhrase",
    stepId: "recap",
    input: "want-watch",
  });
  const saved = lessonReviewIntroductions(lesson, events);
  assert.equal(saved.length, 15);
  assert(
    saved.every(
      (item) =>
        item.card.sourceId === "desire" && item.card.sourceVersion === 1,
    ),
  );
});
