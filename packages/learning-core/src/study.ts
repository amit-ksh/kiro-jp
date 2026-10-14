import { assessFixed, grammarIntervals, recallIntervals, type Assessment, type PreparedLesson, type SupportFlag } from "./lesson.ts";
export interface StudySpan { start: number; end: number; localDay: string; offsetMinutes: number; }
export interface StudyEvent {
  eventId: string; sessionId: string; deviceId: string; sequence: number; lessonId: string; lessonVersion: number; occurredAt: number; localDay: string; timezone: string; offsetMinutes: number;
  kind: "started" | "studied" | "attempted" | "advanced" | "activity" | "savedPhrase" | "conversationActivity" | "conversationTurn" | "audioActivity";
  stepId: string; input?: string; dontKnow?: boolean; support: SupportFlag[]; spans: StudySpan[];
  context?: { theme: string; band: "foundations" | "early-n5" | "early-n4"; romaji: boolean; furigana: boolean; translations: boolean };
}
export interface LessonStep { id: string; kind: "goal" | "word" | "kana" | "grammar" | "exercise" | "recap"; targetId?: string; }
export function lessonSteps(lesson: PreparedLesson): LessonStep[] { return [{ id: "goal", kind: "goal" }, ...lesson.words.map(word => ({ id: `teach-${word.id}`, kind: "word" as const, targetId: word.id })), { id: "teach-kana", kind: "kana" }, { id: "teach-grammar", kind: "grammar" }, ...lesson.exercises.map(exercise => ({ id: exercise.id, kind: "exercise" as const, targetId: exercise.id })), { id: "recap", kind: "recap" }]; }
export function exerciseForStep(lesson: PreparedLesson, stepId: string) {
  return lesson.exercises.find(exercise => stepId === exercise.id || stepId === `retry-${exercise.id}` || lesson.exercises.some(failed => failed.id !== exercise.id && stepId === `extra-${failed.id}-${exercise.id}`));
}
export function localDayAt(utc: number, offsetMinutes: number) { return new Date(utc - offsetMinutes * 60_000).toISOString().slice(0, 10); }
export function splitStudySpan(start: number, end: number, offsetMinutes: number): StudySpan[] {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || end - start > 30_000) throw new Error("Invalid active interval.");
  const split = Math.floor((start - offsetMinutes * 60_000) / 86_400_000) * 86_400_000 + 86_400_000 + offsetMinutes * 60_000;
  return end > split ? [...splitStudySpan(start, split, offsetMinutes), ...splitStudySpan(split, end, offsetMinutes)] : [{ start, end, offsetMinutes, localDay: localDayAt(start, offsetMinutes) }];
}
export function activeMilliseconds(spans: readonly StudySpan[], day: string) {
  const sorted = spans.filter(span => span.localDay === day).sort((a, b) => a.start - b.start);
  let end = -Infinity, total = 0;
  for (const span of sorted) { total += Math.max(0, span.end - Math.max(end, span.start)); end = Math.max(end, span.end); }
  return total;
}
export function validateStudyStamp(event: Pick<StudyEvent, "eventId" | "sessionId" | "deviceId" | "sequence" | "occurredAt" | "offsetMinutes" | "localDay" | "timezone" | "support" | "input" | "spans">, now: number) {
  if (![event.eventId, event.sessionId, event.deviceId].every(id => /^[a-zA-Z0-9_-]{8,100}$/u.test(id))) throw new Error("Invalid study identity.");
  if (!Number.isInteger(event.sequence) || event.sequence < 0 || event.sequence > 100_000) throw new Error("Invalid study sequence.");
  if (!Number.isFinite(event.occurredAt) || event.occurredAt > now + 300_000 || event.occurredAt < Date.UTC(2026, 0, 1)) throw new Error("Invalid study occurrence time.");
  if (!Number.isInteger(event.offsetMinutes) || Math.abs(event.offsetMinutes) > 840 || event.localDay !== localDayAt(event.occurredAt, event.offsetMinutes) || event.timezone.length > 80) throw new Error("Invalid study calendar day.");
  if (event.support.length > 7 || (event.input?.length ?? 0) > 1000 || event.spans.length > 4) throw new Error("Invalid study payload bounds.");
  for (const span of event.spans) if (!Number.isFinite(span.start) || !Number.isFinite(span.end) || span.end < span.start || span.end - span.start > 30_000 || span.end > event.occurredAt + 1000 || span.start < event.occurredAt - 60_000 || !Number.isInteger(span.offsetMinutes) || Math.abs(span.offsetMinutes) > 840 || span.localDay !== localDayAt(span.start, span.offsetMinutes)) throw new Error("Invalid study time.");
}
export function validateStudyEvent(event: StudyEvent, lesson: PreparedLesson, now: number) {
  validateStudyStamp(event, now);
  if(event.kind === "audioActivity" && event.lessonId === "reference") {
    if(event.lessonVersion !== 1 || event.stepId !== "reference" || event.input !== "listening" || !event.spans.length || event.support.length || event.context || event.dontKnow!==undefined) throw new Error("Invalid reference audio activity.");
    return;
  }
  if(event.kind === "audioActivity" && event.lessonId === "conversation") {
    if(event.lessonVersion !== 1 || event.stepId !== "chat" || !["listening","speaking"].includes(event.input??"") || !event.spans.length || event.support.length || event.context || event.dontKnow!==undefined) throw new Error("Invalid conversation audio activity.");
    return;
  }
  if (event.kind === "conversationActivity" || event.kind === "conversationTurn") {
    if (event.lessonId !== "conversation" || event.lessonVersion !== 1 || (event.kind === "conversationActivity" && (event.stepId !== "chat" || event.input !== undefined)) || (event.kind === "conversationTurn" && (event.input !== "meaningful" || event.spans.length > 0 || !/^[a-zA-Z0-9_-]{8,100}$/u.test(event.stepId)))) throw new Error("Invalid conversation study evidence.");
    return;
  }
  if (event.lessonId !== lesson.id || event.lessonVersion !== lesson.version) throw new Error("Unsupported lesson version.");
  if(event.kind==="audioActivity" && (event.stepId!=="recap" || !["listening","speaking"].includes(event.input??"") || !event.spans.length || event.support.length || event.context || event.dontKnow!==undefined))throw new Error("Invalid audio practice activity.");
  const step = lessonSteps(lesson).find(item => item.id === event.stepId) ?? (exerciseForStep(lesson, event.stepId) ? { kind: "exercise" } : undefined);
  if (!step || (event.kind === "started" && (event.stepId !== "goal" || !event.context)) || (event.kind === "attempted" && step.kind !== "exercise") || (event.kind === "savedPhrase" && !lesson.grammar.examples.some(example => example.id === event.input)) || (event.context && event.context.theme.length > 120)) throw new Error("Invalid lesson step.");
}
export function sessionProjection(lesson: PreparedLesson, source: readonly StudyEvent[], checked: Readonly<Record<string, Assessment>> = {}) {
  const events = [...source].sort((a, b) => a.occurredAt - b.occurredAt || a.deviceId.localeCompare(b.deviceId) || a.sequence - b.sequence || a.eventId.localeCompare(b.eventId));
  const advanced = new Set(events.filter(event => event.kind === "advanced").map(event => event.stepId));
  const attempts: { event: StudyEvent; assessment: Assessment; support: SupportFlag[] }[] = [];
  const exposed = new Set<string>();
  const savedSupport = new Map<string, Set<SupportFlag>>();
  for (const event of events) {
    const exercise = exerciseForStep(lesson, event.stepId);
    if (!exercise) continue;
    if (event.kind === "studied") { const flags = savedSupport.get(exercise.id) ?? new Set<SupportFlag>(); event.support.forEach(flag => flags.add(flag)); savedSupport.set(exercise.id, flags); }
    if (event.kind !== "attempted") continue;
    const support = [...new Set([...event.support, ...(savedSupport.get(exercise.id) ?? [])])];
    if (exposed.has(exercise.id) && !support.includes("correctionRetry")) support.push("correctionRetry");
    const fixed = assessFixed(exercise, event.input ?? "", support, event.dontKnow);
    const candidate = checked[event.eventId];
    const assessment = fixed.outcome === "pending" && candidate && candidate.expected === fixed.expected && candidate.normalized === fixed.normalized ? { ...candidate, outcome: candidate.outcome === "independent" && support.length ? "assisted" as const : candidate.outcome } : fixed;
    attempts.push({ event, assessment, support });
    // Every feedback screen exposes the expected answer; any later try is practice.
    exposed.add(exercise.id);
  }
  const steps = lessonSteps(lesson);
  const firstAttempts = new Map<string, typeof attempts[number]>();
  for (const attempt of attempts) if (lesson.exercises.some(exercise => exercise.id === attempt.event.stepId) && !firstAttempts.has(attempt.event.stepId)) firstAttempts.set(attempt.event.stepId, attempt);
  // Reinsert an error after two different questions. At the tail, reuse two
  // other exercises as extra practice; these never create scheduled advances.
  for (const [exerciseId, attempt] of firstAttempts) {
    if (!["incorrect", "dontKnow"].includes(attempt.assessment.outcome)) continue;
    const at = steps.findIndex(step => step.id === exerciseId);
    let insertion = at + 1, others = 0;
    while (insertion < steps.length && steps[insertion]!.kind !== "recap" && others < 2) { if (steps[insertion]!.kind === "exercise" && steps[insertion]!.targetId !== exerciseId) others += 1; insertion += 1; }
    const warmups = lesson.exercises.filter(exercise => exercise.id !== exerciseId).slice(0, 2 - others).map(exercise => ({ id: `extra-${exerciseId}-${exercise.id}`, kind: "exercise" as const, targetId: exercise.id }));
    steps.splice(insertion, 0, ...warmups, { id: `retry-${exerciseId}`, kind: "exercise", targetId: exerciseId });
  }
  const next = steps.find(step => !advanced.has(step.id)) ?? steps[steps.length - 1]!;
  const initiallyLearned = lesson.words.filter(word => advanced.has(`meaning-${word.id}`) && advanced.has(`reading-${word.id}`)).map(word => word.id);
  const ownExercise = lesson.exercises.find(exercise => exercise.kind === "sentence");
  const grammarAttempts = attempts.filter(attempt => exerciseForStep(lesson, attempt.event.stepId)?.id === ownExercise?.id);
  const demonstrated = grammarAttempts.find(attempt => attempt.assessment.outcome === "independent") ?? grammarAttempts.find(attempt => attempt.assessment.outcome === "assisted");
  const grammarState = demonstrated?.assessment.outcome ?? (grammarAttempts.some(attempt => attempt.assessment.outcome === "pending") ? "pending" : "notObserved");
  return { events, steps, advanced, attempts, next, initiallyLearned, grammarState, finishedText: steps.filter(step => step.kind !== "recap").every(step => advanced.has(step.id)), meaningfulDays: [...new Set(attempts.filter(attempt => attempt.assessment.outcome !== "pending").map(attempt => attempt.event.localDay))], spans: events.flatMap(event => event.spans) };
}
export function initialReviewTracks(lesson: PreparedLesson, events: readonly StudyEvent[], checked: Readonly<Record<string,Assessment>> = {}) {
  const projection = sessionProjection(lesson, events, checked);
  const tracks: { id: string; facet: "meaning" | "reading" | "grammar"; targetId: string; stage: number; introducedAt: number; dueAt: number }[] = [];
  for (const wordId of projection.initiallyLearned) {
    const meaning = projection.events.find(event => event.kind === "advanced" && event.stepId === `meaning-${wordId}`);
    const reading = projection.events.find(event => event.kind === "advanced" && event.stepId === `reading-${wordId}`);
    if (!meaning || !reading) continue;
    const introducedAt = Math.max(meaning.occurredAt, reading.occurredAt);
    for (const facet of ["meaning", "reading"] as const) tracks.push({ id: `${lesson.id}:${lesson.version}:${wordId}:${facet}`, facet, targetId: wordId, stage: 0, introducedAt, dueAt: introducedAt + recallIntervals[0]! });
  }
  const demonstrated = projection.attempts.find(attempt => exerciseForStep(lesson, attempt.event.stepId)?.kind === "sentence" && ["independent", "assisted"].includes(attempt.assessment.outcome));
  const grammar = demonstrated && projection.events.find(event => event.kind === "advanced" && event.stepId === demonstrated.event.stepId && event.occurredAt >= demonstrated.event.occurredAt);
  if (grammar && ["independent", "assisted"].includes(projection.grammarState)) tracks.push({ id: `${lesson.id}:${lesson.version}:${lesson.grammar.id}:grammar`, facet: "grammar", targetId: lesson.grammar.id, stage: 0, introducedAt: grammar.occurredAt, dueAt: grammar.occurredAt + grammarIntervals[0]! });
  return tracks;
}
