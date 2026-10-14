"use node";
import type { ActionCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import {
  createGatewayModel,
  GatewayControlError,
  type ConversationProvider,
  type GatewayReceipt,
} from "./providers";
// One spending/transport boundary for chat, recap and language checks.
export function actionGateway(
  ctx: Pick<ActionCtx, "runMutation">,
  prefix: string,
  receipts: GatewayReceipt[],
) {
  const configured = process.env.AI_CONVERSATION_PROVIDER ?? "gemini";
  if (configured !== "gemini" && configured !== "openrouter")
    throw new GatewayControlError("UNKNOWN_AI_PROVIDER");
  const provider: ConversationProvider = configured;
  return createGatewayModel(
    provider,
    {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
      gatewayId: process.env.CLOUDFLARE_GATEWAY_ID ?? "",
      gatewayToken: process.env.CLOUDFLARE_GATEWAY_TOKEN ?? "",
      geminiKey: process.env.GEMINI_API_KEY,
      openRouterKey: process.env.OPENROUTER_API_KEY,
      openRouterModel: process.env.OPENROUTER_MODEL,
    },
    prefix,
    {
      reserve: async (dispatch) =>
        dispatch.provider === "gemini"
          ? (
              await ctx.runMutation(internal.aiBudget.reserve, {
                operationId: dispatch.operationId,
                model: "gemini-3.8-flash",
                inputTokenBound: dispatch.inputTokenBound,
                outputTokenBound: dispatch.outputTokenBound,
              })
            ).start
          : (
              await ctx.runMutation(internal.aiQuota.reserve, {
                operationId: dispatch.operationId,
              })
            ).start,
      settle: async (operationId, usage) => {
        await ctx.runMutation(internal.aiBudget.settle, {
          operationId,
          ...usage,
        });
      },
      record: (receipt) => receipts.push(receipt),
    },
  );
}
