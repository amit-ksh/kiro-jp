"use node";
import { v } from "convex/values";
import { createHash } from "node:crypto";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { transcribeRecording, type SpeechReceipt } from "./lib/ai/speech";
export const run = internalAction({
  args: { id: v.id("speechAttempts") },
  handler: async (ctx, args): Promise<void> => {
    const row = await ctx.runMutation(internal.speech.claim, args);
    if (!row?.storageId) return;
    const receipts: SpeechReceipt[] = [];
    try {
      const blob = await ctx.storage.get(row.storageId);
      if (!blob || blob.size !== row.bytes || blob.size > 2 * 1024 * 1024)
        throw new Error("RECORDING_UNAVAILABLE");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (createHash("sha256").update(bytes).digest("hex") !== row.sha256)
        throw new Error("RECORDING_MISMATCH");
      const operationId = `whisper.${row._id}.${row.attempt}.${row.claim}`;
      const result = await transcribeRecording(
        bytes,
        {
          accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
          gatewayId: process.env.CLOUDFLARE_GATEWAY_ID ?? "",
          gatewayToken: process.env.CLOUDFLARE_GATEWAY_TOKEN ?? "",
          workersToken: process.env.CLOUDFLARE_WORKERS_AI_TOKEN ?? "",
          freeOnlyVerified:
            process.env.WORKERS_AI_FREE_ONLY_VERIFIED === "true",
        },
        operationId,
        () =>
          ctx.runMutation(internal.speech.reserve, {
            ...args,
            claim: row.claim,
            operationId,
          }),
        (receipt) => receipts.push(receipt),
      );
      await ctx.runMutation(internal.speech.settle, {
        ...args,
        claim: row.claim,
        transcript: result.text,
        segments: result.segments,
        trace: JSON.stringify({ receipts }),
      });
    } catch {
      await ctx.runMutation(internal.speech.settle, {
        ...args,
        claim: row.claim,
        trace: JSON.stringify({ receipts }),
      });
    }
  },
});
