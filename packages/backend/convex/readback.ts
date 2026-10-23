import { v, ConvexError } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { requireUser } from "./lib/ownership";
import { limit } from "./conversation";
import { readbackSourceAvailable } from "./lib/readbackSource";
const voiceVersion = "kore-v1";
const publicAsset = (row: Doc<"readbackAssets">) => ({
  id: row._id,
  phraseId: row.phraseId,
  conversationId: row.conversationId,
  messageId: row.messageId,
  segmentId: row.segmentId,
  voiceVersion: row.voiceVersion,
  status: row.status,
  attempt: row.attempt,
  leaseUntil: row.leaseUntil,
  sha256: row.status === "ready" ? row.sha256 : undefined,
  bytes: row.bytes,
  durationMillis: row.durationMillis,
  updatedAt: row.updatedAt,
});
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const rows = await ctx.db
      .query("readbackAssets")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(200);
    return rows.map(publicAsset);
  },
});
export const conversation = query({
  args: { conversationId: v.id("conversations"), messageId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const row = await ctx.db
      .query("readbackAssets")
      .withIndex("by_user_conversation_message_voice", (q) =>
        q
          .eq("userId", userId)
          .eq("conversationId", args.conversationId)
          .eq("messageId", args.messageId)
          .eq("voiceVersion", voiceVersion),
      )
      .unique();
    return row && (await readbackSourceAvailable(ctx, row))
      ? publicAsset(row)
      : null;
  },
});
export const requestConversation = mutation({
  args: { conversationId: v.id("conversations"), messageId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx),
      now = Date.now();
    if (!/^[A-Za-z0-9_-]{8,120}$/u.test(args.messageId))
      throw new ConvexError("Open the tutor reply before playing its voice.");
    const message = await ctx.db
      .query("conversationMessages")
      .withIndex("by_user_message", (q) =>
        q.eq("userId", userId).eq("messageId", args.messageId),
      )
      .unique();
    if (!message?.reply || message.conversationId !== args.conversationId)
      throw new ConvexError(
        "This tutor reply is unavailable for your account.",
      );
    const source = {
      japanese: message.reply.japanese,
      reading: message.reply.reading,
      romaji: message.reply.romaji,
      english: message.reply.english,
    };
    const reference = {
      userId,
      conversationId: args.conversationId,
      messageId: args.messageId,
      segmentId: message.segmentId,
      source,
    };
    if (!(await readbackSourceAvailable(ctx, reference, true)))
      throw new ConvexError(
        "Voice replies need the current active conversation.",
      );
    if (
      !/^[ぁ-ゖァ-ヶー\s。、！？!?・「」『』（）()]+$/u.test(source.reading) ||
      source.reading.length > 160 ||
      !/[ぁ-ゖァ-ヶ]/u.test(source.reading)
    )
      throw new ConvexError(
        "This reply is available as text. Ask for a shorter Japanese reply to hear it aloud.",
      );
    const existing = await ctx.db
      .query("readbackAssets")
      .withIndex("by_user_conversation_message_voice", (q) =>
        q
          .eq("userId", userId)
          .eq("conversationId", args.conversationId)
          .eq("messageId", args.messageId)
          .eq("voiceVersion", voiceVersion),
      )
      .unique();
    if (existing && !(await readbackSourceAvailable(ctx, existing, true)))
      throw new ConvexError("The saved voice no longer matches this reply.");
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
      ...reference,
      voiceVersion,
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
        bytes: undefined,
        durationMillis: undefined,
        checkedKana: undefined,
        leaseUntil: undefined,
      });
    await ctx.scheduler.runAfter(0, internal.readbackAI.run, { id });
    return { id, status: "queued" };
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
    if (
      !row ||
      row.status !== "queued" ||
      !(await readbackSourceAvailable(ctx, row, true))
    )
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
      (await readbackSourceAvailable(ctx, row, true)),
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
      !(await readbackSourceAvailable(ctx, row, true))
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
      !(await readbackSourceAvailable(ctx, row))
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
