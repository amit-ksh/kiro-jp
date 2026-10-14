import { mutation, query, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { requireUser } from "./lib/ownership";
import { limit } from "./conversation";
import { requestsLesson } from "@packages/content";
import {
  exerciseForStep,
  sessionProjection,
  assessNovelSentence,
  type StudyEvent,
} from "@packages/learning-core";
import { assessmentValue, phraseValue } from "./conversationValues";
export const request = mutation({
  args: { eventId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx),
      source = await ctx.db
        .query("studyEvents")
        .withIndex("by_user_event", (q) =>
          q.eq("userId", userId).eq("event.eventId", args.eventId),
        )
        .unique();
    if (
      !source ||
      source.event.kind !== "attempted" ||
      source.event.lessonId !== requestsLesson.id ||
      source.event.lessonVersion !== requestsLesson.version
    )
      throw new ConvexError(
        "Synchronize this lesson answer before requesting feedback.",
      );
    const existing = await ctx.db
      .query("lessonAssessments")
      .withIndex("by_user_event", (q) =>
        q.eq("userId", userId).eq("eventId", args.eventId),
      )
      .unique();
    if (
      existing &&
      (existing.status === "ready" ||
        existing.attempt >= 3 ||
        (existing.status === "queued" &&
          Date.now() - existing.updatedAt < 90_000) ||
        (existing.status === "running" &&
          (existing.leaseUntil ?? Infinity) > Date.now()))
    )
      return { id: existing._id };
    const exercise = exerciseForStep(requestsLesson, source.event.stepId);
    if (!exercise || exercise.kind !== "sentence")
      throw new ConvexError("This exercise uses predefined answers.");
    const history = await ctx.db
      .query("studyEvents")
      .withIndex("by_user_session", (q) =>
        q.eq("userId", userId).eq("event.sessionId", source.event.sessionId),
      )
      .take(1001);
    const attempt = sessionProjection(
      requestsLesson,
      history.map((row) => row.event as StudyEvent),
    ).attempts.find((row) => row.event.eventId === args.eventId);
    if (!attempt || attempt.assessment.outcome !== "pending")
      throw new ConvexError("This answer already has predefined feedback.");
    const support = [
      ...new Set([
        ...attempt.support,
        ...(history.length > 1000 ? ["testedAnswer" as const] : []),
      ]),
    ];
    await limit(ctx, userId);
    const now = Date.now(),
      snapshot = { ...source.event, support };
    const id = existing
      ? existing._id
      : await ctx.db.insert("lessonAssessments", {
          userId,
          eventId: args.eventId,
          sessionId: source.event.sessionId,
          source: snapshot,
          status: "queued",
          attempt: 1,
          claim: 0,
          updatedAt: now,
          trace: "",
        });
    if (existing)
      await ctx.db.patch(id, {
        status: "queued",
        attempt: existing.attempt + 1,
        claim: existing.claim + 1,
        updatedAt: now,
      });
    await ctx.scheduler.runAfter(0, internal.assessmentAI.run, { id });
    return { id };
  },
});
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    return (
      await ctx.db
        .query("lessonAssessments")
        .withIndex("by_user_updated", (q) => q.eq("userId", userId))
        .order("desc")
        .take(200)
    ).map((row) => ({
      eventId: row.eventId,
      sessionId: row.sessionId,
      status: row.status,
      assessment: row.assessment,
      corrected: row.corrected,
      attempt: row.attempt,
      updatedAt: row.updatedAt,
      leaseUntil: row.leaseUntil,
    }));
  },
});
export const claim = internalMutation({
  args: { id: v.id("lessonAssessments") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.status !== "queued") return null;
    const claim = row.claim + 1;
    await ctx.db.patch(row._id, {
      status: "running",
      claim,
      leaseUntil: Date.now() + 60_000,
      updatedAt: Date.now(),
    });
    return { ...row, claim };
  },
});
export const settle = internalMutation({
  args: {
    id: v.id("lessonAssessments"),
    claim: v.number(),
    semantic: v.optional(assessmentValue),
    corrected: v.optional(phraseValue),
    trace: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.claim !== args.claim || row.status !== "running") return;
    const exercise = exerciseForStep(requestsLesson, row.source.stepId);
    if (!exercise) throw new Error("Source exercise missing.");
    const assessment = args.semantic
      ? assessNovelSentence(
          exercise,
          {
            id: row.eventId,
            input: row.source.input ?? "",
            support: row.source.support,
          },
          args.semantic,
        )
      : undefined;
    await ctx.db.patch(row._id, {
      status:
        assessment && assessment.outcome !== "pending"
          ? "ready"
          : "unavailable",
      assessment,
      corrected: args.corrected,
      trace: args.trace.slice(0, 12000),
      updatedAt: Date.now(),
    });
  },
});
