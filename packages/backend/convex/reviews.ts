import { v, ConvexError } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  type MutationCtx,
} from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { curriculum } from "@packages/content";
import {
  decideReview,
  introduceReview,
  lessonReviewIntroductions,
  phraseReviewIntroductions,
  orderReviewAttempts,
  validateReviewAttempt,
  type ReviewAttempt,
  type ReviewChange,
  type ReviewReceipt,
  type ReviewCard,
  type Assessment,
  type ReviewFeedback,
  type StudyEvent,
  exerciseForStep,
} from "@packages/learning-core";
import { requireUser } from "./lib/ownership";
import { reviewAttemptValue } from "./reviewValues";

const digest = async (text: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
  )
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
type Stored<T> = T extends readonly (infer Item)[]
  ? Stored<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Stored<T[Key]> }
    : T;
// Snapshot immutable catalog arrays as ordinary Convex JSON values.
function stored<T>(value: T): Stored<T> {
  return JSON.parse(JSON.stringify(value)) as Stored<T>;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => `${JSON.stringify(key)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
async function log(
  ctx: MutationCtx,
  userId: Id<"users">,
  change: ReviewChange,
) {
  const counter = await ctx.db
    .query("reviewCursors")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  const cursor = (counter?.cursor ?? 0) + 1;
  if (counter) await ctx.db.patch(counter._id, { cursor });
  else await ctx.db.insert("reviewCursors", { userId, cursor });
  await ctx.db.insert("reviewChanges", {
    userId,
    cursor,
    change: stored(change),
  });
  return cursor;
}
async function introduce(
  ctx: MutationCtx,
  userId: Id<"users">,
  card: ReviewCard,
  introducedAt: number,
) {
  const existing = await ctx.db
    .query("reviewTracks")
    .withIndex("by_user_track", (q) =>
      q.eq("userId", userId).eq("track.id", card.id),
    )
    .unique();
  if (existing) return false;
  const { track, opportunity } = await introduceReview(
    card,
    introducedAt,
    digest,
  );
  await ctx.db.insert("reviewTracks", { userId, track: stored(track) });
  await ctx.db.insert("reviewOpportunities", { userId, opportunity });
  await log(ctx, userId, { kind: "introduced", track, opportunity });
  return true;
}
export const ensureLesson = mutation({
  args: { sessionId: v.string(), sourceEventIds: v.optional(v.array(v.string())) },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const session = await ctx.db
      .query("studySessions")
      .withIndex("by_user_session", (q) =>
        q.eq("userId", userId).eq("sessionId", args.sessionId),
      )
      .unique();
    const lesson = session ? curriculum.get(session.lessonId, session.version) : undefined;
    if (!lesson)
      throw new ConvexError(
        "This lesson needs to synchronize before preparing reviews.",
      );
    const rows = await ctx.db
      .query("studyEvents")
      .withIndex("by_user_session", (q) =>
        q.eq("userId", userId).eq("event.sessionId", args.sessionId),
      )
      .take(1001);
    if (rows.length > 1000)
      throw new ConvexError(
        "This long session needs a paginated review preparation. Your study is retained.",
      );
    // A successful preparation is cached by the client. Do not acknowledge
    // its snapshot until every local advancement has reached this transaction.
    const sourceIds = new Set(rows.filter(row => row.event.kind === "advanced" || row.event.kind === "savedPhrase").map(row => row.event.eventId));
    if (args.sourceEventIds && (args.sourceEventIds.length > 1000 || args.sourceEventIds.some(id => !sourceIds.has(id))))
      throw new ConvexError("Your latest answers are still synchronizing. Review preparation will retry; your study is retained.");
    // Read only the source attempts which actually need a semantic assessment.
    const checked: Record<string, Assessment> = {};
    for (const row of rows)
      if (
        row.event.kind === "attempted" &&
        exerciseForStep(lesson, row.event.stepId)?.kind === "sentence"
      ) {
        const result = await ctx.db
          .query("lessonAssessments")
          .withIndex("by_user_event", (q) =>
            q.eq("userId", userId).eq("eventId", row.event.eventId),
          )
          .unique();
        if (result?.status === "ready" && result.assessment)
          checked[row.event.eventId] = result.assessment;
      }
    let added = 0;
    for (const item of lessonReviewIntroductions(
      lesson,
      rows.map((row) => row.event as StudyEvent),
      checked,
    ))
      if (await introduce(ctx, userId, item.card, item.introducedAt)) added++;
    return { added };
  },
});
export const ensurePhrase = mutation({
  args: { phraseId: v.id("savedPhrases") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx),
      phrase = await ctx.db.get(args.phraseId);
    if (!phrase || phrase.userId !== userId || phrase.status !== "approved")
      throw new ConvexError("Reviews need a checked saved phrase.");
    let added = 0;
    for (const item of phraseReviewIntroductions(
      phrase._id,
      phrase.phrase,
      phrase.updatedAt,
    ))
      if (await introduce(ctx, userId, item.card, item.introducedAt)) added++;
    return { added };
  },
});
export const pull = query({
  args: { afterCursor: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    if (!Number.isSafeInteger(args.afterCursor) || args.afterCursor < 0)
      throw new ConvexError("Invalid review cursor.");
    const rows = await ctx.db
      .query("reviewChanges")
      .withIndex("by_user_cursor", (q) =>
        q.eq("userId", userId).gt("cursor", args.afterCursor),
      )
      .order("asc")
      .take(51);
    const page = rows.slice(0, 50);
    return {
      changes: page.map((row) => ({ cursor: row.cursor, change: row.change })),
      nextCursor: page[page.length - 1]?.cursor ?? args.afterCursor,
      hasMore: rows.length > 50,
    };
  },
});
export async function recordReviewFeedback(
  ctx: MutationCtx,
  row: Doc<"reviewAttempts">,
  feedback: ReviewFeedback,
) {
  const receipt = {
    ...row.receipt,
    revision: row.receipt.revision + 1,
    feedback,
  };
  await ctx.db.patch(row._id, { receipt });
  await log(ctx, row.userId, { kind: "attempt", event: row.event, receipt });
  return receipt;
}
export async function reviewSourceWithSupport(
  ctx: MutationCtx,
  userId: Id<"users">,
  event: ReviewAttempt,
): Promise<ReviewAttempt> {
  const history = await ctx.db
    .query("reviewAttempts")
    .withIndex("by_user_session_track", (q) =>
      q
        .eq("userId", userId)
        .eq("event.sessionId", event.sessionId)
        .eq("event.trackId", event.trackId)
        .lte("event.occurredAt", event.occurredAt),
    )
    .take(101);
  const exposed =
    history.length > 100 ||
    history.some(
      (row) =>
        row.event.eventId !== event.eventId &&
        row.event.opportunityId === event.opportunityId &&
        (row.event.occurredAt < event.occurredAt ||
          (row.event.deviceId === event.deviceId &&
            row.event.sequence < event.sequence)),
    );
  return {
    ...event,
    support: [
      ...new Set([
        ...event.support,
        ...(exposed ? ["correctionRetry" as const] : []),
      ]),
    ],
  };
}
export async function classifyReview(
  ctx: MutationCtx,
  row: Doc<"reviewAttempts">,
  resolved?: Assessment,
  feedback?: ReviewFeedback,
) {
  const { userId, event } = row;
  if (row.receipt.status === "applied-to-schedule")
    return feedback ? recordReviewFeedback(ctx, row, feedback) : row.receipt;
  const savedTrack = await ctx.db
    .query("reviewTracks")
    .withIndex("by_user_track", (q) =>
      q.eq("userId", userId).eq("track.id", event.trackId),
    )
    .unique();
  if (!savedTrack)
    throw new ConvexError(
      "Prepare this review card before uploading an attempt.",
    );
  const opportunity = await ctx.db
    .query("reviewOpportunities")
    .withIndex("by_user_opportunity", (q) =>
      q.eq("userId", userId).eq("opportunity.id", event.opportunityId),
    )
    .unique();
  const parent = event.parentEventId
    ? await ctx.db
        .query("reviewAttempts")
        .withIndex("by_user_event", (q) =>
          q.eq("userId", userId).eq("event.eventId", event.parentEventId!),
        )
        .unique()
    : null;
  const job = await ctx.db
    .query("reviewAssessments")
    .withIndex("by_user_event", (q) =>
      q.eq("userId", userId).eq("eventId", event.eventId),
    )
    .unique();
  const source =
    job?.source ?? (await reviewSourceWithSupport(ctx, userId, event));
  const decision = await decideReview(
    savedTrack.track,
    opportunity?.opportunity,
    parent?.receipt,
    source,
    digest,
    row.receipt.revision + 1,
    resolved ?? (job?.status === "ready" ? job.assessment : undefined),
  );
  const metadata = feedback ?? row.receipt.feedback;
  if (metadata) decision.receipt.feedback = metadata;
  if (decision.track && decision.closed && decision.next) {
    // The current track and open opportunity are read and written in this one
    // transaction. A concurrent successful commit forces the other to retry.
    if (!opportunity) throw new Error("Missing closing opportunity.");
    await ctx.db.patch(savedTrack._id, { track: stored(decision.track) });
    await ctx.db.patch(opportunity._id, { opportunity: decision.closed });
    await ctx.db.insert("reviewOpportunities", {
      userId,
      opportunity: decision.next,
    });
  }
  await ctx.db.patch(row._id, { receipt: decision.receipt });
  await log(ctx, userId, { kind: "attempt", event, ...decision });
  return decision.receipt;
}
export async function resolveChildren(
  ctx: MutationCtx,
  userId: Id<"users">,
  parentEventId: string,
  remaining: number,
): Promise<number> {
  const children = await ctx.db
    .query("reviewAttempts")
    .withIndex("by_user_parent", (q) =>
      q
        .eq("userId", userId)
        .eq("event.parentEventId", parentEventId)
        .eq("receipt.status", "awaiting-parent"),
    )
    .take(remaining + 1);
  let used = 0;
  for (const child of children) {
    if (child.receipt.status !== "awaiting-parent") continue;
    if (used >= remaining) {
      await ctx.scheduler.runAfter(0, internal.reviews.resumeChildren, {
        userId,
        parentEventId,
      });
      break;
    }
    const receipt = await classifyReview(ctx, child);
    used++;
    if (
      receipt.status !== "awaiting-parent" &&
      receipt.status !== "pending-assessment"
    )
      used += await resolveChildren(
        ctx,
        userId,
        child.event.eventId,
        remaining - used,
      );
  }
  return used;
}
export const resumeChildren = internalMutation({
  args: { userId: v.id("users"), parentEventId: v.string() },
  handler: async (ctx, args) => {
    if (!(await ctx.db.get(args.userId))) return;
    await resolveChildren(ctx, args.userId, args.parentEventId, 40);
  },
});
export const push = mutation({
  args: { events: v.array(reviewAttemptValue) },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    if (args.events.length > 50 || JSON.stringify(args.events).length > 100000)
      throw new ConvexError("Review upload is too large.");
    let ordered: ReviewAttempt[];
    try {
      for (const event of args.events) validateReviewAttempt(event, Date.now());
      ordered = orderReviewAttempts(args.events);
    } catch (error) {
      throw new ConvexError({
        code: "INVALID_REVIEW",
        message: "Check the saved review activity before retrying.",
        reason:
          error instanceof Error
            ? error.message.slice(0, 160)
            : "Invalid review activity.",
      });
    }
    const acks: (ReviewReceipt & { duplicate: boolean })[] = [];
    for (const event of ordered) {
      const previous = await ctx.db
        .query("reviewAttempts")
        .withIndex("by_user_event", (q) =>
          q.eq("userId", userId).eq("event.eventId", event.eventId),
        )
        .unique();
      if (previous) {
        if (canonical(previous.event) !== canonical(event))
          throw new ConvexError(
            "A saved review ID cannot replace its original answer.",
          );
        acks.push({ ...previous.receipt, duplicate: true });
        continue;
      }
      const track = await ctx.db
        .query("reviewTracks")
        .withIndex("by_user_track", (q) =>
          q.eq("userId", userId).eq("track.id", event.trackId),
        )
        .unique();
      if (!track)
        throw new ConvexError(
          "Prepare this review card before uploading an attempt.",
        );
      const id = await ctx.db.insert("reviewAttempts", {
        userId,
        event,
        receipt: {
          eventId: event.eventId,
          revision: 0,
          status: "awaiting-parent",
          assessment: {
            outcome: "pending",
            normalized: "",
            expected: track.track.card.exercise.expected,
            explanation: "Waiting for review reconciliation.",
            inputScript: "none",
            kanaEvidence: false,
            targetObserved: false,
          },
          opportunityId: event.opportunityId,
        },
      });
      const saved = await ctx.db.get(id);
      if (!saved) throw new Error("Missing saved review.");
      const receipt = await classifyReview(ctx, saved);
      acks.push({ ...receipt, duplicate: false });
      if (
        receipt.status !== "awaiting-parent" &&
        receipt.status !== "pending-assessment"
      )
        await resolveChildren(ctx, userId, event.eventId, 40);
    }
    // A child inserted before its parent may have a newer classification now.
    return {
      acks: await Promise.all(
        acks.map(async (ack) => {
          const row = await ctx.db
            .query("reviewAttempts")
            .withIndex("by_user_event", (q) =>
              q.eq("userId", userId).eq("event.eventId", ack.eventId),
            )
            .unique();
          return { ...row!.receipt, duplicate: ack.duplicate };
        }),
      ),
    };
  },
});
