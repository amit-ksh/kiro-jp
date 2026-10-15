import { mutation, query, internalMutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { requireUser } from "./lib/ownership";
import { limit } from "./conversation";
import { preparedLessons } from "@packages/content";
import {
  normalizeJapanese,
  normalizeEnglish,
  canonicalTutorPhrase,
  type TutorPhrase,
} from "@packages/learning-core";
import { phraseValue } from "./conversationValues";
function checkedPhrase(phrase: TutorPhrase): TutorPhrase | null {
  for (const example of preparedLessons.flatMap(lesson => lesson.grammar.examples))
    if (
      normalizeJapanese(example.text) === normalizeJapanese(phrase.japanese) &&
      normalizeJapanese(example.reading) ===
        normalizeJapanese(phrase.reading) &&
      normalizeEnglish(example.meaning) === normalizeEnglish(phrase.english)
    )
      return {
        japanese: example.text,
        reading: example.reading,
        romaji: example.romaji,
        english: example.meaning,
      };
  for (const word of preparedLessons.flatMap(lesson => lesson.words))
    if (
      normalizeJapanese(word.word) === normalizeJapanese(phrase.japanese) &&
      normalizeJapanese(word.reading) === normalizeJapanese(phrase.reading) &&
      normalizeEnglish(word.vocabulary?.meaning ?? word.meaning) === normalizeEnglish(phrase.english)
    )
      return {
        japanese: word.word,
        reading: word.reading,
        romaji: word.romaji[0] ?? "",
        english: word.vocabulary?.meaning ?? word.meaning,
      };
  return null;
}
function correctedRomaji(phrase: TutorPhrase) {
  try {
    const next = canonicalTutorPhrase(phrase);
    return next.romaji !== phrase.romaji ? next : null;
  } catch {
    return null;
  }
}
export const saveConversationPhrase = mutation({
  args: {
    conversationId: v.id("conversations"),
    messageId: v.string(),
    source: v.union(
      v.literal("useful"),
      v.literal("hint"),
      v.literal("correction"),
    ),
    index: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx),
      conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId)
      throw new ConvexError("Conversation unavailable.");
    const message = await ctx.db
      .query("conversationMessages")
      .withIndex("by_user_message", (q) =>
        q.eq("userId", userId).eq("messageId", args.messageId),
      )
      .unique();
    if (
      !message?.reply ||
      message.stale ||
      message.conversationId !== conversation._id ||
      !Number.isInteger(args.index) ||
      args.index < 0 ||
      args.index > 2
    )
      throw new ConvexError("Phrase unavailable.");
    const phrase =
      args.source === "correction"
        ? message.reply.corrections[args.index]?.corrected
        : (args.source === "hint"
            ? message.reply.hints
            : message.reply.usefulPhrases)[args.index];
    if (
      !phrase ||
      phrase.japanese.length > 160 ||
      phrase.reading.length > 240 ||
      phrase.english.length > 300 ||
      phrase.romaji.length > 240
    )
      throw new ConvexError("Phrase unavailable.");
    const key = normalizeJapanese(phrase.japanese),
      existing = await ctx.db
        .query("savedPhrases")
        .withIndex("by_user_key", (q) => q.eq("userId", userId).eq("key", key))
        .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        sourceMessageIds: [
          ...new Set([...existing.sourceMessageIds, message.messageId]),
        ].slice(0, 30),
      });
      return { id: existing._id, status: existing.status };
    }
    const known = checkedPhrase(phrase),
      now = Date.now();
    if (!known) await limit(ctx, userId);
    const id = await ctx.db.insert("savedPhrases", {
      userId,
      key,
      phrase: known ?? phrase,
      status: known ? "approved" : "queued",
      sourceMessageIds: [message.messageId],
      createdAt: now,
      updatedAt: now,
      attempt: known ? 0 : 1,
      claim: 0,
      feedback: known
        ? "Matches source-checked lesson material."
        : "Saved as a reference; awaiting a language check before reviews.",
      trace: "",
    });
    if (!known)
      await ctx.scheduler.runAfter(0, internal.referenceAI.check, {
        phraseId: id,
      });
    return { id, status: known ? "approved" : "queued" };
  },
});
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const rows = await ctx.db
      .query("savedPhrases")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(200);
    return rows.map(
      ({ trace: _trace, claim: _claim, leaseUntil: _lease, ...reference }) => ({
        ...reference,
        canRecheckRomaji:
          reference.status === "needsRevision" &&
          correctedRomaji(reference.phrase) !== null,
      }),
    );
  },
});
export const retry = mutation({
  args: { phraseId: v.id("savedPhrases") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx),
      row = await ctx.db.get(args.phraseId);
    if (!row || row.userId !== userId)
      throw new ConvexError("Reference unavailable.");
    if (
      row.status === "approved" ||
      (row.status === "queued" && Date.now() - row.updatedAt < 90_000) ||
      (row.status === "checking" && (row.leaseUntil ?? Infinity) > Date.now())
    )
      return;
    const revised =
      row.status === "needsRevision" ? correctedRomaji(row.phrase) : null;
    if (row.status === "needsRevision" && !revised)
      throw new ConvexError(
        "The text or reading still needs a correction before review.",
      );
    if (row.attempt >= 3)
      throw new ConvexError(
        "This check reached its retry limit. Keep the reference and continue studying.",
      );
    await limit(ctx, userId);
    await ctx.db.patch(row._id, {
      status: "queued",
      attempt: row.attempt + 1,
      claim: row.claim + 1,
      updatedAt: Date.now(),
      ...(revised ? { phrase: revised } : {}),
    });
    await ctx.scheduler.runAfter(0, internal.referenceAI.check, {
      phraseId: row._id,
    });
  },
});
export const claim = internalMutation({
  args: { phraseId: v.id("savedPhrases") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.phraseId);
    if (!row || row.status !== "queued") return null;
    const claim = row.claim + 1;
    await ctx.db.patch(row._id, {
      claim,
      status: "checking",
      leaseUntil: Date.now() + 60_000,
      updatedAt: Date.now(),
    });
    return { ...row, claim };
  },
});
export const settle = internalMutation({
  args: {
    phraseId: v.id("savedPhrases"),
    claim: v.number(),
    decision: v.union(
      v.literal("approved"),
      v.literal("needsRevision"),
      v.literal("unavailable"),
    ),
    feedback: v.string(),
    corrected: v.optional(phraseValue),
    trace: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.phraseId);
    if (!row || row.claim !== args.claim || row.status !== "checking") return;
    if (args.feedback.length > 500) throw new Error("Invalid phrase feedback.");
    await ctx.db.patch(row._id, {
      status: args.decision,
      feedback: args.feedback,
      corrected: args.corrected,
      trace: args.trace.slice(0, 12000),
      updatedAt: Date.now(),
    });
  },
});
