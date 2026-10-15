import { test } from "node:test";
import assert from "node:assert/strict";
import { abilityLesson as lesson } from "../packages/content/src/ability.ts";
import { requestsLesson } from "../packages/content/src/requests.ts";
import { authoringCurriculum } from "../packages/content/src/authoring.ts";
import { curriculum } from "../packages/content/src/curriculum.ts";
import { recommendFirstLesson } from "../packages/content/src/index.ts";
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
  validateStudyEvent,
  sessionProjection,
  type StudyEvent,
} from "../packages/learning-core/src/study.ts";
const exercise = (id: string) =>
  lesson.exercises.find((item) => item.id === id)!;
test("ability is a checked, registered four-kanji N4 lesson with complete supported examples", () => {
  assert.deepEqual(checkPreparedLesson(lesson), []);
  assert.deepEqual(
    lesson.words.map((word) => word.kanji),
    ["読", "書", "話", "聞"],
  );
  assert.equal(lesson.exercises.length, 18);
  assert.equal(authoringCurriculum.get("ability"), lesson);
  assert.equal(curriculum.get("ability", 1), lesson);
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
  assert.match(lesson.words[0]!.example.text, /マンガ/);
});

test("new recommendations respect accepted level and retain the supported N5 foundation route", () => {
  for (const band of ["foundations", "early-n5"] as const) {
    for (const interests of [["Manga"], ["Music"], ["Food"], []]) {
      const recommendation = recommendFirstLesson(interests, band);
      const selected = curriculum.get(recommendation.id)!;
      assert.notEqual(selected.level, "N4");
      assert(lessonEntry(selected, band).allowed);
    }
  }
  assert.equal(recommendFirstLesson(["Manga"], "early-n4").id, "ability");
  assert.equal(recommendFirstLesson([], "early-n4").id, "ability");
  assert.equal(recommendFirstLesson(["Shrines"], "foundations").id, "directions");
});
test("whole-word reading requires dictionary endings, without treating romaji as kana literacy", () => {
  for (const [id, reading, roman, wrong] of [
    ["read", "よむ", "yomu", ["yomi", "どく"]],
    ["write", "かく", "kaku", ["kaki", "しょ"]],
    ["speak", "はなす", "hanasu", ["hanashi", "わ"]],
    ["listen", "きく", "kiku", ["kiki", "ぶん"]],
  ] as const) {
    const own = exercise(`reading-${id}`);
    assert.equal(assessFixed(own, reading, []).outcome, "independent");
    assert.equal(assessFixed(own, roman, []).outcome, "independent");
    assert.equal(assessFixed(own, roman, []).kanaEvidence, false);
    for (const input of wrong)
      assert.equal(assessFixed(own, input, []).outcome, "incorrect");
  }
});
test("ability accepts positive, question and negative actions and distinguishes valid alternative grammar", () => {
  const own = exercise("ability-own");
  for (const input of [
    "マンガを読むことができます",
    "namae wo kaku koto ga dekimasu",
    "日本語を話すことができますか",
    "mada nihongo o hanasu koto ga dekimasen",
  ]) {
    const result = assessFixed(own, input, []);
    assert.equal(result.outcome, "independent");
    assert(result.targetObserved);
    assert.equal(assessFixed(own, input, ["wordBank"]).outcome, "assisted");
  }
  for (const input of ["日本語が話せます", "nihongo ga dekimasu"]) {
    const result = assessFixed(own, input, []);
    assert.equal(result.outcome, "validAlternative");
    assert.equal(result.targetObserved, false);
  }
  assert.equal(
    assessFixed(exercise("ability-dictionary"), "読みます", []).outcome,
    "incorrect",
  );
});
test("novel ability feedback must cite the learner's actual full target action", () => {
  const own = exercise("ability-own"),
    input = "manga o yomu koto ga dekimasen",
    source = { id: "ability-novel", input, support: [] };
  const semantic = {
    messageId: source.id,
    validity: "appropriate" as const,
    target: "used" as const,
    span: input,
    meaningfulJapanese: true,
    explanation:
      "The full dictionary-form action and polite negative express inability.",
  };
  assert.equal(assessFixed(own, input, []).outcome, "pending");
  assert.equal(
    assessNovelSentence(own, source, semantic, lesson).outcome,
    "independent",
  );
  assert.equal(
    assessNovelSentence(
      own,
      source,
      { ...semantic, messageId: "other-source" },
      lesson,
    ).outcome,
    "pending",
  );
  assert.equal(
    assessNovelSentence(
      own,
      source,
      { ...semantic, span: "unrelated action" },
      lesson,
    ).outcome,
    "pending",
  );
  const target = lessonConversationTarget(lesson)!;
  assert(target.forms.includes("ことができます"));
  assert(target.forms.includes("ことができません"));
  assert(!target.forms.includes("できます"));
});
function start(band: NonNullable<StudyEvent["context"]>["band"]): StudyEvent {
  return {
    eventId: "ability-start",
    sessionId: "ability-session",
    deviceId: "ability-device",
    sequence: 1,
    lessonId: lesson.id,
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
      theme: "Manga",
      band,
      romaji: true,
      furigana: true,
      translations: true,
    },
  };
}
test("N4 starts require the accepted band and checked prerequisite support; old supported N5 starts remain valid", () => {
  for (const band of ["foundations", "early-n5"] as const) {
    assert.equal(lessonEntry(lesson, band).allowed, false);
    assert.throws(() =>
      validateStudyEvent(start(band), lesson, Date.UTC(2026, 9, 15)),
    );
    assert(lessonEntry(requestsLesson, band).allowed);
  }
  assert.deepEqual(lessonEntry(lesson, "early-n4"), {
    allowed: true,
    reason: "supported",
  });
  assert.doesNotThrow(() =>
    validateStudyEvent(start("early-n4"), lesson, Date.UTC(2026, 9, 15)),
  );
  const unsupported = {
    ...lesson,
    entry: { ...lesson.entry!, support: { explanation: "", examples: [] } },
  };
  assert.equal(lessonEntry(unsupported, "early-n4").allowed, false);
  assert(
    checkPreparedLesson(unsupported).includes(
      "Missing checked prerequisite support.",
    ),
  );
  const missing = { ...lesson, entry: undefined };
  assert.equal(lessonEntry(missing, "early-n4").allowed, false);
  assert(
    checkPreparedLesson(missing).includes(
      "Missing checked prerequisite support.",
    ),
  );
});
test("ability creates twelve separate initial review tracks and a saved phrase adds two without importing skill credit", () => {
  const begun = start("early-n4"),
    events: StudyEvent[] = [begun];
  let sequence = 2;
  for (const item of lesson.exercises) {
    events.push({
      ...begun,
      eventId: `attempt-${item.id}`,
      kind: "attempted",
      stepId: item.id,
      sequence: sequence++,
      context: undefined,
      input: item.accepted[0]!,
    });
    events.push({
      ...begun,
      eventId: `advance-${item.id}`,
      kind: "advanced",
      stepId: item.id,
      sequence: sequence++,
      context: undefined,
    });
  }
  assert.equal(sessionProjection(lesson, events).grammarState, "independent");
  const initial = lessonReviewIntroductions(lesson, events);
  assert.equal(initial.length, 12);
  assert.equal(initial.filter((i) => i.card.facet === "kana").length, 3);
  assert.equal(initial.filter((i) => i.card.facet === "grammar").length, 1);
  assert(initial.every((item) => item.card.sourceId === "ability"));
  assert.equal(
    initial.filter((item) => item.card.facet === "meaning").length,
    4,
  );
  events.push({
    ...begun,
    eventId: "save-ability",
    kind: "savedPhrase",
    stepId: "recap",
    sequence: sequence++,
    context: undefined,
    input: "can-read",
  });
  assert.equal(lessonReviewIntroductions(lesson, events).length, 14);
});
