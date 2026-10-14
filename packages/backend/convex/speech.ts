import { ConvexError, v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id, Doc } from "./_generated/dataModel";
import { requireUser } from "./lib/ownership";
import { speechSourceValue, speechSegmentValue } from "./speechValues";
import {
  maxRecordingBytes,
  validSpeechSource,
  whisperDailyRequests,
  whisperNeuronBound,
  type SpeechSource,
} from "./lib/speechContract";
import { requestsLesson } from "@packages/content";

async function ownsSource(
  ctx: MutationCtx,
  userId: Id<"users">,
  source: SpeechSource,
) {
  if (!validSpeechSource(source) || !(await ctx.db.get(userId))) return false;
  if (source.lessonSessionId) {
    const session = await ctx.db
      .query("studySessions")
      .withIndex("by_user_session", (q) =>
        q.eq("userId", userId).eq("sessionId", source.lessonSessionId!),
      )
      .unique();
    const cues = [
      ...requestsLesson.words.map((word) => `word-${word.id}`),
      ...requestsLesson.words.map((word) => word.example.id),
      ...requestsLesson.grammar.examples.map((example) => example.id),
      "own-sentence",
    ];
    return Boolean(
      session &&
      session.lessonId === requestsLesson.id &&
      session.version === requestsLesson.version &&
      cues.includes(source.cueId),
    );
  }
  const segment = await ctx.db
    .query("conversationSegments")
    .withIndex("by_user_segment", (q) =>
      q.eq("userId", userId).eq("segmentId", source.conversationSegmentId!),
    )
    .unique();
  return Boolean(segment && source.cueId === "chat-answer");
}
function publicAttempt(row: Doc<"speechAttempts">) {
  return {
    id: row._id,
    recordingId: row.recordingId,
    source: row.source,
    status: row.status,
    attempt: row.attempt,
    updatedAt: row.updatedAt,
    leaseUntil: row.leaseUntil,
    recognizedTranscript: row.recognizedTranscript,
    learnerConfirmedText: row.learnerConfirmedText,
    wasEdited: row.wasEdited,
    confirmedAt: row.confirmedAt,
  };
}
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    return (
      await ctx.db
        .query("speechAttempts")
        .withIndex("by_user_updated", (q) => q.eq("userId", userId))
        .order("desc")
        .take(200)
    ).map(publicAttempt);
  },
});
export const prepare = mutation({
  args: {
    recordingId: v.string(),
    source: speechSourceValue,
    sha256: v.string(),
    bytes: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx),
      now = Date.now();
    if (
      await ctx.db
        .query("speechDeletions")
        .withIndex("by_user_recording", (q) =>
          q.eq("userId", userId).eq("recordingId", args.recordingId),
        )
        .unique()
    )
      throw new ConvexError(
        "This recording was deleted. Record a new attempt to practise again.",
      );
    if (
      !/^[0-9a-f-]{36}$/i.test(args.recordingId) ||
      !/^[0-9a-f]{64}$/.test(args.sha256) ||
      !Number.isInteger(args.bytes) ||
      args.bytes < 32 ||
      args.bytes > maxRecordingBytes ||
      !(await ownsSource(ctx, userId, args.source))
    )
      throw new ConvexError(
        "Open and synchronize your saved practice before uploading a recording.",
      );
    const existing = await ctx.db
      .query("speechAttempts")
      .withIndex("by_user_recording", (q) =>
        q.eq("userId", userId).eq("recordingId", args.recordingId),
      )
      .unique();
    if (existing) {
      if (
        existing.sha256 !== args.sha256 ||
        existing.bytes !== args.bytes ||
        existing.source.lessonSessionId !== args.source.lessonSessionId ||
        existing.source.conversationSegmentId !==
          args.source.conversationSegmentId ||
        existing.source.cueId !== args.source.cueId
      )
        throw new ConvexError(
          "This recording ID already belongs to another attempt.",
        );
      if (
        ["ready", "empty", "deleted", "queued"].includes(existing.status) ||
        (["uploading", "running"].includes(existing.status) &&
          (existing.leaseUntil ?? 0) > now) ||
        existing.attempt >= 3
      )
        return publicAttempt(existing);
      if (existing.status === "awaitingUpload") return publicAttempt(existing);
      if (existing.storageId) await ctx.storage.delete(existing.storageId);
      await ctx.db.patch(existing._id, {
        status: "awaitingUpload",
        attempt: existing.attempt + 1,
        claim: existing.claim + 1,
        storageId: undefined,
        leaseUntil: undefined,
        updatedAt: now,
        trace: "",
      });
      await ctx.scheduler.runAfter(86_400_000, internal.speech.expire, {
        id: existing._id,
        attempt: existing.attempt + 1,
      });
      return publicAttempt({
        ...existing,
        status: "awaitingUpload",
        attempt: existing.attempt + 1,
        updatedAt: now,
      });
    }
    const recent = await ctx.db
      .query("speechAttempts")
      .withIndex("by_user_created", (q) =>
        q.eq("userId", userId).gte("createdAt", now - 86_400_000),
      )
      .take(100);
    if (
      recent.length >= 100 ||
      recent.filter((row) => row.createdAt > now - 60_000).length >= 10
    )
      throw new ConvexError(
        "Recording requests are temporarily at capacity. Keep practising locally or type instead.",
      );
    const row = {
      ...args,
      userId,
      status: "awaitingUpload" as const,
      attempt: 1,
      claim: 0,
      createdAt: now,
      updatedAt: now,
      trace: "",
    };
    const id = await ctx.db.insert("speechAttempts", row);
    await ctx.scheduler.runAfter(24 * 60 * 60_000, internal.speech.expire, {
      id,
      attempt: 1,
    });
    return publicAttempt({ ...row, _id: id, _creationTime: now });
  },
});
export const beginUpload = internalMutation({
  args: {
    id: v.id("speechAttempts"),
    userId: v.id("users"),
    attempt: v.number(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (
      !row ||
      row.userId !== args.userId ||
      row.attempt !== args.attempt ||
      row.status === "deleted" ||
      !(await ownsSource(ctx, args.userId, row.source))
    )
      return { state: "rejected" as const };
    if (row.status !== "awaitingUpload")
      return { state: "existing" as const, status: row.status };
    const claim = row.claim + 1;
    await ctx.db.patch(row._id, {
      status: "uploading",
      claim,
      leaseUntil: Date.now() + 40_000,
      updatedAt: Date.now(),
    });
    return {
      state: "upload" as const,
      claim,
      sha256: row.sha256,
      bytes: row.bytes,
    };
  },
});
export const attach = internalMutation({
  args: {
    id: v.id("speechAttempts"),
    claim: v.number(),
    storageId: v.id("_storage"),
    durationMillis: v.number(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (
      !row ||
      row.claim !== args.claim ||
      row.status !== "uploading" ||
      (row.leaseUntil ?? 0) < Date.now() ||
      !(await ownsSource(ctx, row.userId, row.source))
    )
      return false;
    await ctx.db.patch(row._id, {
      storageId: args.storageId,
      durationMillis: args.durationMillis,
      status: "queued",
      leaseUntil: undefined,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.speechAI.run, { id: row._id });
    return true;
  },
});
export const failUpload = internalMutation({
  args: { id: v.id("speechAttempts"), claim: v.number(), code: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (row?.status === "uploading" && row.claim === args.claim)
      await ctx.db.patch(row._id, {
        status: "unavailable",
        leaseUntil: undefined,
        updatedAt: Date.now(),
        trace: JSON.stringify({
          uploadFailure: /^[A-Z_]{1,80}$/.test(args.code)
            ? args.code
            : "UPLOAD_FAILED",
        }),
      });
  },
});
export const claim = internalMutation({
  args: { id: v.id("speechAttempts") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (
      !row ||
      row.status !== "queued" ||
      !row.storageId ||
      !(await ownsSource(ctx, row.userId, row.source))
    )
      return null;
    const claim = row.claim + 1;
    await ctx.db.patch(row._id, {
      status: "running",
      claim,
      leaseUntil: Date.now() + 75_000,
      updatedAt: Date.now(),
    });
    return { ...row, claim };
  },
});
export const reserve = internalMutation({
  args: {
    id: v.id("speechAttempts"),
    claim: v.number(),
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    if (process.env.WORKERS_AI_FREE_ONLY_VERIFIED !== "true") return false;
    const row = await ctx.db.get(args.id),
      now = Date.now();
    if (
      !row ||
      row.status !== "running" ||
      row.claim !== args.claim ||
      (row.leaseUntil ?? 0) < now ||
      !(await ownsSource(ctx, row.userId, row.source)) ||
      args.operationId !== `whisper.${row._id}.${row.attempt}.${row.claim}`
    )
      return false;
    if (
      await ctx.db
        .query("speechReservations")
        .withIndex("by_operation", (q) => q.eq("operationId", args.operationId))
        .unique()
    )
      return false;
    const midnight = Math.floor(now / 86_400_000) * 86_400_000;
    const project = await ctx.db
      .query("speechReservations")
      .withIndex("by_time", (q) => q.gte("createdAt", midnight))
      .take(whisperDailyRequests);
    const learner = await ctx.db
      .query("speechReservations")
      .withIndex("by_user_time", (q) =>
        q.eq("userId", row.userId).gte("createdAt", midnight),
      )
      .take(30);
    const recentProject = await ctx.db
      .query("speechReservations")
      .withIndex("by_time", (q) => q.gte("createdAt", now - 60_000))
      .take(6);
    const recentLearner = await ctx.db
      .query("speechReservations")
      .withIndex("by_user_time", (q) =>
        q.eq("userId", row.userId).gte("createdAt", now - 60_000),
      )
      .take(3);
    if (
      project.length >= whisperDailyRequests ||
      recentProject.length >= 6 ||
      learner.length >= 30 ||
      recentLearner.length >= 3
    )
      return false;
    // Keep the full 24-neuron bound even on failure/timeout. Outside account usage
    // is unknown; Workers Free supplies the final free-quota boundary.
    await ctx.db.insert("speechReservations", {
      operationId: args.operationId,
      userId: row.userId,
      createdAt: now,
      neurons: whisperNeuronBound,
    });
    return true;
  },
});
export const settle = internalMutation({
  args: {
    id: v.id("speechAttempts"),
    claim: v.number(),
    transcript: v.optional(v.string()),
    segments: v.optional(v.array(speechSegmentValue)),
    trace: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.status !== "running" || row.claim !== args.claim) return;
    if (row.storageId) await ctx.storage.delete(row.storageId);
    const alive = await ownsSource(ctx, row.userId, row.source);
    const ready =
      alive && args.transcript !== undefined && args.transcript.length <= 1000;
    await ctx.db.patch(row._id, {
      status: !alive
        ? "deleted"
        : ready
          ? args.transcript!.trim()
            ? "ready"
            : "empty"
          : "unavailable",
      storageId: undefined,
      leaseUntil: undefined,
      recognizedTranscript: ready ? args.transcript : undefined,
      segments: ready ? args.segments : undefined,
      trace: alive ? args.trace.slice(0, 4000) : "",
      updatedAt: Date.now(),
    });
  },
});
export const confirm = mutation({
  args: { recordingId: v.string(), text: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const row = await ctx.db
      .query("speechAttempts")
      .withIndex("by_user_recording", (q) =>
        q.eq("userId", userId).eq("recordingId", args.recordingId),
      )
      .unique();
    const text = args.text.trim();
    if (
      !row ||
      !["ready", "empty"].includes(row.status) ||
      !text ||
      text.length > 1000 ||
      /[\u0000-\u001f]/u.test(text) ||
      !(await ownsSource(ctx, userId, row.source))
    )
      throw new ConvexError(
        "Check the recognized text or type your answer before confirming.",
      );
    const wasEdited = text !== (row.recognizedTranscript ?? "").trim();
    await ctx.db.patch(row._id, {
      learnerConfirmedText: text,
      wasEdited,
      confirmedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { text, wasEdited };
  },
});
export const remove = mutation({
  args: { recordingId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    if (
      !(await ctx.db.get(userId)) ||
      !/^[0-9a-f-]{36}$/i.test(args.recordingId)
    )
      return;
    const row = await ctx.db
      .query("speechAttempts")
      .withIndex("by_user_recording", (q) =>
        q.eq("userId", userId).eq("recordingId", args.recordingId),
      )
      .unique();
    const tombstone = await ctx.db
      .query("speechDeletions")
      .withIndex("by_user_recording", (q) =>
        q.eq("userId", userId).eq("recordingId", args.recordingId),
      )
      .unique();
    if (!tombstone) {
      const recent = await ctx.db
        .query("speechDeletions")
        .withIndex("by_user_time", (q) =>
          q.eq("userId", userId).gte("createdAt", Date.now() - 86_400_000),
        )
        .take(100);
      if (!row && recent.length >= 100)
        throw new ConvexError(
          "Deletion will synchronize later. Your local recording remains deleted.",
        );
      await ctx.db.insert("speechDeletions", {
        userId,
        recordingId: args.recordingId,
        createdAt: Date.now(),
      });
    }
    if (!row) return;
    if (row.storageId) await ctx.storage.delete(row.storageId);
    // A tombstone prevents delayed uploads/jobs from recreating a deleted attempt.
    await ctx.db.patch(row._id, {
      status: "deleted",
      storageId: undefined,
      recognizedTranscript: undefined,
      segments: undefined,
      learnerConfirmedText: undefined,
      confirmedAt: undefined,
      wasEdited: undefined,
      trace: "",
      claim: row.claim + 1,
      leaseUntil: undefined,
      updatedAt: Date.now(),
    });
  },
});
export const expire = internalMutation({
  args: { id: v.id("speechAttempts"), attempt: v.number() },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.attempt !== args.attempt) return;
    if (row.storageId) await ctx.storage.delete(row.storageId);
    if (["ready", "empty", "deleted", "unavailable"].includes(row.status))
      return;
    await ctx.db.patch(row._id, {
      status: "unavailable",
      storageId: undefined,
      claim: row.claim + 1,
      leaseUntil: undefined,
      updatedAt: Date.now(),
    });
  },
});
// Store/attach are separate action steps. Sweep unreferenced old private AAC
// objects too, covering an action crash immediately after storage.store().
export const sweepOrphans = internalMutation({
  args: { cursor: v.optional(v.string()), cutoff: v.optional(v.number()) },
  handler: async (ctx, args): Promise<void> => {
    const cutoff = Math.min(
      args.cutoff ?? Date.now() - 23 * 3_600_000,
      Date.now() - 23 * 3_600_000,
    );
    const page = await ctx.db.system
      .query("_storage")
      .filter((q) => q.lt(q.field("_creationTime"), cutoff))
      .paginate({ cursor: args.cursor ?? null, numItems: 100 });
    for (const blob of page.page)
      if (blob.contentType === "audio/mp4") {
        const owner = await ctx.db
          .query("speechAttempts")
          .withIndex("by_storage", (q) => q.eq("storageId", blob._id))
          .unique();
        if (!owner || owner.createdAt <= Date.now() - 23 * 3_600_000) {
          await ctx.storage.delete(blob._id);
          if (owner)
            await ctx.db.patch(owner._id, {
              storageId: undefined,
              status: "unavailable",
              claim: owner.claim + 1,
              leaseUntil: undefined,
              updatedAt: Date.now(),
            });
        }
      }
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.speech.sweepOrphans, {
        cursor: page.continueCursor,
        cutoff,
      });
  },
});
export const audit = internalQuery({
  args: { id: v.id("speechAttempts") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row) return null;
    return {
      status: row.status,
      attempt: row.attempt,
      claim: row.claim,
      bytes: row.bytes,
      durationMillis: row.durationMillis,
      blobPresent: row.storageId
        ? Boolean(await ctx.db.system.get(row.storageId))
        : false,
      recognizedCharacters: row.recognizedTranscript?.length ?? 0,
      confirmed: row.confirmedAt !== undefined,
      wasEdited: row.wasEdited,
      trace: row.trace,
    };
  },
});
