import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import {
  jobResultDisposition,
  strongestGoal,
  validateConversationEvidence,
  type TutorReply,
  localDayAt,
  validateStudyEvent,
  type StudyEvent,
  lessonConversationTarget,
} from "@packages/learning-core";
import { curriculum } from "@packages/content";
import { assessmentValue, replyValue } from "./conversationValues";
import { culturalSnapshotValue } from "./cultureValues";
async function storeEvidence(
  ctx: MutationCtx,
  segment: Doc<"conversationSegments">,
  message: Doc<"conversationMessages">,
  assessment: TutorReply["assessment"],
) {
  const session = segment.lessonSessionId ? await ctx.db.query("studySessions").withIndex("by_user_session",q=>q.eq("userId",segment.userId).eq("sessionId",segment.lessonSessionId!)).unique() : null;
  const target = lessonConversationTarget(session ? curriculum.get(session.lessonId,session.version) : undefined);
  const goal = validateConversationEvidence(
    { assessment },
    {
      id: message.messageId,
      text: message.text,
      intent: message.intent,
      support: message.support,
    },
    target?.forms ?? [],
  );
  await ctx.db.patch(message._id, {
    goal: segment.lessonSessionId ? goal : { ...goal, state: "notObserved" },
  });
  if (goal.meaningful) {
    const existing = await ctx.db
      .query("studyEvents")
      .withIndex("by_user_event", (q) =>
        q.eq("userId", segment.userId).eq("event.eventId", message._id),
      )
      .unique();
    if (!existing) {
      const stamp = message.practiceStamp ?? {
        occurredAt: message.createdAt,
        offsetMinutes: 0,
        timezone: "UTC",
      };
      const event: StudyEvent = {
        ...stamp,
        eventId: message._id,
        sessionId: segment.segmentId,
        deviceId: "server-conversation",
        sequence: 0,
        lessonId: "conversation",
        lessonVersion: 1,
        localDay: localDayAt(stamp.occurredAt, stamp.offsetMinutes),
        kind: "conversationTurn",
        stepId: message.messageId,
        input: "meaningful",
        support: message.support,
        spans: [],
      };
      validateStudyEvent(event, undefined, Date.now());
      const counter = await ctx.db
        .query("studyCursors")
        .withIndex("by_user", (q) => q.eq("userId", segment.userId))
        .unique();
      const cursor = (counter?.cursor ?? 0) + 1;
      await ctx.db.insert("studyEvents", {
        userId: segment.userId,
        cursor,
        event,
      });
      if (counter) await ctx.db.patch(counter._id, { cursor });
      else
        await ctx.db.insert("studyCursors", { userId: segment.userId, cursor });
    }
  }
  if (!segment.lessonSessionId) return;
  const previous = await ctx.db
    .query("lessonConversationGoals")
    .withIndex("by_user_session", (q) =>
      q.eq("userId", segment.userId).eq("sessionId", segment.lessonSessionId!),
    )
    .unique();
  const state = strongestGoal([
    goal,
    {
      state: previous?.state ?? "notObserved",
      meaningful: false,
      messageId: "previous",
      explanation: "Previously accepted evidence.",
    },
  ]);
  const next = {
    userId: segment.userId,
    sessionId: segment.lessonSessionId,
    state,
    evidenceIds: [
      ...new Set([
        ...(previous?.evidenceIds ?? []),
        ...(goal.span ? [message.messageId] : []),
      ]),
    ].slice(0, 200),
    updatedAt: Date.now(),
  };
  if (previous) await ctx.db.replace(previous._id, next);
  else await ctx.db.insert("lessonConversationGoals", next);
}
export const claim = internalMutation({
  args: { jobId: v.id("conversationJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.status !== "queued") return null;
    const segment = await ctx.db
      .query("conversationSegments")
      .withIndex("by_user_segment", (q) =>
        q.eq("userId", job.userId).eq("segmentId", job.segmentId),
      )
      .unique();
    if (!segment) {
      await ctx.db.patch(job._id, {
        status: "failed",
        failureCode: "SEGMENT_UNAVAILABLE",
        updatedAt: Date.now(),
      });
      return null;
    }
    if (
      job.kind === "reply" &&
      (segment.state !== "active" || segment.revision !== job.sourceRevision)
    ) {
      await ctx.db.patch(job._id, { status: "stale", updatedAt: Date.now() });
      return null;
    }
    const session = segment.lessonSessionId ? await ctx.db.query("studySessions").withIndex("by_user_session",q=>q.eq("userId",segment.userId).eq("sessionId",segment.lessonSessionId!)).unique() : null;
    const lesson = session ? curriculum.get(session.lessonId,session.version) : undefined;
    if (segment.lessonSessionId && !lesson) {
      await ctx.db.patch(job._id,{status:"failed",failureCode:"LESSON_VERSION_UNAVAILABLE",updatedAt:Date.now()});
      return null;
    }
    const claim = job.claim + 1;
    await ctx.db.patch(job._id, {
      status: "running",
      claim,
      leaseUntil: Date.now() + 120_000,
      updatedAt: Date.now(),
    });
    const messages = await ctx.db
      .query("conversationMessages")
      .withIndex("by_segment_order", (q) => q.eq("segmentId", job.segmentId))
      .order("asc")
      .take(201);
    const profile = await ctx.db
      .query("learnerProfiles")
      .withIndex("by_user", (q) => q.eq("userId", job.userId))
      .unique();
    const choices = await ctx.db
      .query("culturalSelections")
      .withIndex("by_user", (q) => q.eq("userId", job.userId))
      .take(20);
    const imported = await ctx.db.query("wanikaniImports").withIndex("by_user",q=>q.eq("userId",job.userId)).unique();
    return {
      job: { ...job, claim },
      segment,
      lesson: lesson ?? null,
      messages: messages.filter(
        (message) =>
          job.sourceMessageIds.includes(message.messageId) && !message.stale,
      ),
      profile: profile?.data ?? null,
      familiarity: (imported?.snapshot?.items ?? []).slice(0,20).map(item=>({characters:item.characters,type:item.type})),
      choices: choices.map((choice) => ({
        query: choice.query,
        entity: choice.entity,
      })),
    };
  },
});
export const settle = internalMutation({
  args: {
    jobId: v.id("conversationJobs"),
    claim: v.number(),
    reply: v.optional(replyValue),
    culture: v.optional(culturalSnapshotValue),
    recap: v.optional(v.string()),
    recapAssessments: v.optional(v.array(assessmentValue)),
    trace: v.string(),
    failureCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.claim !== args.claim || job.status !== "running") return;
    const segment = await ctx.db
      .query("conversationSegments")
      .withIndex("by_user_segment", (q) =>
        q.eq("userId", job.userId).eq("segmentId", job.segmentId),
      )
      .unique();
    if (!segment) return;
    if (args.failureCode) {
      await ctx.db.patch(job._id, {
        status: "failed",
        failureCode: args.failureCode,
        trace: args.trace.slice(0, 12000),
        updatedAt: Date.now(),
      });
      if (segment.pendingJobId === job._id)
        await ctx.db.patch(segment._id, { pendingJobId: undefined });
      return;
    }
    const disposition = jobResultDisposition(job, args.claim, segment);
    if (job.kind === "recap") {
      if (!args.recap || args.recap.length > 1500)
        throw new Error("Invalid recap.");
      if ((args.recapAssessments?.length ?? 0) > 6)
        throw new Error("Too many recap assessments.");
      if (disposition === "recap")
        for (const assessment of args.recapAssessments ?? []) {
          if (
            !(job.assessmentMessageIds ?? []).includes(assessment.messageId) ||
            !job.sourceMessageIds.includes(assessment.messageId)
          )
            throw new Error("Recap source mismatch.");
          const message = await ctx.db
            .query("conversationMessages")
            .withIndex("by_user_message", (q) =>
              q.eq("userId", job.userId).eq("messageId", assessment.messageId),
            )
            .unique();
          if (
            !message ||
            message.segmentId !== job.segmentId ||
            message.role !== "user" ||
            message.intent !== "practice"
          )
            throw new Error("Invalid recap source.");
          if (!message.goal || message.goal.state === "awaitingAssessment")
            await storeEvidence(ctx, segment, message, assessment);
        }
      await ctx.db.patch(job._id, {
        status: disposition === "recap" ? "succeeded" : "stale",
        recap: args.recap,
        trace: args.trace.slice(0, 12000),
        updatedAt: Date.now(),
      });
      return;
    }
    if (!args.reply) throw new Error("Missing tutor response.");
    const message = await ctx.db
      .query("conversationMessages")
      .withIndex("by_user_message", (q) =>
        q.eq("userId", job.userId).eq("messageId", job.sourceMessageId),
      )
      .unique();
    if (!message || message.role !== "user")
      throw new Error("Missing learner message.");
    const assistantId = `${message.messageId}-assistant`;
    const existing = await ctx.db
      .query("conversationMessages")
      .withIndex("by_user_message", (q) =>
        q.eq("userId", job.userId).eq("messageId", assistantId),
      )
      .unique();
    if (!existing)
      await ctx.db.insert("conversationMessages", {
        userId: job.userId,
        conversationId: job.conversationId,
        segmentId: job.segmentId,
        messageId: assistantId,
        order: Date.now(),
        role: "assistant",
        text: args.reply.japanese,
        createdAt: Date.now(),
        intent: "practice",
        support: [],
        reply: args.reply,
        culture: args.culture,
        stale: disposition !== "append",
      });
    // A ended segment's late response stays as a draft. It cannot update goals.
    if (disposition === "append") {
      await storeEvidence(ctx, segment, message, args.reply.assessment);
      await ctx.db.patch(segment._id, {
        revision: segment.revision + 1,
        messageCount: segment.messageCount + 1,
        pendingJobId: undefined,
      });
    }
    await ctx.db.patch(job._id, {
      status: disposition === "append" ? "succeeded" : "stale",
      result: args.reply,
      trace: args.trace.slice(0, 12000),
      updatedAt: Date.now(),
    });
  },
});
