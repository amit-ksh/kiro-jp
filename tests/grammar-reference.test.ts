import { test } from "node:test";
import assert from "node:assert/strict";
import {
  searchGrammarReferences,
  type GrammarReference,
} from "../packages/learning-core/src/grammar-reference.ts";
import { grammarReferences } from "../packages/content/src/grammar-reference.ts";
import { requestsLesson } from "../packages/content/src/requests.ts";
import {
  validateStudyEvent,
  sessionProjection,
  activeMilliseconds,
  splitStudySpan,
  type StudyEvent,
} from "../packages/learning-core/src/study.ts";
test("checked grammar can be found by Japanese, romaji, English purpose and normalized level", () => {
  for (const query of [
    "ください",
    "o kudasai",
    "polite request",
    "N5",
    "Ｎ５",
    "particle",
    "water please",
    "  BOOK  ",
  ]) {
    const found = searchGrammarReferences(grammarReferences, query);
    assert(found.length >= 1, query);
    assert.equal(found[0]!.id, "requests-v1-request-kudasai");
  }
  assert.equal(searchGrammarReferences(grammarReferences, "").length, 3);
  assert.equal(searchGrammarReferences(grammarReferences, "where entrance")[0]!.id,"directions-v1-location-doko");
  assert.equal(searchGrammarReferences(grammarReferences, "ga suki")[0]!.id,"favorites-v1-likes-suki");
  assert.equal(searchGrammarReferences(grammarReferences, "N4").length, 0);
  assert.equal(
    searchGrammarReferences(grammarReferences, "not-a-pattern").length,
    0,
  );
});
test("planned or unchecked patterns are never exposed as grammar reference results", () => {
  const draft = {
    id: "draft",
    level: "N4",
    lesson: {
      ...requestsLesson,
      check: { ...requestsLesson.check, status: "draft" },
    },
  } as unknown as GrammarReference;
  assert.equal(
    searchGrammarReferences([...grammarReferences, draft], "").length,
    grammarReferences.length,
  );
  assert.deepEqual(searchGrammarReferences([draft], "ください"), []);
  const before = JSON.stringify(grammarReferences);
  searchGrammarReferences(grammarReferences, "book request");
  assert.equal(JSON.stringify(grammarReferences), before);
});
test("library replay credits actual listening without creating a lesson, a streak, grammar use or speaking evidence", () => {
  const now = Date.UTC(2026, 9, 14, 8),
    event: StudyEvent = {
      eventId: "library-audio-event",
      sessionId: "library-requests-v1",
      deviceId: "library-device-0001",
      sequence: 1,
      lessonId: "library",
      lessonVersion: 1,
      kind: "audioActivity",
      stepId: "library:requests:1:request-water",
      input: "listening",
      occurredAt: now,
      localDay: "2026-10-14",
      offsetMinutes: 0,
      timezone: "UTC",
      spans: splitStudySpan(now - 2000, now, 0),
      support: [],
    };
  validateStudyEvent(event, requestsLesson, now);
  const projection = sessionProjection(requestsLesson, [event]);
  assert.equal(activeMilliseconds(projection.spans, "2026-10-14"), 2000);
  assert.deepEqual(projection.meaningfulDays, []);
  assert.deepEqual(projection.attempts, []);
  assert.deepEqual(projection.initiallyLearned, []);
  assert.equal(projection.grammarState, "notObserved");
  for (const patch of [
    { sessionId: "someone-elses-session" },
    { stepId: "library:requests:2:request-water" },
    { stepId: "library:requests:1:unknown" },
    { input: "speaking" },
    { spans: [] },
    { support: ["testedAnswer"] },
    { lessonVersion: 2 },
  ])
    assert.throws(() =>
      validateStudyEvent(
        { ...event, ...patch } as StudyEvent,
        requestsLesson,
        now,
      ),
    );
});
