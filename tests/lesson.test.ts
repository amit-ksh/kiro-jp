import { test } from "node:test";
import assert from "node:assert/strict";
import { requestsLesson } from "../packages/content/src/requests.ts";
import { assessFixed, scheduleTransition } from "../packages/learning-core/src/lesson.ts";
import { activeMilliseconds, initialReviewTracks, localDayAt, sessionProjection, splitStudySpan, validateStudyEvent, type StudyEvent } from "../packages/learning-core/src/study.ts";
const exercise = (id: string) => requestsLesson.exercises.find(item => item.id === id)!;
const now = Date.UTC(2026, 9, 13, 13);
function event(sequence: number, stepId: string, kind: StudyEvent["kind"], input?: string): StudyEvent { return { eventId: `event-id-${sequence}`, sessionId: "session-id-1", deviceId: "device-id-1", sequence, lessonId: "requests", lessonVersion: 1, occurredAt: now + sequence * 1000, localDay: "2026-10-13", offsetMinutes: -330, timezone: "Asia/Calcutta", kind, stepId, input, support: [], spans: [] }; }
test("checked meanings use explicit aliases without broad fuzzy acceptance", () => {
  assert.equal(assessFixed(exercise("meaning-book"), " A BOOK. ", []).outcome, "independent");
  assert.equal(assessFixed(exercise("meaning-water"), "watery", []).outcome, "incorrect");
  assert.equal(assessFixed(exercise("meaning-yen"), "circle", []).outcome, "incorrect");
});
test("whole-word readings reject other kanji readings and distinguish romaji from kana literacy", () => {
  assert.equal(assessFixed(exercise("reading-water"), "sui", []).outcome, "incorrect");
  assert.equal(assessFixed(exercise("reading-tea"), "cha", []).outcome, "incorrect");
  assert.equal(assessFixed(exercise("reading-water"), "ミズ", []).outcome, "independent");
  const roman = assessFixed(exercise("reading-water"), "mizu", []);
  assert.equal(roman.outcome, "independent"); assert.equal(roman.inputScript, "romaji"); assert.equal(roman.kanaEvidence, false);
  assert.equal(assessFixed(exercise("kana-mi"), "mi", []).kanaEvidence, true);
});
test("support, correction retries and tiles cannot produce independent evidence", () => {
  assert.equal(assessFixed(exercise("reading-book"), "hon", ["testedAnswer"]).outcome, "assisted");
  assert.equal(assessFixed(exercise("request-tiles"), "本をください", []).outcome, "assisted");
  const result = sessionProjection(requestsLesson, [event(1, "meaning-water", "attempted", "tea"), event(2, "meaning-water", "attempted", "water")]);
  assert.equal(result.attempts[1]!.assessment.outcome, "assisted");
  const restoredHint = sessionProjection(requestsLesson, [{ ...event(1, "reading-water", "studied", "1"), support: ["testedAnswer"] }, event(2, "reading-water", "attempted", "mizu")]);
  assert.equal(restoredHint.attempts[0]!.assessment.outcome, "assisted");
});
test("approved requests, different valid patterns, quotes and novel sentences stay distinct", () => {
  assert.equal(assessFixed(exercise("request-own"), "mizu o kudasai", []).targetObserved, true);
  const alternative = assessFixed(exercise("request-own"), "水をお願いします", []);
  assert.equal(alternative.outcome, "validAlternative"); assert.equal(alternative.targetObserved, false);
  assert.equal(assessFixed(exercise("request-own"), "The phrase is 水をください", []).outcome, "pending");
  assert.equal(assessFixed(exercise("request-own"), "この本をください", []).outcome, "pending");
  assert.equal(assessFixed(exercise("request-own"), "", [], true).outcome, "dontKnow");
});
test("lesson projections retain partial attempts and introduce meaning and reading separately", () => {
  const events = [event(1, "meaning-water", "attempted", "water"), event(2, "meaning-water", "advanced"), event(3, "reading-water", "attempted", "mizu"), event(4, "reading-water", "advanced")];
  const tracks = initialReviewTracks(requestsLesson, events);
  assert.deepEqual(tracks.map(track => track.facet), ["meaning", "reading"]);
  assert.equal(tracks[0]!.stage, 0); assert.equal(tracks[0]!.dueAt, now + 4000 + 4 * 3_600_000);
  assert.equal(sessionProjection(requestsLesson, events).grammarState, "notObserved");
  assert.equal(sessionProjection(requestsLesson, events).finishedText, false);
});
test("active intervals union overlapping devices and split the original local date", () => {
  const midnight = Date.UTC(2026, 9, 13, 18, 30);
  const spans = splitStudySpan(midnight - 10_000, midnight + 10_000, -330);
  assert.deepEqual(spans.map(span => span.localDay), ["2026-10-13", "2026-10-14"]);
  assert.equal(activeMilliseconds([...spans, ...spans], "2026-10-13"), 10_000);
  assert.equal(localDayAt(midnight + 1, -330), "2026-10-14");
  assert.throws(() => splitStudySpan(now, now + 60_000, -330));
});
test("invalid versions, dates, steps and unbounded intervals cannot enter the journal", () => {
  const valid = event(1, "meaning-water", "attempted", "water");
  assert.doesNotThrow(() => validateStudyEvent(valid, requestsLesson, now + 2000));
  assert.throws(() => validateStudyEvent({ ...valid, lessonVersion: 2 }, requestsLesson, now));
  assert.throws(() => validateStudyEvent({ ...valid, localDay: "2026-10-12" }, requestsLesson, now));
  assert.throws(() => validateStudyEvent({ ...valid, stepId: "other-account" }, requestsLesson, now));
});
test("review transitions preserve assistance, stage bounds and pending schedules", () => {
  assert.deepEqual(scheduleTransition(0, "independent", now), { stage: 1, dueAt: now + 8 * 3_600_000 });
  assert.deepEqual(scheduleTransition(6, "incorrect", now), { stage: 5, dueAt: now + 4 * 3_600_000 });
  assert.deepEqual(scheduleTransition(4, "assisted", now), { stage: 4, dueAt: now + 4 * 3_600_000 });
  assert.equal(scheduleTransition(4, "pending", now), null);
  assert.equal(scheduleTransition(0, "independent", now, true)?.dueAt, now + 3 * 86_400_000);
});
test("a wrong answer returns after two other questions with practice-only evidence", () => {
  const projection = sessionProjection(requestsLesson, [event(1, "meaning-water", "attempted", "tea")]);
  const queue = projection.steps;
  const at = queue.findIndex(step => step.id === "meaning-water"), retry = queue.findIndex(step => step.id === "retry-meaning-water");
  assert.equal(retry - at, 3);
  const second = sessionProjection(requestsLesson, [event(1, "meaning-water", "attempted", "tea"), event(2, "retry-meaning-water", "attempted", "water")]);
  assert.equal(second.attempts[1]!.assessment.outcome, "assisted");
  const tail = sessionProjection(requestsLesson, [{ ...event(1, "request-own", "attempted"), dontKnow: true }]);
  const tailAt = tail.steps.findIndex(step => step.id === "request-own");
  assert.equal(tail.steps[tailAt + 3]!.id, "retry-request-own");
});
