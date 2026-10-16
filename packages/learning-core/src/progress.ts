import type { Assessment, LearningFacet, PreparedLesson } from "./lesson.ts";
import type { createCurriculum } from "./curriculum.ts";
import { parseExamDate } from "./profile.ts";
import {
  activeMilliseconds,
  unionStudyMilliseconds,
  exerciseForStep,
  sessionProjection,
  type StudyEvent,
} from "./study.ts";
import {
  reviewEarnsStreak,
  type ReviewAttempt,
  type ReviewReceipt,
  type ReviewTrack,
} from "./reviews.ts";

export type ProgressFacet = "meaning" | "reading" | "kana" | "grammar";
export interface PracticeCounts {
  independent: number;
  assisted: number;
  incorrect: number;
  dontKnow: number;
  validAlternative: number;
  pending: number;
  unassessed: number;
  kanaEvidence: number;
  romaji: number;
}
export interface PracticeSuggestion {
  key: string;
  label: string;
  facet: ProgressFacet;
  sessions: number;
  lastMissAt: number;
  lessonId?: string;
  lessonVersion?: number;
  trackId?: string;
}
export interface ProgressSource {
  today: string;
  dailyMinutes: number;
  events: readonly StudyEvent[];
  checked?: Readonly<Record<string, Assessment>>;
  curriculum: Pick<ReturnType<typeof createCurriculum>, "get" | "forEvent">;
  reviews: {
    tracks: readonly ReviewTrack[];
    attempts: readonly ReviewAttempt[];
    receipts: ReadonlyMap<string, ReviewReceipt>;
    provisional?: ReadonlySet<string>;
  };
}
const emptyCounts = (): PracticeCounts => ({
  independent: 0,
  assisted: 0,
  incorrect: 0,
  dontKnow: 0,
  validAlternative: 0,
  pending: 0,
  unassessed: 0,
  kanaEvidence: 0,
  romaji: 0,
});
const facet = (value: LearningFacet): ProgressFacet =>
  value === "sentence" ? "grammar" : value;
function dayBefore(day: string, count = 1) {
  return new Date(Date.parse(`${day}T12:00:00Z`) - count * 86_400_000)
    .toISOString()
    .slice(0, 10);
}
type Stamp = Pick<
  StudyEvent,
  "eventId" | "sessionId" | "deviceId" | "sequence" | "occurredAt" | "localDay"
>;
type Observation = {
  stamp: Stamp;
  assessment: Assessment;
  suggestion: Omit<PracticeSuggestion, "sessions" | "lastMissAt">;
};
function lessonSuggestion(lesson: PreparedLesson, stepId: string) {
  const exercise = exerciseForStep(lesson, stepId)!;
  const kind = facet(exercise.facet);
  // Whole-word meanings and individual kanji meanings remain different items.
  const target =
    kind === "grammar"
      ? `${exercise.targetId}:${exercise.kind === "sentence" ? "production" : "recognition"}`
      : exercise.id;
  return {
    key: `lesson:${lesson.id}:${lesson.version}:${kind}:${target}`,
    label:
      kind === "grammar"
        ? lesson.grammar.pattern
        : (exercise.japanese ?? exercise.prompt),
    facet: kind,
    lessonId: lesson.id,
    lessonVersion: lesson.version,
  };
}

/** Read-only evidence summary: it never mutates schedules, mastery or history. */
export function learningProgress(source: ProgressSource) {
  if (
    parseExamDate(source.today) !== source.today ||
    !Number.isFinite(source.dailyMinutes) ||
    source.dailyMinutes <= 0
  )
    throw new Error("Invalid progress calendar or goal.");
  const events = [
    ...new Map(source.events.map((event) => [event.eventId, event])).values(),
  ];
  const reviews = [
    ...new Map(
      source.reviews.attempts.map((event) => [event.eventId, event]),
    ).values(),
  ];
  const week = Array.from({ length: 7 }, (_, i) =>
    dayBefore(source.today, 6 - i),
  );
  const inWeek = new Set(week);
  const meaningful = new Set<string>();
  // Count learning items, never meaning/reading tracks or repeated sessions.
  const kanji = new Set<string>(),
    vocabulary = new Set<string>(),
    grammar = new Set<string>(),
    kana = new Set<string>(),
    phrases = new Set<string>();
  const rememberWord = (word: PreparedLesson["words"][number]) => {
    for (const character of word.kanji)
      if (/\p{Script=Han}/u.test(character)) kanji.add(character);
    vocabulary.add(`${word.word}（${word.reading}）`);
  };
  const observations: Observation[] = [];
  const trackSuggestions = new Map<string, string>();
  const trackById = new Map(
    source.reviews.tracks.map((track) => [track.id, track]),
  );
  for (const track of source.reviews.tracks) {
    const lesson =
      track.card.source === "lesson"
        ? source.curriculum.get(track.card.sourceId, track.card.sourceVersion)
        : undefined;
    const exercise = lesson && exerciseForStep(lesson, track.card.exercise.id);
    if (lesson && exercise)
      trackSuggestions.set(lessonSuggestion(lesson, exercise.id).key, track.id);
  }
  const sessions = new Map<string, StudyEvent[]>();
  for (const event of events) {
    if (event.kind === "conversationTurn" && event.input === "meaningful")
      meaningful.add(event.localDay);
    if (
      !source.curriculum.forEvent(event) ||
      ["library", "review", "conversation", "reference"].includes(
        event.lessonId,
      )
    )
      continue;
    const rows = sessions.get(event.sessionId) ?? [];
    rows.push(event);
    sessions.set(event.sessionId, rows);
  }
  for (const rows of sessions.values()) {
    const lesson = source.curriculum.forEvent(rows[0]!);
    if (!lesson) continue;
    const projection = sessionProjection(lesson, rows, source.checked);
    for (const word of lesson.words)
      if (projection.initiallyLearned.includes(word.id)) rememberWord(word);
    for (const item of lesson.kana) {
      const exercise = lesson.exercises.find(
        (e) => e.facet === "kana" && e.targetId === item.character,
      );
      if (
        exercise &&
        projection.advanced.has(exercise.id) &&
        projection.attempts.some((a) => a.event.stepId === exercise.id)
      )
        kana.add(item.character);
    }
    const ownSentence = lesson.exercises.find((e) => e.kind === "sentence");
    if (
      ownSentence &&
      projection.advanced.has(ownSentence.id) &&
      ["independent", "assisted"].includes(projection.grammarState)
    )
      grammar.add(lesson.grammar.pattern);
    for (const attempt of projection.attempts) {
      const { event, assessment } = attempt;
      if (
        !["pending", "unassessed"].includes(assessment.outcome) &&
        (event.dontKnow || event.input?.trim())
      )
        meaningful.add(event.localDay);
      const suggestion = lessonSuggestion(lesson, event.stepId);
      observations.push({
        stamp: event,
        assessment,
        suggestion: {
          ...suggestion,
          trackId: trackSuggestions.get(suggestion.key),
        },
      });
    }
  }
  // A downloaded review history can outlive the local lesson journal. Only
  // known curriculum targets with both recall tracks count as introductions.
  const introducedWords = new Map<
    string,
    { word: PreparedLesson["words"][number]; facets: Set<string> }
  >();
  for (const track of source.reviews.tracks) {
    if (track.card.source === "phrase") {
      phrases.add(track.card.sourceId);
      continue;
    }
    const lesson = source.curriculum.get(
      track.card.sourceId,
      track.card.sourceVersion,
    );
    if (!lesson) continue;
    const exercise = lesson.exercises.find(
      (e) => e.id === track.card.exercise.id,
    );
    if (!exercise || exercise.facet !== track.card.facet) continue;
    if (track.card.facet === "grammar" && exercise.kind === "sentence")
      grammar.add(lesson.grammar.pattern);
    if (track.card.facet === "kana") kana.add(exercise.targetId);
    const word = lesson.words.find((w) => w.id === exercise.targetId);
    if (
      !word ||
      !["meaning", "reading"].includes(track.card.facet) ||
      exercise.id !== `${track.card.facet}-${word.id}`
    )
      continue;
    const key = `${lesson.id}:${lesson.version}:${word.id}`;
    const row = introducedWords.get(key) ?? { word, facets: new Set<string>() };
    row.facets.add(track.card.facet);
    introducedWords.set(key, row);
  }
  for (const { word, facets } of introducedWords.values())
    if (facets.has("meaning") && facets.has("reading")) rememberWord(word);
  for (const event of reviews) {
    const track = trackById.get(event.trackId),
      receipt = source.reviews.receipts.get(event.eventId);
    if (!track || !receipt) continue;
    if (reviewEarnsStreak(event, receipt)) meaningful.add(event.localDay);
    // Invalid sources and unavailable feedback never become mistake evidence.
    if (receipt.status === "invalid-with-reason") continue;
    const lesson =
      track.card.source === "lesson"
        ? source.curriculum.get(track.card.sourceId, track.card.sourceVersion)
        : undefined;
    const exercise = lesson && exerciseForStep(lesson, track.card.exercise.id);
    const suggestion =
      lesson && exercise
        ? { ...lessonSuggestion(lesson, exercise.id), trackId: track.id }
        : {
            key: `review:${track.id}`,
            label: track.card.label,
            facet: track.card.facet,
            trackId: track.id,
          };
    observations.push({
      stamp: event,
      assessment: receipt.assessment,
      suggestion,
    });
  }
  const skills: Record<ProgressFacet, PracticeCounts> = {
    meaning: emptyCounts(),
    reading: emptyCounts(),
    kana: emptyCounts(),
    grammar: emptyCounts(),
  };
  const misses = new Map<
    string,
    {
      suggestion: Observation["suggestion"];
      sessions: Set<string>;
      lastMissAt: number;
    }
  >();
  observations.sort(
    (a, b) =>
      a.stamp.occurredAt - b.stamp.occurredAt ||
      a.stamp.deviceId.localeCompare(b.stamp.deviceId) ||
      a.stamp.sequence - b.stamp.sequence ||
      a.stamp.eventId.localeCompare(b.stamp.eventId),
  );
  for (const { stamp, assessment, suggestion } of observations) {
    if (!inWeek.has(stamp.localDay)) continue;
    const counts = skills[suggestion.facet];
    counts[assessment.outcome]++;
    if (assessment.kanaEvidence) counts.kanaEvidence++;
    if (
      assessment.inputScript === "romaji" &&
      ["independent", "assisted"].includes(assessment.outcome)
    )
      counts.romaji++;
    const previous = misses.get(suggestion.key);
    if (assessment.outcome === "independent") {
      // A new independent success resolves older misses for recommendations.
      misses.delete(suggestion.key);
    } else if (["incorrect", "dontKnow"].includes(assessment.outcome)) {
      const row = previous ?? {
        suggestion,
        sessions: new Set<string>(),
        lastMissAt: stamp.occurredAt,
      };
      row.sessions.add(stamp.sessionId);
      row.lastMissAt = stamp.occurredAt;
      misses.set(suggestion.key, row);
    }
  }
  const allSpans = [
    ...events.flatMap((event) => event.spans),
    ...reviews.flatMap((event) => event.spans),
  ];
  const listening = events
    .filter(
      (event) => event.kind === "audioActivity" && event.input === "listening",
    )
    .flatMap((event) => event.spans);
  const speaking = events
    .filter(
      (event) => event.kind === "audioActivity" && event.input === "speaking",
    )
    .flatMap((event) => event.spans);
  const days = week.map((day) => {
    const milliseconds = activeMilliseconds(allSpans, day);
    return {
      day,
      milliseconds,
      listeningMilliseconds: activeMilliseconds(listening, day),
      speakingMilliseconds: activeMilliseconds(speaking, day),
      meaningful: meaningful.has(day),
      // Past goal values were not recorded, so only today's achievement is known.
      goalMet:
        day === source.today
          ? milliseconds >= source.dailyMinutes * 60_000
          : null,
    };
  });
  const earnedDays = [...meaningful]
    .filter((day) => day <= source.today)
    .sort();
  let streak = 0,
    at = meaningful.has(source.today) ? source.today : dayBefore(source.today);
  while (meaningful.has(at)) {
    streak++;
    at = dayBefore(at);
  }
  const suggestions: PracticeSuggestion[] = [...misses.values()]
    .filter((row) => row.sessions.size >= 2)
    .map((row) => ({
      ...row.suggestion,
      sessions: row.sessions.size,
      lastMissAt: row.lastMissAt,
    }))
    .sort(
      (a, b) =>
        b.sessions - a.sessions ||
        b.lastMissAt - a.lastMissAt ||
        a.key.localeCompare(b.key),
    )
    .slice(0, 3);
  return {
    inventory: {
      kanji: [...kanji].sort(),
      vocabulary: [...vocabulary].sort(),
      grammar: [...grammar].sort(),
      kana: [...kana].sort(),
      savedPhrases: phrases.size,
    },
    days,
    today: days[days.length - 1]!,
    streak,
    earnedDays,
    skills,
    suggestions,
    weeklyMilliseconds: unionStudyMilliseconds(
      allSpans.filter((span) => inWeek.has(span.localDay)),
    ),
    listeningMilliseconds: unionStudyMilliseconds(
      listening.filter((span) => inWeek.has(span.localDay)),
    ),
    speakingMilliseconds: unionStudyMilliseconds(
      speaking.filter((span) => inWeek.has(span.localDay)),
    ),
    meaningfulDaysThisWeek: days.filter((day) => day.meaningful).length,
    provisionalReviewTracks: source.reviews.provisional?.size ?? 0,
    conversationTurns: events.filter(
      (event) =>
        event.kind === "conversationTurn" &&
        event.input === "meaningful" &&
        inWeek.has(event.localDay),
    ).length,
    assistedConversationTurns: events.filter(
      (event) =>
        event.kind === "conversationTurn" &&
        event.input === "meaningful" &&
        event.support.length > 0 &&
        inWeek.has(event.localDay),
    ).length,
  };
}
