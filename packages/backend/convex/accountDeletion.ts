import { getAuthUserId } from "@convex-dev/auth/server";
import { sha256 } from "@oslojs/crypto/sha2";
import { ConvexError, v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { deleteAuthBatch, deleteLearningBatch, deletionCollections } from "./lib/accountCleanup";

function hashReceipt(receipt: string) {
  if (!/^[a-f0-9]{64}$/.test(receipt)) throw new ConvexError("INVALID_DELETION_RECEIPT");
  return Array.from(sha256(new TextEncoder().encode(receipt)), byte => byte.toString(16).padStart(2, "0")).join("");
}

export const request = mutation({
  args: { confirmation: v.literal("DELETE"), receipt: v.string() },
  handler: async (ctx, { receipt }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("AUTH_REQUIRED");
    const receiptHash = hashReceipt(receipt);
    const existing = await ctx.db.query("accountDeletions").withIndex("by_user", q => q.eq("userId", userId)).unique();
    if (existing) {
      if (existing.receiptHash !== receiptHash) throw new ConvexError("DELETION_ALREADY_REQUESTED");
      return { id: existing._id };
    }
    if (!(await ctx.db.get(userId))) throw new ConvexError("ACCOUNT_UNAVAILABLE");
    if (await ctx.db.query("accountDeletions").withIndex("by_receipt", q => q.eq("receiptHash", receiptHash)).first()) throw new ConvexError("INVALID_DELETION_RECEIPT");
    const now = Date.now();
    const id = await ctx.db.insert("accountDeletions", { userId, receiptHash, status: "pending", phase: -1, deletedCount: 0, createdAt: now, updatedAt: now });
    // The absent user is the permanent fence. All learning transactions, job
    // callbacks, session creation and inference reservations read this row.
    await ctx.db.delete(userId);
    await ctx.scheduler.runAfter(0, internal.accountDeletion.work, { id });
    return { id };
  },
});

// The initiating device persists its random 256-bit receipt before submitting.
// This endpoint survives revocation; it reveals no owner, email or learner data.
export const status = query({
  args: { receipt: v.string() },
  handler: async (ctx, { receipt }) => {
    const receiptHash = hashReceipt(receipt);
    const row = await ctx.db.query("accountDeletions").withIndex("by_receipt", q => q.eq("receiptHash", receiptHash)).unique();
    return row ? { status: row.status } : null;
  },
});

export const work = internalMutation({
  args: { id: v.id("accountDeletions") },
  handler: async (ctx, { id }) => {
    const job = await ctx.db.get(id);
    if (!job || job.status === "complete") return;
    if (await ctx.db.get(job.userId)) throw new Error("Deletion fence is missing.");
    let phase = job.phase, count = 0;
    if (phase === -1) {
      count = await deleteAuthBatch(ctx, job.userId);
      if (!count) phase = 0;
    } else {
      count = await deleteLearningBatch(ctx, job.userId, phase);
      if (!count) phase++;
    }
    await ctx.db.patch(id, { phase, deletedCount: job.deletedCount + count, status: phase >= deletionCollections.length ? "complete" : "pending", updatedAt: Date.now() });
    if (phase < deletionCollections.length) await ctx.scheduler.runAfter(50, internal.accountDeletion.work, { id });
  },
});

// A failed mutation rolls back its writes and next schedule. A small backstop
// restarts old pending jobs; duplicates serialize and bounded work is idempotent.
export const resume = internalMutation({
  args: {},
  handler: async ctx => {
    const jobs = await ctx.db.query("accountDeletions").withIndex("by_status_updated", q => q.eq("status", "pending").lt("updatedAt", Date.now() - 300_000)).take(20);
    for (const job of jobs) {
      await ctx.db.patch(job._id, { updatedAt: Date.now() });
      await ctx.scheduler.runAfter(0, internal.accountDeletion.work, { id: job._id });
    }
  },
});
