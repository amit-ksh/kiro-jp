import { internalMutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { checkedContentManifests } from "@packages/content";
import { storageChecksumHex } from "@packages/learning-core";

export const getPackage = query({
  args: { lessonId: v.string(), version: v.number() },
  handler: async (ctx, args) => {
    const manifest = checkedContentManifests.find(
      (m) => m.lessonId === args.lessonId && m.version === args.version,
    );
    if (!manifest) return null;
    const row = await ctx.db
      .query("contentPackages")
      .withIndex("by_lesson_version", (q) =>
        q.eq("lessonId", args.lessonId).eq("version", args.version),
      )
      .unique();
    if (!row || row.sha256 !== manifest.sha256) return null;
    const files = await Promise.all(
      row.files.map(async (file) => ({
        assetId: file.assetId,
        url: await ctx.storage.getUrl(file.storageId),
      })),
    );
    if (files.some((file) => !file.url)) return null;
    // Checked original teaching material is public; no learner/Qloo/credential data is included.
    return { manifest, files };
  },
});

// Only the deployment administrator can invoke these internal publication functions.
export const uploadUrl = internalMutation({
  args: {},
  handler: (ctx) => ctx.storage.generateUploadUrl(),
});
export const publish = internalMutation({
  args: {
    lessonId: v.string(),
    version: v.number(),
    files: v.array(
      v.object({ assetId: v.string(), storageId: v.id("_storage") }),
    ),
  },
  handler: async (ctx, args) => {
    const manifest = checkedContentManifests.find(
      (m) => m.lessonId === args.lessonId && m.version === args.version,
    );
    if (
      !manifest ||
      args.files.length !== manifest.assets.length ||
      new Set(args.files.map((f) => f.assetId)).size !== manifest.assets.length
    )
      throw new ConvexError("Only a complete checked package can publish.");
    for (const asset of manifest.assets) {
      const file = args.files.find((f) => f.assetId === asset.id),
        metadata = file ? await ctx.db.system.get(file.storageId) : null;
      if (
        !metadata ||
        storageChecksumHex(metadata.sha256) !== asset.sha256 ||
        metadata.size !== asset.bytes ||
        metadata.contentType !== asset.mime
      )
        throw new ConvexError({
          message: "A content file failed its checked hash, type or size.",
          asset: asset.id,
          sizeMatches: metadata?.size === asset.bytes,
          typeMatches: metadata?.contentType === asset.mime,
          hashMatches: metadata
            ? storageChecksumHex(metadata.sha256) === asset.sha256
            : false,
          hashLength: metadata?.sha256.length ?? 0,
        });
    }
    const previous = await ctx.db
      .query("contentPackages")
      .withIndex("by_lesson_version", (q) =>
        q.eq("lessonId", args.lessonId).eq("version", args.version),
      )
      .unique();
    if (previous) {
      if (previous.sha256 !== manifest.sha256)
        throw new ConvexError("Published package versions are immutable.");
      await ctx.db.patch(previous._id, { files: args.files });
    } else
      await ctx.db.insert("contentPackages", {
        ...args,
        sha256: manifest.sha256,
        publishedAt: Date.now(),
      });
    return { sha256: manifest.sha256, assets: manifest.assets.length };
  },
});
