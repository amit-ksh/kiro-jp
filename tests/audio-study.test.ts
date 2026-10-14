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
  const conversation = { ...spoken, lessonId: "conversation", stepId: "chat" };
  validateStudyEvent(conversation, requestsLesson, end + 86400000);
  assert.throws(() => validateStudyEvent({ ...conversation, input: "meaningful" }, requestsLesson, end));
  assert.throws(() => validateStudyEvent({ ...conversation, support: ["transcriptEdited"] }, requestsLesson, end));
  const reference = { ...event, lessonId: "reference", stepId: "reference" };
  validateStudyEvent(reference, requestsLesson, end);
  assert.throws(()=>validateStudyEvent({...reference,input:"speaking"},requestsLesson,end));
  const review = {...event,kind:"reviewActivity" as const,lessonId:"review",stepId:"requests:1:water:meaning",input:undefined};
  validateStudyEvent(review,requestsLesson,end);
  assert.throws(()=>validateStudyEvent({...review,input:"meaningful"},requestsLesson,end));
  assert.throws(()=>validateStudyEvent({...review,spans:[]},requestsLesson,end));
  assert.deepEqual(sessionProjection(requestsLesson,[review]).meaningfulDays,[]);
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
test("using an edited transcript retains assistance even after the answer is revised", () => {
  const occurredAt = Date.UTC(2026, 9, 14, 4);
  const base: StudyEvent = { eventId: "speech-help-0001", sessionId: "speech-session-0001", deviceId: "speech-device-0001", sequence: 1, lessonId: requestsLesson.id, lessonVersion: 1, occurredAt, localDay: "2026-10-14", timezone: "UTC", offsetMinutes: 0, kind: "studied", stepId: "request-own", support: ["transcriptEdited"], spans: [] };
  validateStudyEvent(base, requestsLesson, occurredAt);
  const revised: StudyEvent = { ...base, eventId: "speech-answer-0001", sequence: 2, occurredAt: occurredAt + 1, kind: "attempted", input: "hon o kudasai", support: [] };
  const result = sessionProjection(requestsLesson, [base, revised]).attempts[0]!;
  assert.equal(result.assessment.outcome, "assisted");
  assert(result.support.includes("transcriptEdited"));
  assert.equal(result.assessment.kanaEvidence, false);
});
