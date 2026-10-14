import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activeMilliseconds,
  splitStudySpan,
  validateStudyEvent,
  sessionProjection,
  type StudyEvent,
} from "../packages/learning-core/src/study.ts";
import { requestsLesson } from "../packages/content/src/requests.ts";
test("audio effort retains original days and unions overlaps without awarding recall, grammar or streak evidence", () => {
  const end = Date.UTC(2026, 9, 13, 18, 30, 10),
    offsetMinutes = -330;
  const spans = splitStudySpan(end - 20000, end, offsetMinutes);
  const event: StudyEvent = {
    eventId: "audio-event-0001",
    sessionId: "session-audio-0001",
    deviceId: "audio-device-0001",
    sequence: 1,
    lessonId: requestsLesson.id,
    lessonVersion: 1,
    occurredAt: end,
    localDay: "2026-10-14",
    offsetMinutes,
    timezone: "Asia/Calcutta",
    kind: "audioActivity",
    stepId: "recap",
    input: "listening",
    support: [],
    spans,
  };
  validateStudyEvent(event, requestsLesson, end + 86400000);
  const spoken = {
    ...event,
    eventId: "audio-event-0002",
    input: "speaking",
    sequence: 2,
  };
  validateStudyEvent(spoken, requestsLesson, end + 86400000);
  const projection = sessionProjection(requestsLesson, [event, spoken]);
  assert.equal(activeMilliseconds(projection.spans, "2026-10-13"), 10000);
  assert.equal(activeMilliseconds(projection.spans, "2026-10-14"), 10000);
  assert.equal(projection.attempts.length, 0);
  assert.equal(projection.initiallyLearned.length, 0);
  assert.deepEqual(projection.meaningfulDays, []);
  assert.equal(projection.grammarState, "notObserved");
  for (const patch of [
    { input: "recognized correctly" },
    { spans: [] },
    { stepId: "goal" },
    { support: ["transcriptEdited"] },
  ])
    assert.throws(() =>
      validateStudyEvent(
        { ...event, ...patch } as StudyEvent,
        requestsLesson,
        end,
      ),
    );
});
