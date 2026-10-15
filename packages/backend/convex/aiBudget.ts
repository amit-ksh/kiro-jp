import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

function limit() {
  const value = Number(process.env.GEMINI_BUDGET_MICROUSD ?? 0);
  if (process.env.GEMINI_ALLOW_PAID !== "true" || !Number.isSafeInteger(value) || value <= 0) throw new ConvexError("GEMINI_SPENDING_DISABLED");
  return value;
}
export const status = internalQuery({ args: {}, handler: async ctx => {
  const budget = await ctx.db.query("aiBudgets").withIndex("by_provider", q => q.eq("provider", "gemini")).unique();
  return { limitMicros: limit(), reservedMicros: budget?.reservedMicros ?? 0, spentMicros: budget?.spentMicros ?? 0 };
} });
export const reserve = internalMutation({
  args: { ownerId: v.optional(v.id("users")), operationId: v.string(), model: v.union(v.literal("gemini-3.8-flash-lite-tts"), v.literal("gemini-3.8-flash")), inputTokenBound: v.number(), outputTokenBound: v.number() },
  handler: async (ctx, args) => {
    if (args.ownerId && !(await ctx.db.get(args.ownerId))) return { start: false };
    const cap = limit();
    if (!args.operationId || args.operationId.length > 180 || !Number.isSafeInteger(args.inputTokenBound) || !Number.isSafeInteger(args.outputTokenBound) || args.inputTokenBound < 1 || args.outputTokenBound < 1 || args.inputTokenBound > 1_048_576 || args.outputTokenBound > 65_536) throw new ConvexError("INVALID_AI_RESERVATION");
    const existing = await ctx.db.query("aiCostReservations").withIndex("by_operation", q => q.eq("operationId", args.operationId)).unique();
    if (existing) return { start: false, state: existing.state };
    // USD per million tokens equals micro-USD per token. Keep the request's
    // rates immutable, including Google's documented January 2027 price change.
    const factor = Date.now() >= Date.UTC(2027, 0, 1) ? 2 : 1;
    const [inputRate, outputRate] = args.model === "gemini-3.8-flash-lite-tts" ? [0.5 * factor, 6 * factor] : [0.75 * factor, 3.75 * factor];
    const reservedMicros = Math.ceil(args.inputTokenBound * inputRate + args.outputTokenBound * outputRate);
    const budget = await ctx.db.query("aiBudgets").withIndex("by_provider", q => q.eq("provider", "gemini")).unique();
    if ((budget?.spentMicros ?? 0) + (budget?.reservedMicros ?? 0) + reservedMicros > cap) throw new ConvexError("AI_BUDGET_EXHAUSTED");
    const next = { provider: "gemini" as const, spentMicros: budget?.spentMicros ?? 0, reservedMicros: (budget?.reservedMicros ?? 0) + reservedMicros };
    if (budget) await ctx.db.patch(budget._id, next); else await ctx.db.insert("aiBudgets", next);
    await ctx.db.insert("aiCostReservations", { operationId: args.operationId, model: args.model, reservedMicros, inputRate, outputRate, state: "pending", createdAt: Date.now() });
    return { start: true, reservedMicros };
  },
});
export const settle = internalMutation({
  args: { operationId: v.string(), inputTokens: v.number(), outputTokens: v.number() },
  handler: async (ctx, args) => {
    if (![args.inputTokens, args.outputTokens].every(n => Number.isSafeInteger(n) && n >= 0)) throw new ConvexError("INVALID_AI_USAGE");
    const reservation = await ctx.db.query("aiCostReservations").withIndex("by_operation", q => q.eq("operationId", args.operationId)).unique();
    if (!reservation) throw new ConvexError("AI_RESERVATION_MISSING");
    if (reservation.state === "settled") return;
    const actualMicros = Math.ceil(args.inputTokens * reservation.inputRate + args.outputTokens * reservation.outputRate);
    // Unknown/invalid usage never releases capacity. Timeouts retain the entire
    // reservation; repeated settlement and repeated dispatch cannot bill twice.
    if (actualMicros > reservation.reservedMicros) throw new ConvexError("AI_USAGE_EXCEEDS_BOUND");
    const budget = await ctx.db.query("aiBudgets").withIndex("by_provider", q => q.eq("provider", "gemini")).unique();
    if (!budget) throw new ConvexError("AI_BUDGET_MISSING");
    await ctx.db.patch(budget._id, { reservedMicros: budget.reservedMicros - reservation.reservedMicros, spentMicros: budget.spentMicros + actualMicros });
    await ctx.db.patch(reservation._id, { state: "settled", actualMicros });
  },
});
