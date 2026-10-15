"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { curriculum } from "@packages/content";
import { exerciseForStep } from "@packages/learning-core";
import { actionGateway } from "./lib/ai/service";
import type { GatewayReceipt } from "./lib/ai/providers";
import { generateSentenceFeedback } from "./lib/ai/sentence";
export const run = internalAction({
  args: { id: v.id("lessonAssessments") },
  handler: async (ctx, args): Promise<void> => {
    const row = await ctx.runMutation(internal.assessment.claim, args);
    if (!row) return;
    const receipts: GatewayReceipt[] = [];
    try {
      const lesson = curriculum.forEvent(row.source);
      if (!lesson) throw new Error("Source lesson version unavailable.");
      const exercise = exerciseForStep(lesson, row.source.stepId);
      if (!exercise) throw new Error("Exercise unavailable.");
      const result = await generateSentenceFeedback(
        actionGateway(ctx, `sentence.${row._id}.${row.attempt}.${row.claim}`, receipts, undefined, row.userId),
        { eventId: row.eventId, input: row.source.input },
        lesson,
        exercise,
      );
      if (!receipts.length || receipts.some(receipt => !receipt.gatewayLogId || receipt.status !== 200))
        throw new Error("Gateway receipt unavailable.");
      await ctx.runMutation(internal.assessment.settle, {
        ...args,
        claim: row.claim,
        ...result,
        trace: JSON.stringify({ receipts }),
      });
    } catch {
      await ctx.runMutation(internal.assessment.settle, {
        ...args,
        claim: row.claim,
        trace: JSON.stringify({ receipts }),
      });
    }
  },
});
