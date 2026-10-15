import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { exportValue, type ExportPage } from "@packages/learning-core";
import { requireUser } from "./lib/ownership";

export const beginExport = mutation({
  args: {},
  handler: async (ctx) => {
    const accountId = await requireUser(ctx);
    if (!(await ctx.db.get(accountId)))
      throw new ConvexError("Sign in again before exporting.");
    return { accountId, cutoff: Date.now(), formatVersion: 1 };
  },
});
export const exportPage = query({
  args: {
    collection: v.union(
      v.literal("profile"),
      v.literal("studyEvents"),
      v.literal("studySessions"),
      v.literal("lessonAssessments"),
      v.literal("reviewTracks"),
      v.literal("reviewOpportunities"),
      v.literal("reviewAttempts"),
      v.literal("reviewAssessments"),
      v.literal("reviewChanges"),
      v.literal("savedPhrases"),
      v.literal("conversations"),
      v.literal("conversationSegments"),
      v.literal("conversationMessages"),
      v.literal("conversationJobs"),
      v.literal("lessonConversationGoals"),
      v.literal("wanikaniImports"),
      v.literal("culturalSelections"),
      v.literal("qlooContextCache"),
      v.literal("speechAttempts"),
      v.literal("speechDeletions"),
      v.literal("readbackAssets"),
    ),
    cutoff: v.number(),
    cursor: v.union(v.string(), v.null()),
    endCursor: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ExportPage> => {
    const accountId = await requireUser(ctx);
    if (!(await ctx.db.get(accountId)))
      throw new ConvexError("Sign in again before exporting.");
    if (
      !Number.isFinite(args.cutoff) ||
      args.cutoff < 0 ||
      args.cutoff > Date.now() + 300_000
    )
      throw new ConvexError("Start the export again.");
    const options = {
      cursor: args.cursor,
      endCursor: args.endCursor,
      numItems: 25,
      maximumBytesRead: 4_000_000,
    };
    const page = await (async () => {
      switch (args.collection) {
        case "profile":
          return ctx.db
            .query("learnerProfiles")
            .withIndex("by_user", (q) => q.eq("userId", accountId))
            .filter((q) => q.lte(q.field("_creationTime"), args.cutoff))
            .paginate(options);
        case "studyEvents":
          return ctx.db
            .query("studyEvents")
            .withIndex("by_user_cursor", (q) => q.eq("userId", accountId))
            .filter((q) => q.lte(q.field("_creationTime"), args.cutoff))
            .paginate(options);
        case "studySessions":
          return ctx.db
            .query("studySessions")
            .withIndex("by_user_session", (q) => q.eq("userId", accountId))
            .filter((q) => q.lte(q.field("_creationTime"), args.cutoff))
            .paginate(options);
        case "lessonAssessments":
          return ctx.db
            .query("lessonAssessments")
            .withIndex("by_user_event", (q) => q.eq("userId", accountId))
            .filter((q) => q.lte(q.field("_creationTime"), args.cutoff))
            .paginate(options);
        case "reviewTracks":
          return ctx.db
            .query("reviewTracks")
            .withIndex("by_user_track", (q) => q.eq("userId", accountId))
            .filter((q) => q.lte(q.field("_creationTime"), args.cutoff))
            .paginate(options);
        case "reviewOpportunities":
          return ctx.db
            .query("reviewOpportunities")
            .withIndex("by_user_opportunity", (q) => q.eq("userId", accountId))
            .filter((q) => q.lte(q.field("_creationTime"), args.cutoff))
            .paginate(options);
        case "reviewAttempts":
          return ctx.db
            .query("reviewAttempts")
            .withIndex("by_user_event", (q) => q.eq("userId", accountId))
            .filter((q) => q.lte(q.field("_creationTime"), args.cutoff))
            .paginate(options);
        case "reviewAssessments":
          return ctx.db
            .query("reviewAssessments")
            .withIndex("by_user_event", (q) => q.eq("userId", accountId))
            .filter((q) => q.lte(q.field("_creationTime"), args.cutoff))
            .paginate(options);
        case "reviewChanges":
          return ctx.db
            .query("reviewChanges")
            .withIndex("by_user_cursor", (q) => q.eq("userId", accountId))
            .filter((q) => q.lte(q.field("_creationTime"), args.cutoff))
            .paginate(options);
        case "savedPhrases":
          return ctx.db
            .query("savedPhrases")
            .withIndex("by_user_created", (q) => q.eq("userId", accountId))
            .filter((q) => q.lte(q.field("_creationTime"), args.cutoff))
            .paginate(options);
        case "conversations":
          return ctx.db
            .query("conversations")
            .withIndex("by_user_client", (q) => q.eq("userId", accountId))
            .filter((q) => q.lte(q.field("_creationTime"), args.cutoff))
            .paginate(options);
        case "conversationSegments":
          return ctx.db
            .query("conversationSegments")
            .withIndex("by_user_segment", (q) => q.eq("userId", accountId))
            .filter((q) => q.lte(q.field("_creationTime"), args.cutoff))
            .paginate(options);
        case "conversationMessages":
          return ctx.db
            .query("conversationMessages")
            .withIndex("by_user_message", (q) => q.eq("userId", accountId))
            .filter((q) => q.lte(q.field("_creationTime"), args.cutoff))
            .paginate(options);
        case "conversationJobs":
          return ctx.db
            .query("conversationJobs")
            .withIndex("by_user", (q) => q.eq("userId", accountId))
            .filter((q) => q.lte(q.field("_creationTime"), args.cutoff))
            .paginate(options);
        case "lessonConversationGoals":
          return ctx.db
            .query("lessonConversationGoals")
            .withIndex("by_user_session", (q) => q.eq("userId", accountId))
            .filter((q) => q.lte(q.field("_creationTime"), args.cutoff))
            .paginate(options);
        case "wanikaniImports":
          return ctx.db
            .query("wanikaniImports")
            .withIndex("by_user", (q) => q.eq("userId", accountId))
            .filter((q) => q.lte(q.field("_creationTime"), args.cutoff))
            .paginate(options);
        case "culturalSelections":
          return ctx.db
            .query("culturalSelections")
            .withIndex("by_user", (q) => q.eq("userId", accountId))
            .filter((q) => q.lte(q.field("_creationTime"), args.cutoff))
            .paginate(options);
        case "qlooContextCache":
          return ctx.db
            .query("qlooContextCache")
            .withIndex("by_user_key", (q) => q.eq("userId", accountId))
            .filter((q) => q.lte(q.field("_creationTime"), args.cutoff))
            .paginate(options);
        case "speechAttempts":
          return ctx.db
            .query("speechAttempts")
            .withIndex("by_user_recording", (q) => q.eq("userId", accountId))
            .filter((q) => q.lte(q.field("_creationTime"), args.cutoff))
            .paginate(options);
        case "speechDeletions":
          return ctx.db
            .query("speechDeletions")
            .withIndex("by_user_recording", (q) => q.eq("userId", accountId))
            .filter((q) => q.lte(q.field("_creationTime"), args.cutoff))
            .paginate(options);
        case "readbackAssets":
          return ctx.db
            .query("readbackAssets")
            .withIndex("by_user_phrase_voice", (q) => q.eq("userId", accountId))
            .filter((q) => q.lte(q.field("_creationTime"), args.cutoff))
            .paginate(options);
      }
    })();
    return {
      accountId,
      records: page.page.map(exportValue),
      done: page.isDone,
      cursor: page.continueCursor,
      pageStatus: page.pageStatus,
      splitCursor: page.splitCursor,
    };
  },
});
