import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

// Fixed owner indexes only. Shared content and spending/quota ledgers are never
// deleted or refunded. Batches stay bounded even for years of study history.
export const deletionCollections = ["conversationJobs","lessonAssessments","reviewAssessments","speechAttempts","readbackAssets","speechDeletions","wanikaniImports","qlooContextCache","culturalSelections","conversationMessages","conversationSegments","conversations","lessonConversationGoals","savedPhrases","reviewAttempts","reviewOpportunities","reviewTracks","reviewChanges","reviewCursors","studyEvents","studySessions","studyCursors","conversationLimits","learnerProfiles"] as const;
const batchSize = 25;
export async function deleteLearningBatch(ctx: MutationCtx, userId: Id<"users">, phase: number) {
  const rows = await (async () => {
    switch (deletionCollections[phase]) {
      case "conversationJobs": return ctx.db.query("conversationJobs").withIndex("by_user", q => q.eq("userId", userId)).take(batchSize);
      case "lessonAssessments": return ctx.db.query("lessonAssessments").withIndex("by_user_event", q => q.eq("userId", userId)).take(batchSize);
      case "reviewAssessments": return ctx.db.query("reviewAssessments").withIndex("by_user_event", q => q.eq("userId", userId)).take(batchSize);
      case "speechAttempts": return ctx.db.query("speechAttempts").withIndex("by_user_recording", q => q.eq("userId", userId)).take(batchSize);
      case "readbackAssets": return ctx.db.query("readbackAssets").withIndex("by_user_phrase_voice", q => q.eq("userId", userId)).take(batchSize);
      case "speechDeletions": return ctx.db.query("speechDeletions").withIndex("by_user_recording", q => q.eq("userId", userId)).take(batchSize);
      case "wanikaniImports": return ctx.db.query("wanikaniImports").withIndex("by_user", q => q.eq("userId", userId)).take(batchSize);
      case "qlooContextCache": return ctx.db.query("qlooContextCache").withIndex("by_user_key", q => q.eq("userId", userId)).take(batchSize);
      case "culturalSelections": return ctx.db.query("culturalSelections").withIndex("by_user", q => q.eq("userId", userId)).take(batchSize);
      case "conversationMessages": return ctx.db.query("conversationMessages").withIndex("by_user_message", q => q.eq("userId", userId)).take(batchSize);
      case "conversationSegments": return ctx.db.query("conversationSegments").withIndex("by_user_segment", q => q.eq("userId", userId)).take(batchSize);
      case "conversations": return ctx.db.query("conversations").withIndex("by_user_client", q => q.eq("userId", userId)).take(batchSize);
      case "lessonConversationGoals": return ctx.db.query("lessonConversationGoals").withIndex("by_user_session", q => q.eq("userId", userId)).take(batchSize);
      case "savedPhrases": return ctx.db.query("savedPhrases").withIndex("by_user_key", q => q.eq("userId", userId)).take(batchSize);
      case "reviewAttempts": return ctx.db.query("reviewAttempts").withIndex("by_user_event", q => q.eq("userId", userId)).take(batchSize);
      case "reviewOpportunities": return ctx.db.query("reviewOpportunities").withIndex("by_user_opportunity", q => q.eq("userId", userId)).take(batchSize);
      case "reviewTracks": return ctx.db.query("reviewTracks").withIndex("by_user_track", q => q.eq("userId", userId)).take(batchSize);
      case "reviewChanges": return ctx.db.query("reviewChanges").withIndex("by_user_cursor", q => q.eq("userId", userId)).take(batchSize);
      case "reviewCursors": return ctx.db.query("reviewCursors").withIndex("by_user", q => q.eq("userId", userId)).take(batchSize);
      case "studyEvents": return ctx.db.query("studyEvents").withIndex("by_user_cursor", q => q.eq("userId", userId)).take(batchSize);
      case "studySessions": return ctx.db.query("studySessions").withIndex("by_user_session", q => q.eq("userId", userId)).take(batchSize);
      case "studyCursors": return ctx.db.query("studyCursors").withIndex("by_user", q => q.eq("userId", userId)).take(batchSize);
      case "conversationLimits": return ctx.db.query("conversationLimits").withIndex("by_user", q => q.eq("userId", userId)).take(batchSize);
      case "learnerProfiles": return ctx.db.query("learnerProfiles").withIndex("by_user", q => q.eq("userId", userId)).take(batchSize);
      default: return [];
    }
  })();
  for (const row of rows) {
    if ("storageId" in row && row.storageId) await ctx.storage.delete(row.storageId);
    await ctx.db.delete(row._id);
  }
  return rows.length;
}

export async function deleteAuthBatch(ctx: MutationCtx, userId: Id<"users">) {
  const session = await ctx.db.query("authSessions").withIndex("userId", q => q.eq("userId", userId)).first();
  if (session) {
    // Refresh 0.0.96 checks this expiration. Keep the session pointer until all
    // children are gone, so a crash cannot strand tokens or verifiers.
    if (session.expirationTime !== 0) await ctx.db.patch(session._id, { expirationTime: 0 });
    const tokens = await ctx.db.query("authRefreshTokens").withIndex("sessionId", q => q.eq("sessionId", session._id)).take(batchSize);
    if (tokens.length) { for (const row of tokens) await ctx.db.delete(row._id); return tokens.length; }
    const verifiers = await ctx.db.query("authVerifiers").withIndex("by_session", q => q.eq("sessionId", session._id)).take(batchSize);
    if (verifiers.length) { for (const row of verifiers) await ctx.db.delete(row._id); return verifiers.length; }
    await ctx.db.delete(session._id);
    return 1;
  }
  const account = await ctx.db.query("authAccounts").withIndex("userIdAndProvider", q => q.eq("userId", userId)).first();
  if (account) {
    const codes = await ctx.db.query("authVerificationCodes").withIndex("accountId", q => q.eq("accountId", account._id)).take(batchSize);
    if (codes.length) { for (const row of codes) await ctx.db.delete(row._id); return codes.length; }
    // Password rate limits are keyed by account ID; verification by email.
    for (const identifier of [account._id, account.providerAccountId]) {
      const rates = await ctx.db.query("authRateLimits").withIndex("identifier", q => q.eq("identifier", identifier)).take(batchSize);
      if (rates.length) { for (const row of rates) await ctx.db.delete(row._id); return rates.length; }
    }
    await ctx.db.delete(account._id);
    return 1;
  }
  return 0;
}
