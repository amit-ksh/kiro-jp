"use node";
import { createHash } from "node:crypto";
import { v } from "convex/values";
import {
  chooseDailyConversation,
  dailyContextRequests,
} from "@packages/learning-core";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { createQlooSession } from "./lib/qloo";
import { findConversationContext } from "./lib/qlooContext";

export const run = internalAction({
  args: { id: v.id("dailyConversations"), claim: v.number() },
  handler: async (ctx, args): Promise<void> => {
    const saved = await ctx.runQuery(
      internal.dailyConversations.snapshot,
      args,
    );
    if (!saved) return;
    let suggestion;
    try {
      const session = createQlooSession(
        {
          baseUrl: process.env.QLOO_API_URL ?? "https://hackathon.api.qloo.com",
          apiKey: process.env.QLOO_API_KEY,
          tagIdField:
            process.env.QLOO_TAG_ID_FIELD === "id"
              ? "id"
              : process.env.QLOO_TAG_ID_FIELD === "tag_id"
                ? "tag_id"
                : undefined,
        },
        fetch,
        {
          key: (input) => createHash("sha256").update(input).digest("hex"),
          read: (key) =>
            ctx.runQuery(internal.qlooCache.get, {
              userId: saved.row.userId,
              key,
            }),
          write: async (key, entry) => {
            await ctx.runMutation(internal.qlooCache.put, {
              userId: saved.row.userId,
              key,
              ...entry,
              items: JSON.stringify(entry.items),
            });
          },
        },
        saved.choices,
      );
      for (const request of dailyContextRequests(
        saved.profile,
        saved.row.day,
      )) {
        const choice = saved.choices.find(
          (item) => item.query.toLowerCase() === request.query.toLowerCase(),
        );
        const result = await findConversationContext(
          session,
          {
            source: request.source,
            query: request.query,
            type: choice?.entity.type ?? request.type,
          },
          saved.profile.dislikes,
        );
        if (result.status === "ready") {
          suggestion =
            chooseDailyConversation(
              saved.row.day,
              request.interest,
              session.context.recommendations,
              saved.profile.dislikes,
              saved.recent,
            ) ?? undefined;
          if (suggestion) break;
        }
      }
    } catch {
      /* A missing context never becomes invented Qloo evidence. */
    }
    await ctx.runMutation(internal.dailyConversations.finish, {
      ...args,
      suggestion,
    });
  },
});
