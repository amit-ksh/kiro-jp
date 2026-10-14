import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import { requireUser } from "./lib/ownership";
import { supportValue } from "./studyValues";
import { practiceStampValue } from "./conversationValues";
const uuid = (value: string) => {
  if (!/^[a-zA-Z0-9_-]{8,100}$/u.test(value))
    throw new ConvexError("Invalid conversation identifier.");
};
export async function limit(ctx: MutationCtx, userId: Id<"users">) {
  const now = Date.now(),
    day = new Date(now).toISOString().slice(0, 10);
  const stored = await ctx.db
    .query("conversationLimits")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  const recent = (stored?.recent ?? []).filter((time) => time > now - 60_000),
    count = stored?.day === day ? stored.count : 0;
  if (count >= 30 || recent.length >= 6)
    throw new ConvexError({
      code: "QUOTA_UNAVAILABLE",
      message:
        "Conversation capacity is resting. Continue your saved study and try again later.",
    });
  const next = { userId, day, count: count + 1, recent: [...recent, now] };
  if (stored) await ctx.db.replace(stored._id, next);
  else await ctx.db.insert("conversationLimits", next);
}
async function owned(
  ctx: MutationCtx,
  userId: Id<"users">,
  conversationId: Id<"conversations">,
  segmentId: string,
) {
  const conversation = await ctx.db.get(conversationId);
  const segment = await ctx.db
    .query("conversationSegments")
    .withIndex("by_user_segment", (q) =>
      q.eq("userId", userId).eq("segmentId", segmentId),
    )
    .unique();
  if (
    !conversation ||
    conversation.userId !== userId ||
    !segment ||
    segment.conversationId !== conversationId
  )
    throw new ConvexError("Conversation unavailable for this account.");
  return { conversation, segment };
}
async function queue(
  ctx: MutationCtx,
  segment: Doc<"conversationSegments">,
  kind: "reply" | "recap",
  sourceMessageId: string,
) {
  await limit(ctx, segment.userId);
  const messages = await ctx.db
    .query("conversationMessages")
    .withIndex("by_segment_order", (q) => q.eq("segmentId", segment.segmentId))
    .order("asc")
    .take(201);
  const now = Date.now();
  const jobId = await ctx.db.insert("conversationJobs", {
    userId: segment.userId,
    conversationId: segment.conversationId,
    segmentId: segment.segmentId,
    kind,
    status: "queued",
    sourceRevision: segment.revision,
    sourceMessageIds: messages
      .filter((message) => !message.stale)
      .map((message) => message.messageId),
    sourceMessageId,
    assessmentMessageIds:
      kind === "recap"
        ? messages
            .filter(
              (message) =>
                message.role === "user" &&
                message.intent === "practice" &&
                (!message.goal || message.goal.state === "awaitingAssessment"),
            )
            .slice(-6)
            .map((message) => message.messageId)
        : [],
    attempt: 1,
    claim: 0,
    createdAt: now,
    updatedAt: now,
  });
  await ctx.scheduler.runAfter(0, internal.conversationAI.run, { jobId });
  return jobId;
}
export const start = mutation({
  args: {
    clientId: v.string(),
    segmentId: v.string(),
    topic: v.string(),
    lessonSessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    uuid(args.clientId);
    uuid(args.segmentId);
    const previous = await ctx.db
      .query("conversations")
      .withIndex("by_user_client", (q) =>
        q.eq("userId", userId).eq("clientId", args.clientId),
      )
      .unique();
    if (previous) {
      const original = await ctx.db
        .query("conversationMessages")
        .withIndex("by_user_message", (q) =>
          q.eq("userId", userId).eq("messageId", `${args.segmentId}-topic`),
        )
        .unique();
      if (
        !original ||
        original.conversationId !== previous._id ||
        original.text !== args.topic.trim()
      )
        throw new ConvexError(
          "A saved conversation request cannot be replaced with another topic.",
        );
      return {
        conversationId: previous._id,
        segmentId: previous.currentSegmentId,
      };
    }
    if (
      await ctx.db
        .query("conversationSegments")
        .withIndex("by_user_segment", (q) =>
          q.eq("userId", userId).eq("segmentId", args.segmentId),
        )
        .unique()
    )
      throw new ConvexError("Use a new identifier for a new conversation.");
    if (!args.topic.trim() || args.topic.length > 500)
      throw new ConvexError("Choose a topic under 500 characters.");
    if (
      args.lessonSessionId &&
      !(await ctx.db
        .query("studySessions")
        .withIndex("by_user_session", (q) =>
          q.eq("userId", userId).eq("sessionId", args.lessonSessionId!),
        )
        .unique())
    )
      throw new ConvexError(
        "Synchronize your saved lesson before starting its conversation.",
      );
    const now = Date.now();
    const conversationId = await ctx.db.insert("conversations", {
      userId,
      clientId: args.clientId,
      currentSegmentId: args.segmentId,
      updatedAt: now,
      title: args.topic.trim().slice(0, 120),
    });
    const segmentKey = await ctx.db.insert("conversationSegments", {
      userId,
      conversationId,
      segmentId: args.segmentId,
      revision: 1,
      state: "active",
      topic: args.topic.trim().slice(0, 120),
      startedAt: now,
      lessonSessionId: args.lessonSessionId,
      messageCount: 1,
    });
    const messageId = `${args.segmentId}-topic`;
    await ctx.db.insert("conversationMessages", {
      userId,
      conversationId,
      segmentId: args.segmentId,
      messageId,
      order: now,
      role: "user",
      text: args.topic.trim(),
      createdAt: now,
      intent: "topic",
      support: [],
      stale: false,
    });
    const segment = (await ctx.db.get(segmentKey))!;
    const jobId = await queue(ctx, segment, "reply", messageId);
    await ctx.db.patch(segmentKey, {
      pendingJobId: jobId,
      lastReplyJobId: jobId,
    });
    return { conversationId, segmentId: args.segmentId };
  },
});
export const submit = mutation({
  args: {
    conversationId: v.id("conversations"),
    segmentId: v.string(),
    messageId: v.string(),
    expectedRevision: v.number(),
    text: v.string(),
    support: v.array(supportValue),
    practiceStamp: v.optional(practiceStampValue),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    uuid(args.messageId);
    const previous = await ctx.db
      .query("conversationMessages")
      .withIndex("by_user_message", (q) =>
        q.eq("userId", userId).eq("messageId", args.messageId),
      )
      .unique();
    if (previous) {
      if (
        previous.conversationId !== args.conversationId ||
        previous.segmentId !== args.segmentId ||
        previous.text !== args.text.trim()
      )
        throw new ConvexError("A sent message cannot be replaced.");
      return { messageId: previous.messageId };
    }
    const { conversation, segment } = await owned(
      ctx,
      userId,
      args.conversationId,
      args.segmentId,
    );
    if (
      conversation.currentSegmentId !== segment.segmentId ||
      segment.state !== "active" ||
      segment.revision !== args.expectedRevision ||
      segment.pendingJobId
    )
      throw new ConvexError({
        code: "STALE_REVISION",
        message:
          "Wait for this reply or reopen the current conversation before sending.",
      });
    if (
      !args.text.trim() ||
      args.text.length > 1000 ||
      args.support.length > 7 ||
      segment.messageCount >= 180
    )
      throw new ConvexError(
        "Keep this message under 1,000 characters, or finish and continue in a new practice segment.",
      );
    const now = Date.now();
    if (
      args.practiceStamp &&
      (!Number.isFinite(args.practiceStamp.occurredAt) ||
        args.practiceStamp.occurredAt < segment.startedAt - 300_000 ||
        args.practiceStamp.occurredAt > now + 300_000 ||
        !Number.isInteger(args.practiceStamp.offsetMinutes) ||
        Math.abs(args.practiceStamp.offsetMinutes) > 840 ||
        args.practiceStamp.timezone.length > 80)
    )
      throw new ConvexError("Check the practice date before retrying.");
    await ctx.db.insert("conversationMessages", {
      userId,
      conversationId: conversation._id,
      segmentId: segment.segmentId,
      messageId: args.messageId,
      order: now,
      role: "user",
      text: args.text.trim(),
      createdAt: now,
      intent: "practice",
      support: args.support,
      practiceStamp: args.practiceStamp,
      stale: false,
    });
    const next = {
      ...segment,
      revision: segment.revision + 1,
      messageCount: segment.messageCount + 1,
    };
    const jobId = await queue(ctx, next, "reply", args.messageId);
    await ctx.db.patch(segment._id, {
      revision: next.revision,
      messageCount: next.messageCount,
      pendingJobId: jobId,
      lastReplyJobId: jobId,
    });
    await ctx.db.patch(conversation._id, { updatedAt: now });
    return { messageId: args.messageId };
  },
});
export const finish = mutation({
  args: {
    conversationId: v.id("conversations"),
    segmentId: v.string(),
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx),
      { segment } = await owned(
        ctx,
        userId,
        args.conversationId,
        args.segmentId,
      );
    if (segment.state === "ended") return { endedAt: segment.endedAt };
    if (segment.revision !== args.expectedRevision)
      throw new ConvexError(
        "The conversation changed. Refresh before finishing.",
      );
    const endedAt = Date.now(),
      next = {
        ...segment,
        state: "ended" as const,
        revision: segment.revision + 1,
      };
    await ctx.db.patch(segment._id, {
      state: "ended",
      endedAt,
      revision: next.revision,
      pendingJobId: undefined,
    });
    const unanswered = await ctx.db
      .query("conversationMessages")
      .withIndex("by_segment_order", (q) =>
        q.eq("segmentId", segment.segmentId),
      )
      .take(201);
    for (const message of unanswered)
      if (
        message.role === "user" &&
        message.intent === "practice" &&
        !message.goal
      )
        await ctx.db.patch(message._id, {
          goal: {
            state: "awaitingAssessment",
            meaningful: false,
            messageId: message.messageId,
            explanation: "Your saved response is awaiting feedback.",
          },
        });
    // Ending is durable even if there is no recap quota. Saved messages remain.
    const capacity = await ctx.db
      .query("conversationLimits")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const day = new Date(endedAt).toISOString().slice(0, 10);
    if (
      (capacity?.day === day ? capacity.count : 0) < 30 &&
      (capacity?.recent ?? []).filter((time) => time > endedAt - 60_000)
        .length < 6
    ) {
      const jobId = await queue(ctx, next, "recap", "");
      await ctx.db.patch(segment._id, { recapJobId: jobId });
    }
    return { endedAt };
  },
});
export const continuePractice = mutation({
  args: {
    conversationId: v.id("conversations"),
    previousSegmentId: v.string(),
    segmentId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    uuid(args.segmentId);
    const { conversation, segment } = await owned(
      ctx,
      userId,
      args.conversationId,
      args.previousSegmentId,
    );
    const existing = await ctx.db
      .query("conversationSegments")
      .withIndex("by_user_segment", (q) =>
        q.eq("userId", userId).eq("segmentId", args.segmentId),
      )
      .unique();
    if (existing) {
      if (existing.conversationId !== conversation._id)
        throw new ConvexError("Segment belongs to another conversation.");
      return { segmentId: existing.segmentId };
    }
    if (
      segment.state !== "ended" ||
      conversation.currentSegmentId !== segment.segmentId
    )
      throw new ConvexError("Resume the active conversation instead.");
    if (
      (
        await ctx.db
          .query("conversationSegments")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conversation._id),
          )
          .take(100)
      ).length >= 100
    )
      throw new ConvexError(
        "Start a new conversation to keep practising. Your earlier segments remain saved.",
      );
    await ctx.db.insert("conversationSegments", {
      userId,
      conversationId: conversation._id,
      segmentId: args.segmentId,
      revision: 0,
      state: "active",
      topic: segment.topic,
      startedAt: Date.now(),
      lessonSessionId: segment.lessonSessionId,
      messageCount: 0,
    });
    await ctx.db.patch(conversation._id, {
      currentSegmentId: args.segmentId,
      updatedAt: Date.now(),
    });
    return { segmentId: args.segmentId };
  },
});
export const retry = mutation({
  args: { jobId: v.id("conversationJobs") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx),
      job = await ctx.db.get(args.jobId);
    if (!job || job.userId !== userId)
      throw new ConvexError("This reply is unavailable.");
    const { segment } = await owned(
      ctx,
      userId,
      job.conversationId,
      job.segmentId,
    );
    if (
      job.status === "succeeded" ||
      job.status === "stale" ||
      (job.status === "queued" && Date.now() - job.updatedAt < 90_000)
    )
      return;
    if (job.status === "running" && (job.leaseUntil ?? 0) > Date.now())
      throw new ConvexError("This reply is still being prepared.");
    if (
      job.attempt >= 3 ||
      (job.kind === "reply" &&
        (segment.state !== "active" || segment.revision !== job.sourceRevision))
    )
      throw new ConvexError(
        "Continue your saved study or start a new practice segment.",
      );
    await limit(ctx, userId);
    await ctx.db.patch(job._id, {
      attempt: job.attempt + 1,
      status: "queued",
      claim: job.claim + 1,
      updatedAt: Date.now(),
      failureCode: undefined,
    });
    if (job.kind === "reply")
      await ctx.db.patch(segment._id, { pendingJobId: job._id });
    await ctx.scheduler.runAfter(0, internal.conversationAI.run, {
      jobId: job._id,
    });
  },
});
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    return ctx.db
      .query("conversations")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);
  },
});
export const get = query({
  args: {
    conversationId: v.id("conversations"),
    segmentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx),
      conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) return null;
    const segments = await ctx.db
      .query("conversationSegments")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversation._id),
      )
      .take(100);
    if (
      args.segmentId &&
      !segments.some((segment) => segment.segmentId === args.segmentId)
    )
      return null;
    const messages = args.segmentId
      ? await ctx.db
          .query("conversationMessages")
          .withIndex("by_segment_order", (q) =>
            q.eq("segmentId", args.segmentId!),
          )
          .order("desc")
          .take(201)
      : await ctx.db
          .query("conversationMessages")
          .withIndex("by_conversation_order", (q) =>
            q.eq("conversationId", conversation._id),
          )
          .order("desc")
          .take(200);
    const jobs = await Promise.all(
      [
        ...new Set(
          segments.flatMap((segment) =>
            [segment.lastReplyJobId, segment.recapJobId].filter(
              (id): id is Id<"conversationJobs"> => Boolean(id),
            ),
          ),
        ),
      ].map(async (id) => {
        const job = await ctx.db.get(id);
        return job
          ? {
              id: job._id,
              segmentId: job.segmentId,
              kind: job.kind,
              status: job.status,
              sourceRevision: job.sourceRevision,
              leaseUntil: job.leaseUntil,
              updatedAt: job.updatedAt,
              recap: job.recap,
              attempt: job.attempt,
            }
          : null;
      }),
    );
    const lessonGoals = await Promise.all(
      [
        ...new Set(
          segments.flatMap((segment) =>
            segment.lessonSessionId ? [segment.lessonSessionId] : [],
          ),
        ),
      ].map((sessionId) =>
        ctx.db
          .query("lessonConversationGoals")
          .withIndex("by_user_session", (q) =>
            q.eq("userId", userId).eq("sessionId", sessionId),
          )
          .unique(),
      ),
    );
    return {
      conversation,
      segments,
      messages: messages.reverse(),
      jobs: jobs.filter((job) => job !== null),
      lessonGoals: lessonGoals.filter((goal) => goal !== null),
    };
  },
});
export const forLesson = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const segments = await ctx.db
      .query("conversationSegments")
      .withIndex("by_user_lesson", (q) =>
        q.eq("userId", userId).eq("lessonSessionId", args.sessionId),
      )
      .order("desc")
      .take(20);
    return (
      (segments.find((segment) => segment.state === "active") ?? segments[0])
        ?.conversationId ?? null
    );
  },
});
export const prepareRecap = mutation({
  args: { conversationId: v.id("conversations"), segmentId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx),
      { segment } = await owned(
        ctx,
        userId,
        args.conversationId,
        args.segmentId,
      );
    if (segment.state !== "ended")
      throw new ConvexError("Finish this practice first.");
    if (segment.recapJobId) return { jobId: segment.recapJobId };
    const jobId = await queue(ctx, segment, "recap", "");
    await ctx.db.patch(segment._id, { recapJobId: jobId });
    return { jobId };
  },
});
export const lessonGoal = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    return ctx.db
      .query("lessonConversationGoals")
      .withIndex("by_user_session", (q) =>
        q.eq("userId", userId).eq("sessionId", args.sessionId),
      )
      .unique();
  },
});
