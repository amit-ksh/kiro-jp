import { v } from "convex/values";
export const profileValue = v.object({
  estimatedLevel: v.union(v.literal("new"), v.literal("not-sure"), v.literal("n5"), v.literal("n4")),
  acceptedBand: v.union(v.literal("foundations"), v.literal("early-n5"), v.literal("early-n4")),
  goal: v.union(v.literal("conversation"), v.literal("travel"), v.literal("jlpt"), v.literal("media")),
  dailyMinutes: v.number(), targetJlpt: v.union(v.literal("N5"), v.literal("N4"), v.literal("N3"), v.literal("N2"), v.literal("N1")), examDate: v.optional(v.string()),
  interests: v.array(v.string()), favorites: v.array(v.string()), dislikes: v.array(v.string()),
  onboardingStep: v.union(v.literal("setup"), v.literal("import"), v.literal("placement"), v.literal("interests"), v.literal("preview"), v.literal("complete")),
  placementResponses: v.array(v.object({ questionId: v.string(), bankVersion: v.number(), outcome: v.union(v.literal("correct"), v.literal("incorrect"), v.literal("dontKnow"), v.literal("unavailable")) })),
  placementSkipped: v.boolean(), importSkipped: v.boolean(), furigana: v.boolean(), romaji: v.boolean(), translations: v.boolean(), textScale: v.number(), audioSpeed: v.number(), reminderEnabled: v.boolean(), reminderTime: v.optional(v.string()), reminderOfferDismissed: v.optional(v.boolean()),
});
