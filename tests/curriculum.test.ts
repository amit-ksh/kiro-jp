import { test } from "node:test";
import assert from "node:assert/strict";
import { createCurriculum } from "../packages/learning-core/src/curriculum.ts";
import { lessonSpeechCues } from "../packages/learning-core/src/speech-cues.ts";
import { requestsLesson } from "../packages/content/src/requests.ts";
import type { PreparedLesson } from "../packages/learning-core/src/lesson.ts";
import {
  sessionProjection,
  validateStudyEvent,
  type StudyEvent,
} from "../packages/learning-core/src/study.ts";

const newer = {
  ...requestsLesson,
  version: 2,
  title: "Synthetic changed answer key",
  exercises: requestsLesson.exercises.map((e) =>
    e.id === "meaning-water"
      ? {
          ...e,
          accepted: ["synthetic alternative"],
          expected: "synthetic alternative",
        }
      : e,
  ),
};
const alternate = {
  ...requestsLesson,
  id: "synthetic-other-lesson",
  title: "Synthetic alternate lesson",
};
const catalog = createCurriculum([newer, alternate, requestsLesson]);
test("speech cues use the exact selected lesson and keep an own-sentence cue distinct from model words", () => {
  const old = lessonSpeechCues(catalog.get("requests",1)!);
  assert.equal(old.find(cue => cue.id === "word-water")!.reading,"みず");
  const other = lessonSpeechCues({...alternate,words:[{...alternate.words[0]!,id:"fountain",word:"泉",reading:"いずみ"}]});
  assert.equal(other.find(cue => cue.id === "word-fountain")!.reading,"いずみ");
  assert.equal(other.some(cue => cue.id === "word-water"),false);
  assert.equal(old.filter(cue => cue.id === "request-water").length,1);
  assert.equal(old.find(cue => cue.id === "own-sentence")!.text,"Your own sentence");
});
function event(patch: Partial<StudyEvent> = {}): StudyEvent {
  return {
    eventId: "saved-event-0001",
    sessionId: "saved-session-0001",
    deviceId: "saved-device-0001",
    sequence: 1,
    lessonId: "requests",
    lessonVersion: 1,
    kind: "started",
    stepId: "goal",
    occurredAt: Date.UTC(2026, 9, 14, 8),
    localDay: "2026-10-14",
    offsetMinutes: 0,
    timezone: "UTC",
    support: [],
    spans: [],
    context: {
      theme: "Manga",
      band: "foundations",
      romaji: true,
      furigana: true,
      translations: true,
    },
    ...patch,
  };
}
test("new sessions select the latest checked lesson but saved work keeps its exact original answer key", () => {
  assert.equal(catalog.get("requests"), newer);
  const start = event(),
    attempt = event({
      eventId: "saved-attempt-01",
      kind: "attempted",
      stepId: "meaning-water",
      input: "water",
      context: undefined,
      sequence: 2,
    });
  const lesson = catalog.forSession([start, attempt], start.sessionId)!;
  assert.equal(lesson, requestsLesson);
  assert.equal(
    sessionProjection(lesson, [start, attempt]).attempts[0]!.assessment.outcome,
    "independent",
  );
  assert.equal(
    sessionProjection(catalog.get("requests")!, [start, attempt]).attempts[0]!
      .assessment.outcome,
    "incorrect",
  );
  assert.equal(catalog.forSession([start], "another-session"), undefined);
  assert.equal(
    catalog.forSession([event({ lessonVersion: 99 })], start.sessionId),
    undefined,
  );
  assert.equal(catalog.get("unpublished"), undefined);
});
test("activity and library audio resolve an exact lesson version without borrowing another lesson", () => {
  const source = event({ lessonId: alternate.id });
  assert.equal(catalog.forEvent(source), alternate);
  validateStudyEvent(source, catalog.forEvent(source), source.occurredAt);
  assert.throws(
    () => validateStudyEvent(source, requestsLesson, source.occurredAt),
    /Unsupported lesson/,
  );
  const library = event({
    lessonId: "library",
    lessonVersion: 1,
    kind: "audioActivity",
    stepId: "library:requests:1:request-water",
    context: undefined,
    input: "listening",
    spans: [
      {
        start: source.occurredAt - 1000,
        end: source.occurredAt,
        localDay: source.localDay,
        offsetMinutes: 0,
      },
    ],
    sessionId: "library-requests-v1",
  });
  assert.equal(catalog.forEvent(library), requestsLesson);
  validateStudyEvent(library, catalog.forEvent(library), source.occurredAt);
  for (const stepId of [
    "library:requests:99:request-water",
    "library:missing:1:request-water",
    "library:requests:1:request-water:extra",
  ]) {
    const invalid = { ...library, stepId };
    assert.equal(catalog.forEvent(invalid), undefined);
    assert.throws(
      () =>
        validateStudyEvent(
          invalid,
          catalog.forEvent(invalid),
          source.occurredAt,
        ),
      /Unsupported/,
    );
  }
});
test("protocol activity can be validated without selecting a fictitious learning lesson", () => {
  const time = event({
    lessonId: "conversation",
    kind: "conversationActivity",
    stepId: "chat",
    context: undefined,
    lessonVersion: 1,
  });
  assert.equal(catalog.forEvent(time), undefined);
  validateStudyEvent(time, undefined, time.occurredAt);
  assert.throws(
    () =>
      validateStudyEvent(
        event({ lessonVersion: 99 }),
        undefined,
        time.occurredAt,
      ),
    /Unsupported/,
  );
});
test("duplicate, unchecked and invalid curriculum versions are rejected before registration", () => {
  assert.throws(
    () => createCurriculum([requestsLesson, requestsLesson]),
    /twice/,
  );
  for (const patch of [
    { version: 0 },
    { version: 1.2 },
    { id: "../other" },
    { id: "review" },
    { check: { ...requestsLesson.check, status: "draft" } },
  ])
    assert.throws(
      () =>
        createCurriculum([{ ...requestsLesson, ...patch } as PreparedLesson]),
      /checked/,
    );
  assert.equal(createCurriculum([]).get("requests"), undefined);
});
