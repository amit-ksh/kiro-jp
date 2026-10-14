import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireUser } from "./lib/ownership";
import { profileValue } from "./profileValues";
export const get = query({ args: {}, handler: async ctx => {
  const userId = await requireUser(ctx);
  const profile = await ctx.db.query("learnerProfiles").withIndex("by_user", q => q.eq("userId", userId)).unique();
  return profile ? { revision: profile.revision, data: profile.data } : null;
} });
export const update = mutation({ args: { expectedRevision: v.number(), data: profileValue }, handler: async (ctx, args) => {
  const userId = await requireUser(ctx);
  const current = await ctx.db.query("learnerProfiles").withIndex("by_user", q => q.eq("userId", userId)).unique();
  if ((current?.revision ?? 0) !== args.expectedRevision) throw new ConvexError({ code: "STALE_REVISION", message: "Your preferences changed on another device. Your local answers are retained for review." });
  if (!Number.isInteger(args.data.dailyMinutes) || args.data.dailyMinutes < 5 || args.data.dailyMinutes > 120 || args.data.textScale < 1 || args.data.textScale > 1.5 || args.data.audioSpeed < 0.5 || args.data.audioSpeed > 1.5 || args.data.interests.length > 20 || args.data.favorites.length > 20 || args.data.placementResponses.length > 12) throw new ConvexError({ code: "INVALID_PROFILE", message: "Check the learning settings and try again." });
  if ([...args.data.interests, ...args.data.favorites].some(value => value.length > 120) || args.data.dislikes.length>100 || args.data.dislikes.some(value=>value.length>240)) throw new ConvexError({ code: "INVALID_PROFILE", message: "Keep interests/favorites under 120 characters and at most 100 disliked contexts." });
  const revision = (current?.revision ?? 0) + 1;
  if (current) await ctx.db.patch(current._id, { revision, data: args.data, updatedAt: Date.now() });
  else await ctx.db.insert("learnerProfiles", { userId, revision, data: args.data, updatedAt: Date.now() });
  return { revision };
} });
