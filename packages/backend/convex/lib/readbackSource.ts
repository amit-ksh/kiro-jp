import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

// Audio is a derivative of one authoritative source, never caller-supplied text.
// Generation requires the current active conversation; owned historical audio
// remains playable after its practice segment has ended.
export async function readbackSourceAvailable(
  ctx: QueryCtx | MutationCtx,
  row: Pick<
    Doc<"readbackAssets">,
    | "userId"
    | "phraseId"
    | "conversationId"
    | "messageId"
    | "segmentId"
    | "source"
  >,
  requireActiveConversation = false,
) {
  if (!(await ctx.db.get(row.userId))) return false;
  const same = (source: typeof row.source) =>
    source.japanese === row.source.japanese &&
    source.reading === row.source.reading &&
    source.romaji === row.source.romaji &&
    source.english === row.source.english;
  if (row.phraseId) {
    if (row.conversationId || row.messageId || row.segmentId) return false;
    const phrase = await ctx.db.get(row.phraseId);
    return Boolean(
      phrase?.userId === row.userId &&
      phrase.status === "approved" &&
      same(phrase.phrase),
    );
  }
  if (!row.conversationId || !row.messageId || !row.segmentId) return false;
  const conversation = await ctx.db.get(row.conversationId);
  if (!conversation || conversation.userId !== row.userId) return false;
  const segment = await ctx.db
    .query("conversationSegments")
    .withIndex("by_user_segment", (q) =>
      q.eq("userId", row.userId).eq("segmentId", row.segmentId!),
    )
    .unique();
  if (
    !segment ||
    segment.conversationId !== conversation._id ||
    (requireActiveConversation &&
      (segment.state !== "active" ||
        conversation.currentSegmentId !== segment.segmentId))
  )
    return false;
  const message = await ctx.db
    .query("conversationMessages")
    .withIndex("by_user_message", (q) =>
      q.eq("userId", row.userId).eq("messageId", row.messageId!),
    )
    .unique();
  return Boolean(
    message &&
    message.conversationId === conversation._id &&
    message.segmentId === segment.segmentId &&
    message.role === "assistant" &&
    !message.stale &&
    message.reply &&
    same(message.reply),
  );
}
