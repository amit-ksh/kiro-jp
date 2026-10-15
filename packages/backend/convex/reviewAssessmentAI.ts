"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { curriculum } from "@packages/content";
import { actionGateway } from "./lib/ai/service";
import { generateSentenceFeedback } from "./lib/ai/sentence";
import type { GatewayReceipt } from "./lib/ai/providers";
export const run = internalAction({
  args: { id: v.id("reviewAssessments") },
  handler: async (ctx, args): Promise<void> => {
    const row = await ctx.runMutation(internal.reviewAssessment.claim, args);
    if (!row) return;
    const receipts: GatewayReceipt[] = [];
    try {
      const lesson = curriculum.get(row.card.sourceId, row.card.sourceVersion);
      if (!lesson)
        throw new Error("Source lesson unavailable.");
      const model = actionGateway(
        ctx,
        `reviewSentence.${row._id}.${row.attempt}.${row.claim}`,
        receipts,
        () =>
          ctx.runQuery(internal.reviewAssessment.dispatchable, {
            ...args,
            claim: row.claim,
          }),
        row.userId,
      );
      const result = await generateSentenceFeedback(
        model,
        { eventId: row.eventId, input: row.source.input },
        lesson,
        row.card.exercise,
      );
      if (
        !receipts.length ||
        receipts.some(
          (receipt) => !receipt.gatewayLogId || receipt.status !== 200,
        )
      )
        throw new Error("Gateway receipt unavailable.");
      await ctx.runMutation(internal.reviewAssessment.settle, {
        ...args,
        claim: row.claim,
        ...result,
        trace: JSON.stringify({ receipts }),
      });
    } catch {
      await ctx.runMutation(internal.reviewAssessment.settle, {
        ...args,
        claim: row.claim,
        trace: JSON.stringify({ receipts }),
      });
    }
  },
});
