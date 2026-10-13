import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { profileValue } from "./profileValues";
export default defineSchema({
  ...authTables,
  accountEmailLimits: defineTable({ key: v.string(), lastRequestedAt: v.number(), day: v.string(), count: v.number() }).index("by_key", ["key"]),
  aiBudgets: defineTable({ provider: v.literal("gemini"), reservedMicros: v.number(), spentMicros: v.number() }).index("by_provider", ["provider"]),
  aiCostReservations: defineTable({ operationId: v.string(), model: v.string(), reservedMicros: v.number(), inputRate: v.number(), outputRate: v.number(), state: v.union(v.literal("pending"), v.literal("settled")), actualMicros: v.optional(v.number()), createdAt: v.number() }).index("by_operation", ["operationId"]),
  learnerProfiles: defineTable({ userId: v.id("users"), revision: v.number(), data: profileValue, updatedAt: v.number() }).index("by_user", ["userId"]),
});
