import { internalMutation, query } from "./_generated/server";
import { dictionaryCatalog, assertDictionaryCatalog } from "@packages/content";
import { ConvexError, v } from "convex/values";
// Public dictionary facts have no learner/account data. Only a deployment-admin
// invocation can publish the exact checked catalog bundled with this backend.
export const get = query({
  args: { release: v.string(), key: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("dictionaryEntries")
      .withIndex("by_release_key", (q) =>
        q.eq("release", args.release).eq("key", args.key),
      )
      .unique();
    return row ? JSON.parse(row.json) : null;
  },
});
export const manifest = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("dictionaryReleases")
      .withIndex("by_release", (q) =>
        q.eq("release", dictionaryCatalog.release),
      )
      .unique();
    return row
      ? {
          release: row.release,
          count: row.count,
          sources: dictionaryCatalog.sources,
        }
      : null;
  },
});
export const publish = internalMutation({
  args: {},
  handler: async (ctx) => {
    assertDictionaryCatalog(dictionaryCatalog);
    let inserted = 0;
    for (const entry of dictionaryCatalog.entries) {
      const previous = await ctx.db
        .query("dictionaryEntries")
        .withIndex("by_release_key", (q) =>
          q.eq("release", dictionaryCatalog.release).eq("key", entry.key),
        )
        .unique();
      const json = JSON.stringify(entry);
      if (previous) {
        if (previous.json !== json)
          throw new ConvexError("Published dictionary releases are immutable.");
      } else {
        await ctx.db.insert("dictionaryEntries", {
          release: dictionaryCatalog.release,
          key: entry.key,
          kind: entry.kind,
          json,
        });
        inserted++;
      }
    }
    const previous = await ctx.db
      .query("dictionaryReleases")
      .withIndex("by_release", (q) =>
        q.eq("release", dictionaryCatalog.release),
      )
      .unique();
    if (!previous)
      await ctx.db.insert("dictionaryReleases", {
        release: dictionaryCatalog.release,
        count: dictionaryCatalog.entries.length,
        publishedAt: Date.now(),
      });
    return {
      release: dictionaryCatalog.release,
      count: dictionaryCatalog.entries.length,
      inserted,
    };
  },
});
