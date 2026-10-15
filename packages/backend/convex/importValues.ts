import { v } from "convex/values";
export const importCodeValue = v.union(
  v.literal("invalid-token"),
  v.literal("rate-limited"),
  v.literal("unavailable"),
  v.literal("invalid-response"),
);
export const familiarityValue = v.object({
  subjectId: v.number(),
  type: v.union(
    v.literal("kanji"),
    v.literal("vocabulary"),
    v.literal("kana_vocabulary"),
  ),
  characters: v.string(),
  level: v.number(),
  srsStage: v.number(),
  startedAt: v.string(),
});
export const importDataValue = v.object({
  userLevel: v.number(),
  maxLevelGranted: v.number(),
  items: v.array(familiarityValue),
});
export const importSnapshotValue = v.object({
  importedAt: v.number(),
  userLevel: v.number(),
  maxLevelGranted: v.number(),
  items: v.array(familiarityValue),
});
