import { v } from "convex/values";
import { supportValue } from "./studyValues";
import { phraseValue } from "./conversationValues";
export const reviewFacetValue = v.union(
  v.literal("meaning"),
  v.literal("reading"),
  v.literal("kana"),
  v.literal("grammar"),
);
const outcome = v.union(
  v.literal("independent"),
  v.literal("assisted"),
  v.literal("incorrect"),
  v.literal("dontKnow"),
  v.literal("validAlternative"),
  v.literal("pending"),
  v.literal("unassessed"),
);
const exercise = v.object({
  id: v.string(),
  facet: v.union(reviewFacetValue, v.literal("sentence")),
  kind: v.union(
    v.literal("recall"),
    v.literal("choice"),
    v.literal("tiles"),
    v.literal("gap"),
    v.literal("sentence"),
  ),
  prompt: v.string(),
  japanese: v.optional(v.string()),
  targetId: v.string(),
  expected: v.string(),
  accepted: v.array(v.string()),
  romaji: v.optional(v.array(v.string())),
  alternatives: v.optional(v.array(v.string())),
  options: v.optional(v.array(v.string())),
  tiles: v.optional(v.array(v.string())),
  explanation: v.string(),
  hints: v.array(v.string()),
});
export const reviewCardValue = v.object({
  id: v.string(),
  facet: reviewFacetValue,
  source: v.union(v.literal("lesson"), v.literal("phrase")),
  sourceId: v.string(),
  sourceVersion: v.number(),
  label: v.string(),
  exercise,
});
export const reviewTrackValue = v.object({
  id: v.string(),
  algorithm: v.literal(1),
  card: reviewCardValue,
  introducedAt: v.number(),
  stage: v.number(),
  dueAt: v.number(),
  revision: v.number(),
  rootOpportunityId: v.string(),
  opportunityId: v.string(),
  parentResolutionId: v.string(),
  independentDays: v.array(v.string()),
  qualifyingDays: v.array(v.string()),
  lastSessionId: v.optional(v.string()),
});
export const reviewOpportunityValue = v.object({
  id: v.string(),
  trackId: v.string(),
  algorithm: v.literal(1),
  revision: v.number(),
  parentResolutionId: v.string(),
  parentEventId: v.optional(v.string()),
  dueAt: v.number(),
  stage: v.number(),
  status: v.union(v.literal("open"), v.literal("closed")),
  resolution: v.optional(
    v.object({
      id: v.string(),
      eventId: v.string(),
      outcome,
      occurredAt: v.number(),
      stage: v.number(),
      dueAt: v.number(),
      nextOpportunityId: v.string(),
    }),
  ),
});
export const reviewAttemptValue = v.object({
  eventId: v.string(),
  sessionId: v.string(),
  deviceId: v.string(),
  sequence: v.number(),
  occurredAt: v.number(),
  localDay: v.string(),
  timezone: v.string(),
  offsetMinutes: v.number(),
  input: v.optional(v.string()),
  dontKnow: v.optional(v.boolean()),
  support: v.array(supportValue),
  spans: v.array(
    v.object({
      start: v.number(),
      end: v.number(),
      localDay: v.string(),
      offsetMinutes: v.number(),
    }),
  ),
  algorithm: v.literal(1),
  trackId: v.string(),
  opportunityId: v.string(),
  parentResolutionId: v.string(),
  parentEventId: v.optional(v.string()),
  baseRevision: v.number(),
  mode: v.union(v.literal("due"), v.literal("extra")),
});
export const reviewAssessmentResultValue = v.object({
  outcome,
  normalized: v.string(),
  expected: v.string(),
  explanation: v.string(),
  inputScript: v.union(
    v.literal("english"),
    v.literal("kana"),
    v.literal("romaji"),
    v.literal("japanese"),
    v.literal("tiles"),
    v.literal("none"),
  ),
  kanaEvidence: v.boolean(),
  targetObserved: v.boolean(),
});
export const reviewFeedbackValue = v.object({
  status: v.union(
    v.literal("queued"),
    v.literal("running"),
    v.literal("ready"),
    v.literal("unavailable"),
  ),
  attempt: v.number(),
  updatedAt: v.number(),
  leaseUntil: v.optional(v.number()),
  corrected: v.optional(phraseValue),
});
export const reviewReceiptValue = v.object({
  eventId: v.string(),
  revision: v.number(),
  status: v.union(
    v.literal("applied-to-schedule"),
    v.literal("stale-practice"),
    v.literal("extra-practice"),
    v.literal("awaiting-parent"),
    v.literal("pending-assessment"),
    v.literal("invalid-with-reason"),
  ),
  assessment: v.object({
    outcome,
    normalized: v.string(),
    expected: v.string(),
    explanation: v.string(),
    inputScript: v.union(
      v.literal("english"),
      v.literal("kana"),
      v.literal("romaji"),
      v.literal("japanese"),
      v.literal("tiles"),
      v.literal("none"),
    ),
    kanaEvidence: v.boolean(),
    targetObserved: v.boolean(),
  }),
  opportunityId: v.string(),
  resolutionId: v.optional(v.string()),
  reason: v.optional(v.string()),
  feedback: v.optional(reviewFeedbackValue),
});
export const reviewChangeValue = v.union(
  v.object({
    kind: v.literal("introduced"),
    track: reviewTrackValue,
    opportunity: reviewOpportunityValue,
  }),
  v.object({
    kind: v.literal("attempt"),
    event: reviewAttemptValue,
    receipt: reviewReceiptValue,
    track: v.optional(reviewTrackValue),
    closed: v.optional(reviewOpportunityValue),
    next: v.optional(reviewOpportunityValue),
  }),
);
