import { test } from "node:test";
import assert from "node:assert/strict";
import { availabilityLesson as lesson } from "../packages/content/src/availability.ts";
import { checkPreparedLesson } from "../packages/learning-core/src/content-check.ts";
import { assessFixed } from "../packages/learning-core/src/lesson.ts";
import { lessonConversationTarget } from "../packages/learning-core/src/lesson-target.ts";
import { validateConversationEvidence } from "../packages/learning-core/src/conversation.ts";
import { assessNovelSentence } from "../packages/learning-core/src/sentence-assessment.ts";
import { lessonReviewIntroductions } from "../packages/learning-core/src/reviews.ts";
import {
  sessionProjection,
  type StudyEvent,
} from "../packages/learning-core/src/study.ts";

const exercise = (id: string) => lesson.exercises.find((e) => e.id === id)!;
test("availability has the approved four-kanji set, complete sentence breakdowns and answer keys", () => {
  assert.deepEqual(checkPreparedLesson(lesson), []);
  assert.deepEqual(
    lesson.words.map((word) => word.kanji),
    ["店", "本", "新", "古"],
  );
  assert.equal(lesson.exercises.length, 17);
  for (const e of lesson.exercises)
    for (const answer of [...e.accepted, ...(e.romaji ?? [])])
      assert(
        ["independent", "assisted"].includes(
          assessFixed(e, answer, []).outcome,
        ),
        `${e.id}: ${answer}`,
      );
  for (const sentence of [
    ...lesson.words.map((word) => word.example),
    ...lesson.grammar.examples,
  ])
    assert.equal(
      sentence.segments.map((part) => part.text).join(""),
      sentence.text,
    );
});

test("word-reading recall requires the actual adjective ending, rather than an isolated kanji reading", () => {
  for (const [id, approved, wrong] of [
    ["new", ["あたらしい", "atarashii"], ["あたら", "atara", "しん", "shin"]],
    ["old", ["ふるい", "furui"], ["ふる", "furu", "こ", "ko"]],
    ["shop", ["みせ", "mise"], ["てん", "ten"]],
  ] as const) {
    for (const answer of approved)
      assert.equal(
        assessFixed(exercise(`reading-${id}`), answer, []).outcome,
        "independent",
      );
    for (const answer of wrong)
      assert.equal(
        assessFixed(exercise(`reading-${id}`), answer, []).outcome,
        "incorrect",
      );
  }
  assert.equal(
    assessFixed(exercise("meaning-old"), "secondhand", []).outcome,
    "incorrect",
  );
  assert.equal(
    assessFixed(exercise("reading-new"), "atarashii", []).kanaEvidence,
    false,
  );
});

test("availability accepts natural omitted-topic questions while preserving assistance and distinct request evidence", () => {
  const own = exercise("availability-own");
  for (const answer of [
    "本、ありますか。",
    "ほんはありますか",
    "atarashii hon arimasu ka",
    "furui hon wa arimasu ka",
  ]) {
    const result = assessFixed(own, answer, []);
    assert.equal(result.outcome, "independent");
    assert(result.targetObserved);
    assert.equal(result.kanaEvidence, false);
  }
  assert.equal(
    assessFixed(own, "本をください", []).outcome,
    "validAlternative",
  );
  assert.equal(
    assessFixed(own, "本はありますか", ["patternHint"]).outcome,
    "assisted",
  );
  assert.equal(
    assessFixed(exercise("availability-tiles"), "新しい本はありますか", [])
      .outcome,
    "assisted",
  );
  assert.equal(assessFixed(own, "マンガはありますか", []).outcome, "pending");
});

test("understanding a short stock reply cannot establish the active question goal", () => {
  const target = lessonConversationTarget(lesson)!;
  assert(target.forms.includes("ありますか"));
  assert(!target.forms.includes("あります"));
  assert(!target.forms.includes("ありません"));
  for (const text of [
    "はい、あります。",
    "いいえ、ありません。",
    "hai arimasu",
  ]) {
    const result = validateConversationEvidence(
      {
        assessment: {
          messageId: "stock-reply",
          validity: "appropriate",
          meaningfulJapanese: true,
          target: "used",
          span: text,
          explanation: "Synthetic overclaim.",
        },
      },
      { id: "stock-reply", text, intent: "practice", support: [] },
      target.forms,
    );
    assert.notEqual(result.state, "independent");
  }
  for (const id of ["availability-yes-meaning", "availability-no-meaning"])
    assert.equal(
      assessFixed(exercise(id), exercise(id).accepted[0]!, []).outcome,
      "independent",
    );
});

test("a novel item's availability question needs exact learner evidence and supports both Japanese and romaji", () => {
  const own = exercise("availability-own");
  for (const input of ["manga arimasu ka", "マンガはありますか"]) {
    const source = { id: "new-stock-question", input, support: [] };
    const semantic = {
      messageId: source.id,
      validity: "appropriate" as const,
      meaningfulJapanese: true,
      target: "used" as const,
      span: input,
      explanation: "Appropriate question about manga availability.",
    };
    const result = assessNovelSentence(own, source, semantic, lesson);
    assert.equal(result.outcome, "independent");
    assert.equal(result.kanaEvidence, false);
    assert.equal(
      assessNovelSentence(
        own,
        { ...source, input: "「マンガはありますか」という例です" },
        { ...semantic, span: "マンガはありますか" },
        lesson,
      ).outcome,
      "pending",
    );
  }
});

test("availability introduces twelve review tracks and two saved-phrase tracks without equating completion with mastery", () => {
  const base = {
    sessionId: "availability-session",
    deviceId: "availability-device",
    lessonId: "availability",
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
      eventId: "availability-start",
      sequence: sequence++,
      kind: "started",
      stepId: "goal",
      context: {
        theme: "Manga",
        band: "foundations",
        romaji: true,
        furigana: true,
        translations: true,
      },
    },
  ];
  for (const e of lesson.exercises) {
    events.push({
      ...base,
      eventId: `attempt-${e.id}`,
      sequence: sequence++,
      kind: "attempted",
      stepId: e.id,
      input: e.accepted[0]!,
    });
    events.push({
      ...base,
      eventId: `advance-${e.id}`,
      sequence: sequence++,
      kind: "advanced",
      stepId: e.id,
    });
  }
  assert.equal(sessionProjection(lesson, events).grammarState, "independent");
  const before = lessonReviewIntroductions(lesson, events);
  assert.equal(before.length, 12);
  assert.equal(
    before.filter((item) => item.card.facet === "reading").length,
    4,
  );
  events.push({
    ...base,
    eventId: "save-availability-example",
    sequence: sequence++,
    kind: "savedPhrase",
    stepId: "recap",
    input: "new-books-question",
  });
  const after = lessonReviewIntroductions(lesson, events);
  assert.equal(after.length, 14);
  assert(
    after.every(
      (item) =>
        item.card.sourceId === "availability" && item.card.sourceVersion === 1,
    ),
  );
});
