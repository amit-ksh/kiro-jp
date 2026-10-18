import { v } from "convex/values";
import { culturalEntityValue } from "./cultureValues";
export const dailySuggestionValue = v.object({
  title: v.string(),
  topic: v.string(),
  interest: v.string(),
  entity: culturalEntityValue,
  inputs: v.array(v.string()),
  checkedAt: v.number(),
  angle: v.number(),
});
