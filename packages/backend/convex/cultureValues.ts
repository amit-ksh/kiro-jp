import { v } from "convex/values";
export const culturalTypeValue = v.union(
  v.literal("urn:entity:place"),
  v.literal("urn:entity:book"),
  v.literal("urn:entity:tv_show"),
  v.literal("urn:entity:movie"),
  v.literal("urn:entity:artist"),
);
export const culturalEntityValue = v.object({
  id: v.string(),
  name: v.string(),
  type: culturalTypeValue,
  description: v.optional(v.string()),
  disambiguation: v.optional(v.string()),
});
export const culturalSnapshotValue = v.object({
  candidates: v.array(
    v.object({
      query: v.string(),
      type: culturalTypeValue,
      items: v.array(culturalEntityValue),
    }),
  ),
  recommendations: v.array(
    v.object({
      entity: culturalEntityValue,
      inputs: v.array(v.string()),
      checkedAt: v.number(),
    }),
  ),
});
