import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireUser } from "./lib/ownership";
import {
  chooseCulturalCandidate,
  culturalQueryKey,
} from "@packages/learning-core";
export const selectFavorite = mutation({
  args: { messageId: v.string(), query: v.string(), entityId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const message = await ctx.db
      .query("conversationMessages")
      .withIndex("by_user_message", (q) =>
        q.eq("userId", userId).eq("messageId", args.messageId),
      )
      .unique();
    if (!message?.culture || message.stale)
      throw new ConvexError(
        "These cultural choices are unavailable for this account.",
      );
    const choice = chooseCulturalCandidate(
      message.culture,
      args.query,
      args.entityId,
    );
    const query = culturalQueryKey(choice.query);
    const previous = await ctx.db
      .query("culturalSelections")
      .withIndex("by_user_query_type", (q) =>
        q
          .eq("userId", userId)
          .eq("query", query)
          .eq("type", choice.entity.type),
      )
      .unique();
    if (
      !previous &&
      (
        await ctx.db
          .query("culturalSelections")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .take(21)
      ).length >= 20
    )
      throw new ConvexError(
        "You can keep up to twenty specific favorites. Change an existing choice or continue with your topic.",
      );
    const row = {
      userId,
      query,
      type: choice.entity.type,
      entity: choice.entity,
      updatedAt: Date.now(),
    };
    if (previous) await ctx.db.replace(previous._id, row);
    else await ctx.db.insert("culturalSelections", row);
    const selected = [
      ...(message.culturalChoices ?? []).filter(
        (item) =>
          !message.culture!.candidates.some(
            (candidate) =>
              culturalQueryKey(candidate.query) === query &&
              candidate.type === choice.entity.type &&
              candidate.items.some((entity) => entity.id === item.entityId),
          ),
      ),
      { query: choice.query, entityId: choice.entity.id },
    ];
    await ctx.db.patch(message._id, { culturalChoices: selected });
    return { name: choice.entity.name };
  },
});
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    return ctx.db
      .query("culturalSelections")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(20);
  },
});
export const removeFavorite = mutation({
  args: { id: v.id("culturalSelections") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx),
      row = await ctx.db.get(args.id);
    if (!row || row.userId !== userId)
      throw new ConvexError("This favorite is unavailable for this account.");
    await ctx.db.delete(row._id);
  },
});
