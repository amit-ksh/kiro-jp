import { v } from "convex/values";

export const speechSourceValue = v.object({
  lessonSessionId: v.optional(v.string()),
  conversationSegmentId: v.optional(v.string()),
  cueId: v.string(),
});
export const speechStatusValue = v.union(
  v.literal("awaitingUpload"),
  v.literal("uploading"),
  v.literal("queued"),
  v.literal("running"),
  v.literal("ready"),
  v.literal("empty"),
  v.literal("unavailable"),
  v.literal("deleted"),
);
export const speechSegmentValue = v.object({
  text: v.string(),
  start: v.number(),
  end: v.number(),
});
