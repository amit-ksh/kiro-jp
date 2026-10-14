import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
export const get = internalQuery({
  args: { userId: v.id("users"), key: v.string() },
  handler: async (ctx, args) => {
    if (!(await ctx.db.get(args.userId))) return null;
    if (!/^[a-f0-9]{64}$/u.test(args.key)) return null;
    const row = await ctx.db
      .query("qlooContextCache")
      .withIndex("by_user_key", (q) =>
        q.eq("userId", args.userId).eq("key", args.key),
      )
      .unique();
    return row && row.expiresAt > Date.now()
      ? {
          items: JSON.parse(row.items) as unknown[],
          inputs: row.inputs,
          checkedAt: row.checkedAt,
          expiresAt: row.expiresAt,
        }
      : null;
  },
});
export const put = internalMutation({
  args: {
    userId: v.id("users"),
    key: v.string(),
    items: v.string(),
    inputs: v.array(v.string()),
    checkedAt: v.number(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    // A late action must not recreate private context after account deletion.
    if (!(await ctx.db.get(args.userId))) return;
    if (
      !/^[a-f0-9]{64}$/u.test(args.key) ||
      args.items.length > 14000 ||
      args.inputs.length > 10 ||
      args.inputs.some((input) => input.length > 240) ||
      !Number.isFinite(args.checkedAt) ||
      args.checkedAt > Date.now() + 300_000 ||
      args.expiresAt - args.checkedAt !== 86_400_000
    )
      throw new Error("Invalid cultural cache entry.");
    const parsed = JSON.parse(args.items);
    if (!Array.isArray(parsed) || parsed.length > 10)
      throw new Error("Invalid cultural cache data.");
    const previous = await ctx.db
      .query("qlooContextCache")
      .withIndex("by_user_key", (q) =>
        q.eq("userId", args.userId).eq("key", args.key),
      )
      .unique();
    if (previous && previous.checkedAt > args.checkedAt) return;
    if (previous) await ctx.db.replace(previous._id, args);
    else await ctx.db.insert("qlooContextCache", args);
  },
});
