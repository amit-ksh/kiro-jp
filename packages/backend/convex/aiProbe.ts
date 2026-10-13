"use node";

import { generateText, Output } from "ai";
import { z } from "zod";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { createGatewayModel, generationPolicy, GatewayControlError, type GatewayReceipt } from "./lib/ai/providers";

// Admin-only, fixed synthetic prompt. This proves configured transport/schema
// support; it is not a learner conversation or an assertion of tutor quality.
export const check = internalAction({
  args: { provider: v.union(v.literal("gemini"), v.literal("openrouter")), operationPrefix: v.string(), openRouterPath: v.optional(v.union(v.literal("/openrouter"), v.literal("/openrouter/v1"))) },
  handler: async (ctx, args): Promise<{ passed: boolean; provider: string; nodeVersion: string; status: number | null; code?: string; output?: { japanese: string; english: string }; receipts: GatewayReceipt[]; inputTokens?: number | null; outputTokens?: number | null }> => {
    const receipts: GatewayReceipt[] = [];
    try {
      const model = createGatewayModel(args.provider, {
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "", gatewayId: process.env.CLOUDFLARE_GATEWAY_ID ?? "", gatewayToken: process.env.CLOUDFLARE_GATEWAY_TOKEN ?? "",
        geminiKey: process.env.GEMINI_API_KEY, openRouterKey: process.env.OPENROUTER_API_KEY, openRouterModel: process.env.OPENROUTER_MODEL,
        openRouterPath: args.openRouterPath,
      }, args.operationPrefix, {
        reserve: async dispatch => dispatch.provider === "gemini" ? (await ctx.runMutation(internal.aiBudget.reserve, { operationId: dispatch.operationId, model: "gemini-3.8-flash", inputTokenBound: dispatch.inputTokenBound, outputTokenBound: dispatch.outputTokenBound })).start : (await ctx.runMutation(internal.aiQuota.reserve, { operationId: dispatch.operationId })).start,
        settle: async (operationId, usage) => { await ctx.runMutation(internal.aiBudget.settle, { operationId, ...usage }); },
        record: receipt => receipts.push(receipt),
      });
      const result = await generateText({
        ...generationPolicy, model,
        prompt: 'Return a Japanese greeting and its English meaning. Use exactly こんにちは。 for japanese and Hello. for english. Do not add any other advice or cultural claims.',
        output: Output.object({ schema: z.object({ japanese: z.string().max(30), english: z.string().max(50) }) }),
      });
      const output = result.output;
      const passed = output.japanese === "こんにちは。" && /^hello\.?$/i.test(output.english.trim());
      return { passed, provider: args.provider, nodeVersion: process.versions.node, status: receipts[receipts.length - 1]?.status ?? null, output, receipts, inputTokens: result.usage.inputTokens ?? null, outputTokens: result.usage.outputTokens ?? null };
    } catch (error) {
      return { passed: false, provider: args.provider, nodeVersion: process.versions.node, status: receipts[receipts.length - 1]?.status ?? null, code: error instanceof GatewayControlError ? error.code : "PROVIDER_PROBE_FAILED", receipts };
    }
  },
});
