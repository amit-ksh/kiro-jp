import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { profileValue } from "./profileValues";
import { studyEventValue } from "./studyValues";
export default defineSchema({
  ...authTables,
  accountEmailLimits: defineTable({ key: v.string(), lastRequestedAt: v.number(), day: v.string(), count: v.number() }).index("by_key", ["key"]),
  aiBudgets: defineTable({ provider: v.literal("gemini"), reservedMicros: v.number(), spentMicros: v.number() }).index("by_provider", ["provider"]),
  aiCostReservations: defineTable({ operationId: v.string(), model: v.string(), reservedMicros: v.number(), inputRate: v.number(), outputRate: v.number(), state: v.union(v.literal("pending"), v.literal("settled")), actualMicros: v.optional(v.number()), createdAt: v.number() }).index("by_operation", ["operationId"]),
  aiServiceReservations: defineTable({ operationId: v.string(), provider: v.literal("openrouter"), createdAt: v.number() }).index("by_operation", ["operationId"]).index("by_provider_time", ["provider", "createdAt"]),
  learnerProfiles: defineTable({ userId: v.id("users"), revision: v.number(), data: profileValue, updatedAt: v.number() }).index("by_user", ["userId"]),
  studyEvents: defineTable({ userId: v.id("users"), cursor: v.number(), event: studyEventValue }).index("by_user_cursor", ["userId", "cursor"]).index("by_user_event", ["userId", "event.eventId"]).index("by_user_session", ["userId", "event.sessionId"]).index("by_user_step_kind", ["userId", "event.sessionId", "event.stepId", "event.kind"]),
  studyCursors: defineTable({ userId: v.id("users"), cursor: v.number() }).index("by_user", ["userId"]),
  studySessions: defineTable({ userId: v.id("users"), sessionId: v.string(), lessonId: v.string(), version: v.number(), startedAt: v.number() }).index("by_user_session", ["userId", "sessionId"]),
});
