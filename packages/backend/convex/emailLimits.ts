import { internalMutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";

// Reserve before Convex Auth creates/replaces a code. Failed sends still consume
// capacity; a cooldown rejection must not invalidate the previous email's code.
export const reserve = internalMutation({
  args: { recipientKey: v.string() },
  handler: async (ctx, { recipientKey }) => {
    const now = Date.now();
    const day = new Date(now).toISOString().slice(0, 10);
    const recipient = await ctx.db.query("accountEmailLimits").withIndex("by_key", q => q.eq("key", recipientKey)).unique();
    const global = await ctx.db.query("accountEmailLimits").withIndex("by_key", q => q.eq("key", "deployment")).unique();
    if (recipient && now - recipient.lastRequestedAt < 60_000) throw new ConvexError({ code: "EMAIL_COOLDOWN", message: "Wait one minute before requesting another account email. Your previous code remains valid." });
    const recipientCount = recipient?.day === day ? recipient.count : 0;
    const globalCount = global?.day === day ? global.count : 0;
    if (recipientCount >= 30 || globalCount >= 80) throw new ConvexError({ code: "EMAIL_CAPACITY", message: "Account email capacity is unavailable today. Please try again tomorrow." });
    for (const [record, key, count] of [[recipient, recipientKey, recipientCount], [global, "deployment", globalCount]] as const) {
      const value = { key, lastRequestedAt: now, day, count: count + 1 };
      if (record) await ctx.db.patch(record._id, value);
      else await ctx.db.insert("accountEmailLimits", value);
    }
  },
});
