import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

const dailyLimit = 40;
const minuteLimit = 15;
const dayStart = (now: number) => Math.floor(now / 86_400_000) * 86_400_000;

export const status = internalQuery({ args: {}, handler: async ctx => {
  const now = Date.now();
  const today = await ctx.db.query("aiServiceReservations").withIndex("by_provider_time", q => q.eq("provider", "openrouter").gte("createdAt", dayStart(now))).take(dailyLimit + 1);
  const recent = await ctx.db.query("aiServiceReservations").withIndex("by_provider_time", q => q.eq("provider", "openrouter").gt("createdAt", now - 60_000)).take(minuteLimit + 1);
  return { dailyLimit, minuteLimit, dayUsed: today.length, minuteUsed: recent.length, dayResetsAt: dayStart(now) + 86_400_000 };
} });

// Every real generation consumes capacity, including errors and tool-loop
// steps. A rolling minute avoids a double burst at a minute boundary.
export const reserve = internalMutation({
  args: { operationId: v.string() },
  handler: async (ctx, { operationId }) => {
    if (!/^[A-Za-z0-9:._-]{1,180}$/.test(operationId)) throw new ConvexError("INVALID_AI_OPERATION");
    const previous = await ctx.db.query("aiServiceReservations").withIndex("by_operation", q => q.eq("operationId", operationId)).unique();
    if (previous) return { start: false };
    const now = Date.now();
    const today = await ctx.db.query("aiServiceReservations").withIndex("by_provider_time", q => q.eq("provider", "openrouter").gte("createdAt", dayStart(now))).take(dailyLimit + 1);
    // At UTC midnight, the minute window can include yesterday's calls.
    const recent = await ctx.db.query("aiServiceReservations").withIndex("by_provider_time", q => q.eq("provider", "openrouter").gt("createdAt", now - 60_000)).take(minuteLimit + 1);
    if (today.length >= dailyLimit) throw new ConvexError("AI_DAILY_CAPACITY");
    if (recent.length >= minuteLimit) throw new ConvexError("AI_MINUTE_CAPACITY");
    await ctx.db.insert("aiServiceReservations", { operationId, provider: "openrouter", createdAt: now });
    return { start: true };
  },
});
