import { v } from "convex/values";
export const supportValue = v.union(...(["wordBank", "patternHint", "example", "testedAnswer", "suggestedReply", "transcriptEdited", "correctionRetry"] as const).map(value => v.literal(value)));
export const studyEventValue = v.object({
  eventId: v.string(), sessionId: v.string(), deviceId: v.string(), sequence: v.number(), lessonId: v.string(), lessonVersion: v.number(), occurredAt: v.number(), localDay: v.string(), timezone: v.string(), offsetMinutes: v.number(),
  kind: v.union(v.literal("started"), v.literal("studied"), v.literal("attempted"), v.literal("advanced"), v.literal("activity"), v.literal("savedPhrase"), v.literal("conversationActivity"), v.literal("conversationTurn")), stepId: v.string(), input: v.optional(v.string()), dontKnow: v.optional(v.boolean()), support: v.array(supportValue),
  spans: v.array(v.object({ start: v.number(), end: v.number(), localDay: v.string(), offsetMinutes: v.number() })),
  context: v.optional(v.object({ theme: v.string(), band: v.union(v.literal("foundations"), v.literal("early-n5"), v.literal("early-n4")), romaji: v.boolean(), furigana: v.boolean(), translations: v.boolean() })),
});
