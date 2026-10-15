import {
  assessFixed,
  grammarIntervals,
  recallIntervals,
  scheduleTransition,
  type Assessment,
  type LessonExercise,
  type PreparedLesson,
} from "./lesson.ts";
import {
  initialReviewTracks,
  sessionProjection,
  validateStudyStamp,
  type StudyEvent,
} from "./study.ts";
import type { TutorPhrase } from "./conversation.ts";

export const reviewAlgorithm = 1 as const;
export type ReviewFacet = "meaning" | "reading" | "kana" | "grammar";
export type ReviewDigest = (text: string) => Promise<string>;
export interface ReviewCard {
  id: string;
  facet: ReviewFacet;
  source: "lesson" | "phrase";
  sourceId: string;
  sourceVersion: number;
  label: string;
  exercise: LessonExercise;
}
export interface ReviewTrack {
  id: string;
  algorithm: 1;
  card: ReviewCard;
  introducedAt: number;
  stage: number;
  dueAt: number;
  revision: number;
  rootOpportunityId: string;
  opportunityId: string;
  parentResolutionId: string;
  independentDays: string[];
  qualifyingDays: string[];
  lastSessionId?: string;
}
export interface ReviewResolution {
  id: string;
  eventId: string;
  outcome: Assessment["outcome"];
  occurredAt: number;
  stage: number;
  dueAt: number;
  nextOpportunityId: string;
}
export interface ReviewOpportunity {
  id: string;
  trackId: string;
  algorithm: 1;
  revision: number;
  parentResolutionId: string;
  parentEventId?: string;
  dueAt: number;
  stage: number;
  status: "open" | "closed";
  resolution?: ReviewResolution;
}
export interface ReviewAttempt extends Pick<
  StudyEvent,
  | "eventId"
  | "sessionId"
  | "deviceId"
  | "sequence"
  | "occurredAt"
  | "localDay"
  | "timezone"
  | "offsetMinutes"
  | "input"
  | "dontKnow"
  | "support"
  | "spans"
> {
  algorithm: 1;
  trackId: string;
  opportunityId: string;
  parentResolutionId: string;
  parentEventId?: string;
  baseRevision: number;
  mode: "due" | "extra";
}
export type ReviewStatus =
  | "applied-to-schedule"
  | "stale-practice"
  | "extra-practice"
  | "awaiting-parent"
  | "pending-assessment"
  | "invalid-with-reason";
export interface ReviewReceipt {
  eventId: string;
  revision: number;
  status: ReviewStatus;
  assessment: Assessment;
  opportunityId: string;
  resolutionId?: string;
  reason?: string;
  feedback?: ReviewFeedback;
}
export interface ReviewFeedback {
  status: "queued" | "running" | "ready" | "unavailable";
  attempt: number;
  updatedAt: number;
  leaseUntil?: number;
  corrected?: TutorPhrase;
}
export interface ReviewDecision {
  receipt: ReviewReceipt;
  track?: ReviewTrack;
  closed?: ReviewOpportunity;
  next?: ReviewOpportunity;
}
export type ReviewChange =
  | { kind: "introduced"; track: ReviewTrack; opportunity: ReviewOpportunity }
  | {
      kind: "attempt";
      event: ReviewAttempt;
      receipt: ReviewReceipt;
      track?: ReviewTrack;
      closed?: ReviewOpportunity;
      next?: ReviewOpportunity;
    };

async function identity(parts: unknown[], digest: ReviewDigest) {
  const hash = await digest(JSON.stringify(parts));
  if (!/^[a-f0-9]{64}$/u.test(hash))
    throw new Error("A SHA-256 digest is required.");
  return `r1_${hash}`;
}
export async function introduceReview(
  card: ReviewCard,
  introducedAt: number,
  digest: ReviewDigest,
) {
  const parent = await identity(
    ["introduction", reviewAlgorithm, card.id, introducedAt],
    digest,
  );
  const opportunityId = await identity(
    ["opportunity", reviewAlgorithm, card.id, parent],
    digest,
  );
  const dueAt =
    introducedAt +
    (card.facet === "grammar" ? grammarIntervals[0]! : recallIntervals[0]!);
  const track: ReviewTrack = {
    id: card.id,
    algorithm: reviewAlgorithm,
    card,
    introducedAt,
    stage: 0,
    dueAt,
    revision: 0,
    rootOpportunityId: opportunityId,
    opportunityId,
    parentResolutionId: parent,
    independentDays: [],
    qualifyingDays: [],
  };
  const opportunity: ReviewOpportunity = {
    id: opportunityId,
    trackId: card.id,
    algorithm: reviewAlgorithm,
    revision: 0,
    parentResolutionId: parent,
    dueAt,
    stage: 0,
    status: "open",
  };
  return { track, opportunity };
}
export function lessonReviewIntroductions(
  lesson: PreparedLesson,
  events: readonly StudyEvent[],
  checked: Readonly<Record<string, Assessment>> = {},
) {
  const introductions: { card: ReviewCard; introducedAt: number }[] = [];
  for (const track of initialReviewTracks(lesson, events, checked)) {
    const exercise = lesson.exercises.find((exercise) =>
      track.facet === "grammar"
        ? exercise.kind === "sentence"
        : exercise.id === `${track.facet}-${track.targetId}`,
    );
    if (!exercise) continue;
    introductions.push({
      introducedAt: track.introducedAt,
      card: {
        id: track.id,
        facet: track.facet,
        source: "lesson",
        sourceId: lesson.id,
        sourceVersion: lesson.version,
        label:
          track.facet === "grammar"
            ? lesson.grammar.pattern
            : lesson.words.find((word) => word.id === track.targetId)!.word,
        exercise,
      },
    });
  }
  const projection = sessionProjection(lesson, events, checked);
  for (const word of lesson.words) {
    if (!word.vocabulary) continue;
    const exercise = lesson.exercises.find(exercise => exercise.id === `vocabulary-${word.id}` && exercise.facet === "meaning" && exercise.targetId === word.id);
    const advance = exercise && projection.events.find(event => event.kind === "advanced" && event.stepId === exercise.id && projection.attempts.some(attempt => attempt.event.stepId === exercise.id && attempt.event.occurredAt <= event.occurredAt));
    if (exercise && advance) introductions.push({introducedAt:advance.occurredAt,card:{id:`${lesson.id}:${lesson.version}:${word.id}:vocabulary-meaning`,facet:"meaning",source:"lesson",sourceId:lesson.id,sourceVersion:lesson.version,label:word.word,exercise}});
  }
  for (const kana of lesson.kana) {
    const exercise = lesson.exercises.find(
      (exercise) =>
        exercise.facet === "kana" && exercise.targetId === kana.character,
    );
    const advance =
      exercise &&
      projection.events.find(
        (event) =>
          event.kind === "advanced" &&
          event.stepId === exercise.id &&
          projection.attempts.some(
            (attempt) =>
              attempt.event.stepId === exercise.id &&
              attempt.event.occurredAt <= event.occurredAt,
          ),
      );
    if (exercise && advance)
      introductions.push({
        introducedAt: advance.occurredAt,
        card: {
          id: `${lesson.id}:${lesson.version}:${exercise.id}:kana`,
          facet: "kana",
          source: "lesson",
          sourceId: lesson.id,
          sourceVersion: lesson.version,
          label: kana.character,
          exercise,
        },
      });
  }
  const saved = new Set<string>();
  for (const event of projection.events) {
    if (event.kind !== "savedPhrase" || !event.input || saved.has(event.input)) continue;
    const sentence = lesson.grammar.examples.find(example => example.id === event.input);
    if (!sentence) continue;
    saved.add(sentence.id);
    for (const item of phraseReviewIntroductions(sentence.id, {
      japanese: sentence.text,
      reading: sentence.reading,
      romaji: sentence.romaji,
      english: sentence.meaning,
    }, event.occurredAt)) introductions.push({
      ...item,
      card: {
        ...item.card,
        id: `${lesson.id}:${lesson.version}:saved-phrase:${sentence.id}:${item.card.facet}`,
        source: "lesson",
        sourceId: lesson.id,
        sourceVersion: lesson.version,
        exercise: {...item.card.exercise,id:`saved-${sentence.id}-${item.card.facet}`},
      },
    });
  }
  return introductions;
}
export function phraseReviewIntroductions(
  id: string,
  phrase: {
    japanese: string;
    reading: string;
    romaji: string;
    english: string;
  },
  introducedAt: number,
) {
  return (["meaning", "reading"] as const).map((facet) => ({
    introducedAt,
    card: {
      id: `phrase:${id}:1:${facet}`,
      facet,
      source: "phrase" as const,
      sourceId: id,
      sourceVersion: 1,
      label: phrase.japanese,
      exercise: {
        id: `${facet}-${id}`,
        facet,
        kind: "recall" as const,
        targetId: id,
        japanese: phrase.japanese,
        prompt:
          facet === "meaning"
            ? "Recall the saved English meaning of this phrase."
            : "Read this whole phrase. Kana or romaji is welcome.",
        expected: facet === "meaning" ? phrase.english : phrase.reading,
        accepted: [facet === "meaning" ? phrase.english : phrase.reading],
        ...(facet === "reading" ? { romaji: [phrase.romaji] } : {}),
        explanation: `${phrase.japanese} — ${phrase.english}`,
        hints: [facet === "meaning" ? phrase.english : phrase.reading],
      },
    },
  }));
}
export function validateReviewAttempt(event: ReviewAttempt, now: number) {
  validateStudyStamp(event, now);
  if (
    event.algorithm !== reviewAlgorithm ||
    !event.trackId ||
    event.trackId.length > 240 ||
    !/^r1_[a-f0-9]{64}$/u.test(event.opportunityId) ||
    !/^r1_[a-f0-9]{64}$/u.test(event.parentResolutionId) ||
    (event.parentEventId !== undefined &&
      !/^[a-zA-Z0-9_-]{8,100}$/u.test(event.parentEventId)) ||
    !Number.isInteger(event.baseRevision) ||
    event.baseRevision < 0 ||
    event.baseRevision > 100_000 ||
    !["due", "extra"].includes(event.mode)
  )
    throw new Error("Invalid review attempt.");
}
export function reviewAssessment(
  card: ReviewCard,
  event: ReviewAttempt,
  resolved?: Assessment,
): Assessment {
  const fixed = assessFixed(
    card.exercise,
    event.input ?? "",
    event.support,
    event.dontKnow,
  );
  if (
    fixed.outcome !== "pending" ||
    !resolved ||
    resolved.normalized !== fixed.normalized ||
    resolved.expected !== fixed.expected ||
    resolved.explanation.length > 500
  )
    return fixed;
  const outcome =
    resolved.outcome === "independent" && event.support.length
      ? "assisted"
      : resolved.outcome;
  return {
    ...fixed,
    outcome,
    explanation: resolved.explanation,
    kanaEvidence: false,
    targetObserved: outcome === "independent" || outcome === "assisted",
  };
}
/** The decision never changes a closed opportunity, regardless of occurrence time. */
export async function decideReview(
  track: ReviewTrack,
  opportunity: ReviewOpportunity | undefined,
  parent: ReviewReceipt | undefined,
  event: ReviewAttempt,
  digest: ReviewDigest,
  receiptRevision = 1,
  resolved?: Assessment,
): Promise<ReviewDecision> {
  const assessment = reviewAssessment(track.card, event, resolved);
  const receipt = (status: ReviewStatus, reason?: string): ReviewDecision => ({
    receipt: {
      eventId: event.eventId,
      revision: receiptRevision,
      status,
      assessment,
      opportunityId: event.opportunityId,
      ...(reason ? { reason } : {}),
    },
  });
  if (track.id !== event.trackId)
    return receipt(
      "invalid-with-reason",
      "The card does not match this attempt.",
    );
  if (event.mode === "extra" || event.support.includes("correctionRetry"))
    return receipt("extra-practice");
  if (!opportunity) {
    if (
      event.parentEventId &&
      (!parent ||
        ["awaiting-parent", "pending-assessment"].includes(parent.status))
    )
      return receipt("awaiting-parent");
    return receipt("stale-practice");
  }
  if (
    opportunity.trackId !== event.trackId ||
    opportunity.revision !== event.baseRevision ||
    opportunity.parentResolutionId !== event.parentResolutionId ||
    opportunity.parentEventId !== event.parentEventId
  )
    return receipt(
      "invalid-with-reason",
      "The review snapshot does not match its opportunity.",
    );
  if (opportunity.status === "closed" || track.opportunityId !== opportunity.id)
    return receipt("stale-practice");
  if (
    event.occurredAt < opportunity.dueAt ||
    event.occurredAt < track.introducedAt ||
    event.sessionId === track.lastSessionId
  )
    return receipt("extra-practice");
  if (assessment.outcome === "pending" || assessment.outcome === "unassessed")
    return receipt("pending-assessment");
  const transition = scheduleTransition(
    track.stage,
    assessment.outcome,
    event.occurredAt,
    track.card.facet === "grammar",
  );
  if (!transition) return receipt("extra-practice");
  const resolutionId = await identity(
    [
      "resolution",
      reviewAlgorithm,
      opportunity.id,
      event.eventId,
      assessment.outcome,
    ],
    digest,
  );
  const nextOpportunityId = await identity(
    ["opportunity", reviewAlgorithm, track.id, resolutionId],
    digest,
  );
  const success = assessment.outcome === "independent",
    lapse = ["incorrect", "dontKnow"].includes(assessment.outcome);
  const nextTrack: ReviewTrack = {
    ...track,
    ...transition,
    revision: track.revision + 1,
    opportunityId: nextOpportunityId,
    parentResolutionId: resolutionId,
    lastSessionId: event.sessionId,
    independentDays: success
      ? [...new Set([...track.independentDays, event.localDay])]
      : track.independentDays,
    qualifyingDays: lapse
      ? []
      : success
        ? [...new Set([...track.qualifyingDays, event.localDay])]
        : track.qualifyingDays,
  };
  const resolution: ReviewResolution = {
    id: resolutionId,
    eventId: event.eventId,
    outcome: assessment.outcome,
    occurredAt: event.occurredAt,
    ...transition,
    nextOpportunityId,
  };
  return {
    receipt: { ...receipt("applied-to-schedule").receipt, resolutionId },
    track: nextTrack,
    closed: { ...opportunity, status: "closed", resolution },
    next: {
      id: nextOpportunityId,
      trackId: track.id,
      algorithm: reviewAlgorithm,
      revision: nextTrack.revision,
      parentResolutionId: resolutionId,
      parentEventId: event.eventId,
      ...transition,
      status: "open",
    },
  };
}
export function hasStrongRecall(track: ReviewTrack, now: number) {
  const threshold =
    track.card.facet === "grammar" ? grammarIntervals.length - 1 : 6;
  return (
    track.stage >= threshold &&
    track.qualifyingDays.length >= 5 &&
    now - track.introducedAt >= 21 * 86_400_000
  );
}
/** A completed review attempt is effort even while its skill grade is pending. */
export function reviewEarnsStreak(
  event: ReviewAttempt,
  receipt: ReviewReceipt | undefined,
) {
  return Boolean(receipt && (event.dontKnow || event.input?.trim()));
}
/** Pending sentences keep their schedule, but should not block other due study. */
export function reviewQueue(
  source: {
    tracks: readonly ReviewTrack[];
    attempts: readonly ReviewAttempt[];
    receipts: ReadonlyMap<string, ReviewReceipt>;
  },
  now: number,
) {
  const awaiting = new Set(
    source.attempts.flatMap((event) => {
      const receipt = source.receipts.get(event.eventId);
      return event.mode === "due" &&
        receipt?.assessment.outcome === "pending" &&
        receipt.status !== "invalid-with-reason"
        ? [event.opportunityId]
        : [];
    }),
  );
  const due = source.tracks
    .filter((track) => track.dueAt <= now)
    .sort((a, b) => a.dueAt - b.dueAt || a.id.localeCompare(b.id));
  return {
    ready: due.filter((track) => !awaiting.has(track.opportunityId)),
    awaitingFeedback: due.filter((track) => awaiting.has(track.opportunityId)),
  };
}
export function orderReviewAttempts(events: readonly ReviewAttempt[]) {
  const compare = (a: ReviewAttempt, b: ReviewAttempt) =>
    a.occurredAt - b.occurredAt ||
    a.deviceId.localeCompare(b.deviceId) ||
    a.sequence - b.sequence ||
    a.eventId.localeCompare(b.eventId);
  const pending = [...events].sort(compare),
    ordered: ReviewAttempt[] = [],
    seen = new Set<string>();
  while (pending.length) {
    const index = pending.findIndex(
      (event) =>
        !event.parentEventId ||
        seen.has(event.parentEventId) ||
        !pending.some((parent) => parent.eventId === event.parentEventId),
    );
    if (index < 0) throw new Error("A review chain cannot contain a cycle.");
    const event = pending.splice(index, 1)[0]!;
    ordered.push(event);
    seen.add(event.eventId);
  }
  return ordered;
}

/** Replay server changes in cursor order, then overlay only unresolved local work. */
export async function projectReviews(
  changes: readonly ReviewChange[],
  local: readonly { event: ReviewAttempt; acknowledged: boolean }[],
  introductions: readonly { card: ReviewCard; introducedAt: number }[],
  digest: ReviewDigest,
) {
  const tracks = new Map<string, ReviewTrack>(),
    opportunities = new Map<string, ReviewOpportunity>(),
    receipts = new Map<string, ReviewReceipt>();
  const attempts = new Map<string, ReviewAttempt>(),
    provisional = new Set<string>();
  for (const change of changes) {
    if (change.kind === "introduced") {
      tracks.set(change.track.id, change.track);
      opportunities.set(change.opportunity.id, change.opportunity);
    } else {
      attempts.set(change.event.eventId, change.event);
      const old = receipts.get(change.receipt.eventId);
      if (!old || change.receipt.revision > old.revision)
        receipts.set(change.receipt.eventId, change.receipt);
      if (change.track) tracks.set(change.track.id, change.track);
      if (change.closed) opportunities.set(change.closed.id, change.closed);
      if (change.next) opportunities.set(change.next.id, change.next);
    }
  }
  for (const item of [...introductions].sort(
    (a, b) =>
      a.introducedAt - b.introducedAt || a.card.id.localeCompare(b.card.id),
  ))
    if (!tracks.has(item.card.id)) {
      const initial = await introduceReview(
        item.card,
        item.introducedAt,
        digest,
      );
      tracks.set(item.card.id, initial.track);
      opportunities.set(initial.opportunity.id, initial.opportunity);
      provisional.add(item.card.id);
    }
  for (const row of local) attempts.set(row.event.eventId, row.event);
  const unresolved = local
    .filter(
      (row) =>
        !row.acknowledged ||
        receipts.get(row.event.eventId)?.status === "awaiting-parent",
    )
    .map((row) => row.event);
  for (const event of orderReviewAttempts(unresolved)) {
    const receipt = receipts.get(event.eventId);
    if (receipt && !["awaiting-parent"].includes(receipt.status)) continue;
    const track = tracks.get(event.trackId);
    if (!track) continue;
    const decision = await decideReview(
      track,
      opportunities.get(event.opportunityId),
      event.parentEventId ? receipts.get(event.parentEventId) : undefined,
      event,
      digest,
      (receipt?.revision ?? 0) + 1,
      receipt?.assessment,
    );
    if (receipt?.feedback) decision.receipt.feedback = receipt.feedback;
    receipts.set(event.eventId, decision.receipt);
    if (decision.track && decision.closed && decision.next) {
      tracks.set(track.id, decision.track);
      opportunities.set(decision.closed.id, decision.closed);
      opportunities.set(decision.next.id, decision.next);
      provisional.add(track.id);
    }
  }
  return {
    tracks: [...tracks.values()],
    opportunities,
    receipts,
    attempts: [...attempts.values()],
    provisional,
  };
}
