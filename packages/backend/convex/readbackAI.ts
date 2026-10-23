"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  prepareReadback,
  readbackFailureCode,
  type ReadbackReceipt,
} from "./lib/ai/readback";
export const run = internalAction({
  args: { id: v.id("readbackAssets") },
  handler: async (ctx, args): Promise<void> => {
    const row = await ctx.runMutation(internal.readback.claim, args);
    if (!row) return;
    const receipts: ReadbackReceipt[] = [];
    let orphan: Awaited<ReturnType<typeof ctx.storage.store>> | undefined;
    try {
      const result = await prepareReadback(
        row.source.reading,
        {
          accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
          gatewayId: process.env.CLOUDFLARE_GATEWAY_ID ?? "",
          gatewayToken: process.env.CLOUDFLARE_GATEWAY_TOKEN ?? "",
          geminiKey: process.env.GEMINI_API_KEY ?? "",
        },
        `readback.${row._id}.${row.attempt}.${row.claim}`,
        {
          reserve: async (
            operationId,
            model,
            inputTokenBound,
            outputTokenBound,
          ) => {
            if (
              !(await ctx.runQuery(internal.readback.dispatchable, {
                ...args,
                claim: row.claim,
              }))
            )
              return false;
            return (
              await ctx.runMutation(internal.aiBudget.reserve, {
                ownerId: row.userId,
                operationId,
                model,
                inputTokenBound,
                outputTokenBound,
              })
            ).start;
          },
          settle: async (operationId, inputTokens, outputTokens) => {
            await ctx.runMutation(internal.aiBudget.settle, {
              operationId,
              inputTokens,
              outputTokens,
            });
          },
          record: (receipt) => receipts.push(receipt),
        },
      );
      orphan = await ctx.storage.store(
        new Blob([new Uint8Array(result.bytes)], {
          type: "audio/x-kiro-readback",
        }),
      );
      await ctx.runMutation(internal.readback.settle, {
        ...args,
        claim: row.claim,
        storageId: orphan,
        sha256: result.sha256,
        bytes: result.bytes.length,
        durationMillis: result.durationMillis,
        checkedKana: result.checkedKana,
        trace: JSON.stringify({ receipts }),
      });
      orphan = undefined;
    } catch (error) {
      if (orphan) await ctx.storage.delete(orphan);
      await ctx.runMutation(internal.readback.settle, {
        ...args,
        claim: row.claim,
        trace: JSON.stringify({
          receipts,
          failureCode: readbackFailureCode(error),
        }),
      });
    }
  },
});
