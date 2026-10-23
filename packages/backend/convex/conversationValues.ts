import { v } from "convex/values";
export const conversationCategoryValue = v.union(
  v.literal("places"), v.literal("anime-manga"), v.literal("food"), v.literal("daily-life"),
);
export const practiceStampValue = v.object({
  occurredAt: v.number(),
  offsetMinutes: v.number(),
  timezone: v.string(),
});
export const phraseValue = v.object({
  japanese: v.string(),
  reading: v.string(),
  romaji: v.string(),
  english: v.string(),
});
export const assessmentValue = v.object({
  validity: v.union(
    v.literal("appropriate"),
    v.literal("needsCorrection"),
    v.literal("uncertain"),
  ),
  meaningfulJapanese: v.boolean(),
  target: v.union(
    v.literal("used"),
    v.literal("notUsed"),
    v.literal("uncertain"),
  ),
  messageId: v.string(),
  span: v.string(),
  explanation: v.string(),
});
export const replyValue = v.object({
  japanese: v.string(),
  reading: v.string(),
  romaji: v.string(),
  english: v.string(),
  hints: v.array(phraseValue),
  usefulPhrases: v.array(phraseValue),
  corrections: v.array(
    v.object({
      original: v.string(),
      corrected: phraseValue,
      explanation: v.string(),
    }),
  ),
  usedContextIds: v.array(v.string()),
  assessment: assessmentValue,
});
export const goalValue = v.object({
  state: v.union(
    v.literal("notObserved"),
    v.literal("assisted"),
    v.literal("independent"),
    v.literal("awaitingAssessment"),
  ),
  meaningful: v.boolean(),
  messageId: v.string(),
  span: v.optional(v.string()),
  explanation: v.string(),
});
export const jobStateValue = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("stale"),
);
