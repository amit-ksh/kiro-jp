import { test } from "node:test";
import assert from "node:assert/strict";
import { requestsLesson } from "../packages/content/src/requests.ts";
import { assessNovelSentence } from "../packages/learning-core/src/sentence-assessment.ts";
import {
  sessionProjection,
  type StudyEvent,
} from "../packages/learning-core/src/study.ts";
const exercise = requestsLesson.exercises.find(
  (item) => item.kind === "sentence",
)!;
const source = {
  id: "attempt-coffee-01",
  input: "コーヒーをください。",
  support: [],
};
const semantic = {
  messageId: source.id,
  validity: "appropriate" as const,
  meaningfulJapanese: true,
  target: "used" as const,
  span: "コーヒーをください",
  explanation: "This is an appropriate polite request for coffee.",
};
test("novel appropriate requests count independently or with actual assistance, without kana/speech evidence", () => {
  assert.equal(
    assessNovelSentence(exercise, source, semantic, requestsLesson).outcome,
    "independent",
  );
  assert.equal(
    assessNovelSentence(
      exercise,
      { ...source, support: ["wordBank"] },
      semantic, requestsLesson,
    ).outcome,
    "assisted",
  );
  assert.equal(
    assessNovelSentence(exercise, source, semantic, requestsLesson).kanaEvidence,
    false,
  );
});
test("foreign attribution, quoted grammar and uncertainty remain pending", () => {
  assert.equal(
    assessNovelSentence(exercise, source, {
      ...semantic,
      messageId: "someone-else",
    }, requestsLesson).outcome,
    "pending",
  );
  assert.equal(
    assessNovelSentence(
      exercise,
      { ...source, input: "「コーヒーをください」という例です" },
      semantic, requestsLesson,
    ).outcome,
    "pending",
  );
  assert.equal(
    assessNovelSentence(exercise, source, {
      ...semantic,
      validity: "uncertain",
    }, requestsLesson).outcome,
    "pending",
  );
});
test("actual errors and valid alternative Japanese patterns remain distinct", () => {
  assert.equal(
    assessNovelSentence(exercise, source, {
      ...semantic,
      validity: "needsCorrection",
    }, requestsLesson).outcome,
    "incorrect",
  );
  assert.equal(
    assessNovelSentence(
      exercise,
      { ...source, input: "コーヒーがほしいです" },
      { ...semantic, target: "notUsed", span: "" }, requestsLesson,
    ).outcome,
    "validAlternative",
  );
  assert.equal(
    assessNovelSentence(
      exercise,
      { ...source, input: "I want coffee" },
      { ...semantic, target: "notUsed", meaningfulJapanese: false }, requestsLesson,
    ).outcome,
    "pending",
  );
});
test("resolved feedback attaches only to matching immutable pending input and preserves original study date", () => {
  const now = Date.UTC(2026, 9, 13),
    event: StudyEvent = {
      eventId: source.id,
      sessionId: "session-test-1",
      deviceId: "device-test-01",
      sequence: 1,
      lessonId: requestsLesson.id,
      lessonVersion: 1,
      occurredAt: now,
      localDay: "2026-10-13",
      offsetMinutes: 0,
      timezone: "UTC",
      kind: "attempted",
      stepId: exercise.id,
      input: source.input,
      support: [],
      spans: [],
    };
  const assessed = assessNovelSentence(exercise, source, semantic, requestsLesson);
  assert.equal(
    sessionProjection(requestsLesson, [event], { [event.eventId]: assessed })
      .grammarState,
    "independent",
  );
  assert.deepEqual(
    sessionProjection(requestsLesson, [event], { [event.eventId]: assessed })
      .meaningfulDays,
    ["2026-10-13"],
  );
  assert.equal(
    sessionProjection(
      requestsLesson,
      [{ ...event, input: "Different input" }],
      { [event.eventId]: assessed },
    ).grammarState,
    "pending",
  );
});
test("a later attempt in the same millisecond does not retroactively add assistance", () => {
  const now = Date.UTC(2026, 9, 13),
    base: StudyEvent = {
      eventId: source.id,
      sessionId: "session-test-1",
      deviceId: "device-test-01",
      sequence: 1,
      lessonId: requestsLesson.id,
      lessonVersion: 1,
      occurredAt: now,
      localDay: "2026-10-13",
      offsetMinutes: 0,
      timezone: "UTC",
      kind: "attempted",
      stepId: exercise.id,
      input: source.input,
      support: [],
      spans: [],
    };
  const later = {
    ...base,
    eventId: "attempt-coffee-02",
    sequence: 2,
    input: "コーヒーがください。",
  };
  const projected = sessionProjection(requestsLesson, [later, base]);
  assert.deepEqual(projected.attempts[0]!.support, []);
  assert(projected.attempts[1]!.support.includes("correctionRetry"));
});
