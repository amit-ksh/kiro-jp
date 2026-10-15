import { action, query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v, ConvexError } from "convex/values";
import { preparedLessons } from "@packages/content";
import { requireUser } from "./lib/ownership";
import { importDataValue, importCodeValue } from "./importValues";
import {
  importWaniKani,
  WaniKaniImportError,
  type FamiliarityTarget,
} from "./lib/wanikani";
import type { WaniKaniImportCode } from "@packages/learning-core";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const row = await ctx.db
      .query("wanikaniImports")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return row
      ? {
          status:
            row.status === "running" && row.leaseUntil < Date.now()
              ? ("unavailable" as const)
              : row.status,
          snapshot: row.snapshot ?? null,
          errorCode: row.errorCode ?? null,
        }
      : null;
  },
});
export const begin = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    if (!(await ctx.db.get(userId))) return null;
    const now = Date.now(),
      row = await ctx.db
        .query("wanikaniImports")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
    if (
      row &&
      ((row.status === "running" && row.leaseUntil > now) ||
        now - row.updatedAt < 15_000)
    )
      return null;
    const revision = (row?.revision ?? 0) + 1;
    const next = {
      userId,
      revision,
      status: "running" as const,
      leaseUntil: now + 45_000,
      updatedAt: now,
      errorCode: undefined,
    };
    if (row) await ctx.db.patch(row._id, next);
    else await ctx.db.insert("wanikaniImports", next);
    await ctx.scheduler.runAfter(45_000, internal.imports.expire, {
      userId,
      revision,
    });
    return revision;
  },
});
export const expire = internalMutation({
  args: { userId: v.id("users"), revision: v.number() },
  handler: async (ctx, args) => {
    if (!(await ctx.db.get(args.userId))) return;
    const row = await ctx.db
      .query("wanikaniImports")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (
      row &&
      row.revision === args.revision &&
      row.status === "running" &&
      row.leaseUntil <= Date.now()
    )
      await ctx.db.patch(row._id, {
        status: "unavailable",
        errorCode: "unavailable",
        leaseUntil: 0,
        updatedAt: Date.now(),
      });
  },
});
export const finish = internalMutation({
  args: {
    userId: v.id("users"),
    revision: v.number(),
    data: v.optional(importDataValue),
    errorCode: v.optional(importCodeValue),
  },
  handler: async (ctx, args) => {
    if (!(await ctx.db.get(args.userId))) return false;
    const row = await ctx.db
      .query("wanikaniImports")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (
      !row ||
      row.revision !== args.revision ||
      row.status !== "running" ||
      row.leaseUntil < Date.now()
    )
      return false;
    if (args.data && args.errorCode)
      throw new ConvexError("Invalid import result.");
    if (args.data && args.data.items.length > 200)
      throw new ConvexError("Import is too large.");
    const now = Date.now();
    await ctx.db.patch(
      row._id,
      args.data
        ? {
            status: "ready",
            updatedAt: now,
            leaseUntil: 0,
            errorCode: undefined,
            snapshot: { ...args.data, importedAt: now },
          }
        : {
            status: "unavailable",
            updatedAt: now,
            leaseUntil: 0,
            errorCode: args.errorCode ?? "unavailable",
          },
    );
    return true;
  },
});
export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx),
      row = await ctx.db
        .query("wanikaniImports")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
    // Increment the fence even during an active import. A delayed result cannot
    // restore data after the learner removes it.
    if (row)
      await ctx.db.patch(row._id, {
        revision: row.revision + 1,
        status: "empty",
        snapshot: undefined,
        errorCode: undefined,
        updatedAt: Date.now(),
        leaseUntil: 0,
      });
  },
});
export const run = action({
  args: { token: v.string() },
  handler: async (
    ctx,
    { token },
  ): Promise<{
    ok: boolean;
    code?: WaniKaniImportCode | "busy" | "superseded";
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Sign in before importing familiarity.");
    if (!/^[A-Za-z0-9_-]{20,200}$/.test(token))
      return { ok: false, code: "invalid-token" };
    const revision: number | null = await ctx.runMutation(
      internal.imports.begin,
      { userId },
    );
    if (revision === null) return { ok: false, code: "busy" };
    try {
      const targets: FamiliarityTarget[] = preparedLessons.flatMap((lesson) =>
        lesson.words.flatMap((word) => [
          { type: "kanji" as const, characters: word.kanji },
          { type: "vocabulary" as const, characters: word.word },
        ]),
      );
      const data = await importWaniKani(token, targets);
      const saved: boolean = await ctx.runMutation(internal.imports.finish, {
        userId,
        revision,
        data,
      });
      return saved ? { ok: true } : { ok: false, code: "superseded" };
    } catch (error) {
      const code =
        error instanceof WaniKaniImportError ? error.code : "unavailable";
      await ctx.runMutation(internal.imports.finish, {
        userId,
        revision,
        errorCode: code,
      });
      return { ok: false, code };
    }
  },
});
