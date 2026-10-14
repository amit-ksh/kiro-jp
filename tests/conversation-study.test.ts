import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activeMilliseconds,
  localDayAt,
  splitStudySpan,
  validateStudyEvent,
  type StudyEvent,
} from "../packages/learning-core/src/study.ts";
import { requestsLesson } from "../packages/content/src/requests.ts";
test("conversation effort unions with lesson effort and retains its original local day", () => {
  const now = Date.UTC(2026, 9, 13, 18, 30, 10),
    offsetMinutes = -330;
  const spans = splitStudySpan(now - 20000, now, offsetMinutes);
  const event: StudyEvent = {
    eventId: "event-chat-01",
    sessionId: "segment-0001",
    deviceId: "device-00001",
    sequence: 1,
    lessonId: "conversation",
    lessonVersion: 1,
    occurredAt: now,
    localDay: localDayAt(now, offsetMinutes),
    offsetMinutes,
    timezone: "Asia/Calcutta",
    kind: "conversationActivity",
    stepId: "chat",
    support: [],
    spans,
  };
  validateStudyEvent(event, requestsLesson, now + 86_400_000);
  assert.equal(activeMilliseconds([...spans, ...spans], "2026-10-13"), 10000);
  assert.equal(activeMilliseconds([...spans, ...spans], "2026-10-14"), 10000);
  assert.throws(() =>
    validateStudyEvent(
      { ...event, input: "topic selection" },
      requestsLesson,
      now,
    ),
  );
});
test("assessed conversation turn adds meaningful evidence, with no invented duration or lesson mastery", () => {
  const now = Date.UTC(2026, 9, 14),
    offsetMinutes = 600;
  const event: StudyEvent = {
    eventId: "event-chat-02",
    sessionId: "segment-0001",
    deviceId: "server-conversation",
    sequence: 0,
    lessonId: "conversation",
    lessonVersion: 1,
    occurredAt: now,
    localDay: localDayAt(now, offsetMinutes),
    offsetMinutes,
    timezone: "Pacific/Honolulu",
    kind: "conversationTurn",
    stepId: "message-0001",
    input: "meaningful",
    support: ["suggestedReply"],
    spans: [],
  };
  validateStudyEvent(event, requestsLesson, now);
  assert.equal(event.localDay, "2026-10-13");
  assert.equal(activeMilliseconds(event.spans, event.localDay), 0);
  assert.throws(() =>
    validateStudyEvent(
      { ...event, spans: splitStudySpan(now - 1000, now, offsetMinutes) },
      requestsLesson,
      now,
    ),
  );
});
