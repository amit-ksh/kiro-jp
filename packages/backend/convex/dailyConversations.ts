import { v } from "convex/values";
import {
  dailyConversationKey,
  dailyOrdinal,
  localDayAt,
} from "@packages/learning-core";
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUser } from "./lib/ownership";
import { dailySuggestionValue } from "./dailyConversationValues";
import type { Id } from "./_generated/dataModel";

async function preferences(ctx: QueryCtx, userId: Id<"users">) {
  if (!(await ctx.db.get(userId))) return null;
  const saved = await ctx.db
    .query("learnerProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (!saved) return null;
  const choices = await ctx.db
    .query("culturalSelections")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(20);
  return {
    profile: saved.data,
    choices: choices.map((item) => ({
      query: item.query,
      entity: item.entity,
    })),
    key: dailyConversationKey(saved.data, choices),
  };
}
const dayArgs = { day: v.string(), offsetMinutes: v.number() };
function currentDay(day: string, offset: number) {
  dailyOrdinal(day);
  return (
    Number.isInteger(offset) &&
    Math.abs(offset) <= 840 &&
    localDayAt(Date.now(), offset) === day
  );
}
export const get = query({
  args: dayArgs,
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx),
      prefs = await preferences(ctx, userId);
    if (!prefs || !currentDay(args.day, args.offsetMinutes)) return null;
    const row = await ctx.db
      .query("dailyConversations")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).eq("day", args.day),
      )
      .unique();
    return {
      contextKey: prefs.key,
      hasInterests: Boolean(
        prefs.profile.interests.length || prefs.profile.favorites.length,
      ),
      ...(row?.key === prefs.key
        ? {
            status: row.status,
            suggestion: row.suggestion,
            updatedAt: row.updatedAt,
            attempts: row.attempts,
          }
        : {
            status:
              row && row.attempts >= 6
                ? ("unavailable" as const)
                : ("needed" as const),
            attempts: row?.attempts ?? 0,
          }),
    };
  },
});
export const request = mutation({
  args: dayArgs,
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx),
      prefs = await preferences(ctx, userId);
    if (
      !prefs ||
      !currentDay(args.day, args.offsetMinutes) ||
      !(prefs.profile.interests.length || prefs.profile.favorites.length)
    )
      return;
    const row = await ctx.db
      .query("dailyConversations")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).eq("day", args.day),
      )
      .unique();
    const same = row?.key === prefs.key;
    if (row && row.attempts >= 6) return;
    if (
      same &&
      (row.status === "ready" ||
        row.status === "empty" ||
        Date.now() - row.updatedAt < 120_000)
    )
      return;
    // Preference changes invalidate the old job; its late callback cannot win.
    // All revisions share the same six-attempt daily request allowance.
    const data = {
      userId,
      day: args.day,
      key: prefs.key,
      status: "pending" as const,
      claim: (row?.claim ?? 0) + 1,
      attempts: (row?.attempts ?? 0) + 1,
      updatedAt: Date.now(),
      suggestion: undefined,
    };
    const id = row ? row._id : await ctx.db.insert("dailyConversations", data);
    if (row) await ctx.db.replace(id, data);
    await ctx.scheduler.runAfter(0, internal.dailyConversationAI.run, {
      id,
      claim: data.claim,
    });
  },
});
export const snapshot = internalQuery({
  args: { id: v.id("dailyConversations"), claim: v.number() },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.status !== "pending" || row.claim !== args.claim)
      return null;
    const prefs = await preferences(ctx, row.userId);
    if (!prefs || prefs.key !== row.key) return null;
    const recent = await ctx.db
      .query("dailyConversations")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", row.userId).lt("day", row.day),
      )
      .order("desc")
      .take(7);
    return {
      row,
      ...prefs,
      recent: recent.flatMap((item) =>
        item.suggestion ? [item.suggestion] : [],
      ),
    };
  },
});
export const finish = internalMutation({
  args: {
    id: v.id("dailyConversations"),
    claim: v.number(),
    suggestion: v.optional(dailySuggestionValue),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.status !== "pending" || row.claim !== args.claim)
      return false;
    const prefs = await preferences(ctx, row.userId);
    if (!prefs || prefs.key !== row.key) return false;
    await ctx.db.patch(row._id, {
      status: args.suggestion ? "ready" : "unavailable",
      suggestion: args.suggestion,
      updatedAt: Date.now(),
    });
    return true;
  },
});
