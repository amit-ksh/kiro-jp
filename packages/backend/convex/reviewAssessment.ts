import { v, ConvexError } from "convex/values";
import {
  mutation,
  internalMutation,
  internalQuery,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { curriculum } from "@packages/content";
import {
  assessNovelSentence,
  reviewAssessment,
  type ReviewFeedback,
} from "@packages/learning-core";
import { requireUser } from "./lib/ownership";
import { limit } from "./conversation";
import { assessmentValue, phraseValue } from "./conversationValues";
import {
  classifyReview,
  recordReviewFeedback,
  reviewSourceWithSupport,
  resolveChildren,
} from "./reviews";

async function sourceAvailable(
  ctx: QueryCtx | MutationCtx,
  row: Doc<"reviewAssessments">,
) {
  const attempt = await ctx.db
    .query("reviewAttempts")
    .withIndex("by_user_event", (q) =>
      q.eq("userId", row.userId).eq("event.eventId", row.eventId),
    )
    .unique();
  const track = await ctx.db
    .query("reviewTracks")
    .withIndex("by_user_track", (q) =>
      q.eq("userId", row.userId).eq("track.id", row.source.trackId),
    )
    .unique();
  return Boolean(await ctx.db.get(row.userId)) &&
    attempt &&
    track &&
    attempt.event.input === row.source.input &&
    attempt.event.opportunityId === row.source.opportunityId &&
    track.track.card.id === row.card.id &&
    track.track.card.sourceVersion === row.card.sourceVersion
    ? attempt
    : null;
}
const metadata = (
  row: Pick<
    Doc<"reviewAssessments">,
    "status" | "attempt" | "updatedAt" | "leaseUntil" | "corrected"
  >,
): ReviewFeedback => ({
  status: row.status,
  attempt: row.attempt,
  updatedAt: row.updatedAt,
  ...(row.leaseUntil ? { leaseUntil: row.leaseUntil } : {}),
  ...(row.corrected ? { corrected: row.corrected } : {}),
});
export const request = mutation({
  args: { eventId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx),
      source = await ctx.db
        .query("reviewAttempts")
        .withIndex("by_user_event", (q) =>
          q.eq("userId", userId).eq("event.eventId", args.eventId),
        )
        .unique();
    if (!source || source.receipt.status === "invalid-with-reason")
      throw new ConvexError(
        "Synchronize this owned review answer before requesting feedback.",
      );
    const track = await ctx.db
      .query("reviewTracks")
      .withIndex("by_user_track", (q) =>
        q.eq("userId", userId).eq("track.id", source.event.trackId),
      )
      .unique();
    if (
      !track ||
      track.track.card.source !== "lesson" ||
      !curriculum.get(track.track.card.sourceId, track.track.card.sourceVersion) ||
      track.track.card.exercise.kind !== "sentence" ||
      reviewAssessment(track.track.card, source.event).outcome !== "pending"
    )
      throw new ConvexError("This review uses predefined answers.");
    const existing = await ctx.db
        .query("reviewAssessments")
        .withIndex("by_user_event", (q) =>
          q.eq("userId", userId).eq("eventId", args.eventId),
        )
        .unique(),
      now = Date.now();
    if (
      existing &&
      (existing.status === "ready" ||
        existing.attempt >= 3 ||
        (existing.status === "queued" && now - existing.updatedAt < 90000) ||
        (existing.status === "running" && (existing.leaseUntil ?? 0) > now))
    )
      return metadata(existing);
    if (!existing && source.receipt.assessment.outcome !== "pending")
      throw new ConvexError("Feedback is already recorded for this answer.");
    await limit(ctx, userId);
    const snapshot =
      existing?.source ??
      (await reviewSourceWithSupport(ctx, userId, source.event));
    const data = {
      userId,
      eventId: args.eventId,
      source: snapshot,
      card: existing?.card ?? track.track.card,
      status: "queued" as const,
      attempt: (existing?.attempt ?? 0) + 1,
      claim: (existing?.claim ?? 0) + 1,
      updatedAt: now,
      trace: "",
    };
    const id =
      existing?._id ?? (await ctx.db.insert("reviewAssessments", data));
    if (existing)
      await ctx.db.patch(id, {
        ...data,
        leaseUntil: undefined,
        assessment: undefined,
        corrected: undefined,
      });
    const feedback = metadata(data);
    await recordReviewFeedback(ctx, source, feedback);
    await ctx.scheduler.runAfter(0, internal.reviewAssessmentAI.run, { id });
    return feedback;
  },
});
export const claim = internalMutation({
  args: { id: v.id("reviewAssessments") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.status !== "queued") return null;
    const source = await sourceAvailable(ctx, row);
    if (!source) return null;
    const claim = row.claim + 1,
      updatedAt = Date.now(),
      leaseUntil = updatedAt + 60000;
    await ctx.db.patch(row._id, {
      status: "running",
      claim,
      updatedAt,
      leaseUntil,
    });
    await recordReviewFeedback(
      ctx,
      source,
      metadata({ ...row, status: "running", updatedAt, leaseUntil }),
    );
    return { ...row, claim };
  },
});
export const dispatchable = internalQuery({
  args: { id: v.id("reviewAssessments"), claim: v.number() },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    return Boolean(
      row &&
      row.status === "running" &&
      row.claim === args.claim &&
      (row.leaseUntil ?? 0) > Date.now() &&
      (await sourceAvailable(ctx, row)),
    );
  },
});
export const settle = internalMutation({
  args: {
    id: v.id("reviewAssessments"),
    claim: v.number(),
    semantic: v.optional(assessmentValue),
    corrected: v.optional(phraseValue),
    trace: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (
      !row ||
      row.status !== "running" ||
      row.claim !== args.claim ||
      (row.leaseUntil ?? 0) < Date.now()
    )
      return;
    const source = await sourceAvailable(ctx, row);
    if (!source) return;
    const assessment = args.semantic
      ? assessNovelSentence(
          row.card.exercise,
          {
            id: row.eventId,
            input: row.source.input ?? "",
            support: row.source.support,
          },
          args.semantic,
        )
      : undefined;
    const ready = Boolean(
        assessment && !["pending", "unassessed"].includes(assessment.outcome),
      ),
      updatedAt = Date.now();
    await ctx.db.patch(row._id, {
      status: ready ? "ready" : "unavailable",
      leaseUntil: undefined,
      updatedAt,
      assessment,
      corrected: ready ? args.corrected : undefined,
      trace: args.trace.slice(0, 4000),
    });
    const feedback: ReviewFeedback = {
      status: ready ? "ready" : "unavailable",
      attempt: row.attempt,
      updatedAt,
      ...(ready && args.corrected ? { corrected: args.corrected } : {}),
    };
    if (!ready || !assessment) {
      await recordReviewFeedback(ctx, source, feedback);
      return;
    }
    const receipt = await classifyReview(ctx, source, assessment, feedback);
    if (!["awaiting-parent", "pending-assessment"].includes(receipt.status))
      await resolveChildren(ctx, row.userId, row.eventId, 40);
  },
});
export const audit = internalQuery({
  args: { eventId: v.string(), userId: v.id("users") },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("reviewAssessments")
      .withIndex("by_user_event", (q) =>
        q.eq("userId", args.userId).eq("eventId", args.eventId),
      )
      .unique();
    return row
      ? {
          status: row.status,
          attempt: row.attempt,
          claim: row.claim,
          leaseUntil: row.leaseUntil,
          trace: row.trace,
        }
      : null;
  },
});
