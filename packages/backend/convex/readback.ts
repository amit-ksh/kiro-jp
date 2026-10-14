import { v, ConvexError } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { requireUser } from "./lib/ownership";
import { limit } from "./conversation";
const voiceVersion = "kore-v1";
async function sourceAvailable(
  ctx: QueryCtx | MutationCtx,
  row: Doc<"readbackAssets">,
) {
  const phrase = await ctx.db.get(row.phraseId);
  return Boolean(
    (await ctx.db.get(row.userId)) &&
    phrase?.userId === row.userId &&
    phrase.status === "approved" &&
    phrase.phrase.japanese === row.source.japanese &&
    phrase.phrase.reading === row.source.reading,
  );
}
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const rows = await ctx.db
      .query("readbackAssets")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(200);
    return rows.map((row) => ({
      id: row._id,
      phraseId: row.phraseId,
      voiceVersion: row.voiceVersion,
      status: row.status,
      attempt: row.attempt,
      leaseUntil: row.leaseUntil,
      sha256: row.status === "ready" ? row.sha256 : undefined,
      bytes: row.bytes,
      durationMillis: row.durationMillis,
      updatedAt: row.updatedAt,
    }));
  },
});
export const request = mutation({
  args: { phraseId: v.id("savedPhrases") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx),
      phrase = await ctx.db.get(args.phraseId),
      now = Date.now();
    if (
      !phrase ||
      phrase.userId !== userId ||
      phrase.status !== "approved" ||
      !(await ctx.db.get(userId))
    )
      throw new ConvexError("Audio needs a checked saved phrase.");
    if (
      !/^[ぁ-ゖァ-ヶー\s。、！？!?・「」『』（）()]+$/u.test(
        phrase.phrase.reading,
      ) ||
      phrase.phrase.reading.length > 160
    )
      throw new ConvexError(
        "This phrase needs a short kana reading before audio can be prepared. Keep using its text reference.",
      );
    const existing = await ctx.db
      .query("readbackAssets")
      .withIndex("by_user_phrase_voice", (q) =>
        q
          .eq("userId", userId)
          .eq("phraseId", args.phraseId)
          .eq("voiceVersion", voiceVersion),
      )
      .unique();
    if (
      existing &&
      (existing.status === "ready" ||
        existing.status === "deleted" ||
        existing.attempt >= 2 ||
        (existing.status === "queued" && now - existing.updatedAt < 180000) ||
        (existing.status === "running" && (existing.leaseUntil ?? 0) > now))
    )
      return { id: existing._id, status: existing.status };
    await limit(ctx, userId);
    const data = {
      userId,
      phraseId: args.phraseId,
      voiceVersion,
      source: phrase.phrase,
      status: "queued" as const,
      attempt: (existing?.attempt ?? 0) + 1,
      claim: (existing?.claim ?? 0) + 1,
      updatedAt: now,
      trace: "",
    };
    if (existing?.storageId) await ctx.storage.delete(existing.storageId);
    const id = existing?._id ?? (await ctx.db.insert("readbackAssets", data));
    if (existing)
      await ctx.db.patch(id, {
        ...data,
        storageId: undefined,
        sha256: undefined,
        durationMillis: undefined,
        checkedKana: undefined,
        leaseUntil: undefined,
      });
    await ctx.scheduler.runAfter(0, internal.readbackAI.run, { id });
    return { id, status: "queued" };
  },
});
export const claim = internalMutation({
  args: { id: v.id("readbackAssets") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.status !== "queued" || !(await sourceAvailable(ctx, row)))
      return null;
    const claim = row.claim + 1;
    await ctx.db.patch(row._id, {
      status: "running",
      claim,
      leaseUntil: Date.now() + 150000,
      updatedAt: Date.now(),
    });
    return { ...row, claim };
  },
});
export const dispatchable = internalQuery({
  args: { id: v.id("readbackAssets"), claim: v.number() },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    return Boolean(
      row &&
      row.claim === args.claim &&
      row.status === "running" &&
      (row.leaseUntil ?? 0) > Date.now() &&
      (await sourceAvailable(ctx, row)),
    );
  },
});
export const settle = internalMutation({
  args: {
    id: v.id("readbackAssets"),
    claim: v.number(),
    storageId: v.optional(v.id("_storage")),
    sha256: v.optional(v.string()),
    bytes: v.optional(v.number()),
    durationMillis: v.optional(v.number()),
    checkedKana: v.optional(v.string()),
    trace: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (
      !row ||
      row.status !== "running" ||
      row.claim !== args.claim ||
      (row.leaseUntil ?? 0) < Date.now() ||
      !(await sourceAvailable(ctx, row))
    ) {
      if (args.storageId) await ctx.storage.delete(args.storageId);
      return;
    }
    const ready = Boolean(
      args.storageId &&
      /^[a-f0-9]{64}$/.test(args.sha256 ?? "") &&
      args.durationMillis &&
      args.durationMillis <= 20000 &&
      args.bytes &&
      args.bytes <= 2 * 1024 * 1024 &&
      args.checkedKana,
    );
    if (args.storageId && !ready) await ctx.storage.delete(args.storageId);
    await ctx.db.patch(row._id, {
      status: ready ? "ready" : "unavailable",
      leaseUntil: undefined,
      storageId: ready ? args.storageId : undefined,
      sha256: ready ? args.sha256 : undefined,
      bytes: ready ? args.bytes : undefined,
      durationMillis: ready ? args.durationMillis : undefined,
      checkedKana: ready ? args.checkedKana : undefined,
      trace: args.trace.slice(0, 4000),
      updatedAt: Date.now(),
    });
  },
});
export const download = internalQuery({
  args: { id: v.id("readbackAssets"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (
      !row ||
      row.userId !== args.userId ||
      row.status !== "ready" ||
      !row.storageId ||
      !(await sourceAvailable(ctx, row))
    )
      return null;
    return { storageId: row.storageId, sha256: row.sha256, bytes: row.bytes };
  },
});
export const audit = internalQuery({
  args: { id: v.id("readbackAssets") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    return row
      ? {
          status: row.status,
          attempt: row.attempt,
          bytes: row.bytes,
          durationMillis: row.durationMillis,
          checkedKana: row.checkedKana,
          trace: row.trace,
          blobPresent: row.storageId
            ? Boolean(await ctx.db.system.get(row.storageId))
            : false,
        }
      : null;
  },
});
