"use node";

import { createGoogle } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export type ConversationProvider = "gemini" | "openrouter";
export const defaultOpenRouterModel = "nvidia/nemotron-3-super-120b-a12b:free";
export interface GatewayConfig {
  accountId: string;
  gatewayId: string;
  gatewayToken: string;
  geminiKey?: string;
  openRouterKey?: string;
  openRouterModel?: string;
  openRouterPath?: "/openrouter" | "/openrouter/v1";
}
export interface Dispatch {
  operationId: string;
  provider: ConversationProvider;
  model: string;
  inputTokenBound: number;
  outputTokenBound: number;
}
export interface GatewayReceipt {
  operationId: string;
  provider: ConversationProvider;
  model: string;
  status: number;
  gatewayLogId?: string;
  finishReason?: string;
  visibleCharacters?: number;
  reasoningTokens?: number;
  responseContentType?: string;
  responseBytes?: number;
  responseJsonValid?: boolean;
  responseReadError?: string;
  responseReadAborted?: boolean;
  responseElapsedMs?: number;
}
export interface GatewayBudget {
  reserve: (dispatch: Dispatch) => Promise<boolean>;
  settle: (operationId: string, usage: { inputTokens: number; outputTokens: number }) => Promise<void>;
  record?: (receipt: GatewayReceipt) => void;
}
export class GatewayControlError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.name = "GatewayControlError"; this.code = code; }
}

// Use this policy for plain generations and the bounded tutor. Reservations
// live in fetch middleware, because SDK lifecycle callback failures can be
// swallowed. No feature may rely on a callback as the spending gate.
export const generationPolicy = {
  maxRetries: 0,
  maxOutputTokens: 2048,
  timeout: 45_000,
  telemetry: { isEnabled: false, recordInputs: false, recordOutputs: false },
  include: { requestBody: false, requestMessages: false, responseBody: false },
} as const;

export function createGatewayModel(provider: ConversationProvider, config: GatewayConfig, operationPrefix: string, budget: GatewayBudget, transport: typeof fetch = fetch) {
  if (provider !== "gemini" && provider !== "openrouter") throw new GatewayControlError("UNKNOWN_AI_PROVIDER");
  if (![config.accountId, config.gatewayId].every(value => /^[A-Za-z0-9_-]{1,128}$/.test(value)) || !config.gatewayToken) throw new GatewayControlError("GATEWAY_NOT_CONFIGURED");
  if (!/^[A-Za-z0-9:._-]{1,120}$/.test(operationPrefix)) throw new GatewayControlError("INVALID_AI_OPERATION");
  const model = provider === "gemini" ? "gemini-3.8-flash" : config.openRouterModel ?? defaultOpenRouterModel;
  const key = provider === "gemini" ? config.geminiKey : config.openRouterKey;
  if (!key) throw new GatewayControlError("PROVIDER_NOT_CONFIGURED");
  if (provider === "openrouter" && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.:-]+:free$/.test(model)) throw new GatewayControlError("FREE_MODEL_REQUIRED");
  const routerPath = config.openRouterPath ?? "/openrouter";
  if (routerPath !== "/openrouter" && routerPath !== "/openrouter/v1") throw new GatewayControlError("INVALID_GATEWAY_ROUTE");
  const root = `https://gateway.ai.cloudflare.com/v1/${config.accountId}/${config.gatewayId}`;
  const baseURL = provider === "gemini" ? `${root}/google-ai-studio/v1beta` : `${root}${routerPath}`;
  const endpoint = provider === "gemini" ? `${baseURL}/models/${model}:generateContent` : `${baseURL}/chat/completions`;
  const headers = {
    "cf-aig-authorization": `Bearer ${config.gatewayToken}`,
    "cf-aig-max-attempts": "1",
    "cf-aig-no-wholesale": "true",
    "cf-aig-skip-cache": "true",
    "cf-aig-collect-log-payload": "false",
    "cf-aig-request-timeout": "30000",
  };
  let dispatched = 0;
  const deadline = Date.now() + 45_000;
  const guardedFetch: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url !== endpoint || init?.method?.toUpperCase() !== "POST" || typeof init.body !== "string") throw new GatewayControlError("INVALID_AI_TRANSPORT");
    if (Date.now() >= deadline || init.signal?.aborted) throw new GatewayControlError("AI_DEADLINE");
    const bytes = new TextEncoder().encode(init.body).length;
    if (bytes > 65_536) throw new GatewayControlError("AI_INPUT_TOO_LARGE");
    const body = JSON.parse(init.body);
    if (body.stream) throw new GatewayControlError("DISCRETE_GENERATION_ONLY");
    const outputLimit = provider === "gemini" ? body.generationConfig?.maxOutputTokens : body.max_tokens;
    if (!Number.isSafeInteger(outputLimit) || outputLimit < 1 || outputLimit > 4096) throw new GatewayControlError("INVALID_AI_OUTPUT_LIMIT");
    if (provider === "gemini" && body.contents?.some((content: { parts?: Record<string, unknown>[] }) => content.parts?.some(part => part.inlineData || part.fileData))) throw new GatewayControlError("TEXT_CAPABILITY_ONLY");
    if (provider === "gemini" && body.tools?.some((tool: { functionDeclarations?: unknown[] }) => !Array.isArray(tool.functionDeclarations))) throw new GatewayControlError("CLIENT_TOOLS_ONLY");
    if (provider === "openrouter" && body.messages?.some((message: { content?: unknown }) => Array.isArray(message.content) && message.content.some((part: { type?: string }) => part.type !== "text"))) throw new GatewayControlError("TEXT_CAPABILITY_ONLY");
    if (dispatched >= 3) throw new GatewayControlError("AI_TURN_LIMIT");
    const operationId = `${operationPrefix}.${provider}.${dispatched++}`;
    // Text tokenizers cannot exceed one token per encoded byte plus control
    // tokens. Keep a control-token margin and reserve Google's entire published
    // output ceiling until its reasoning/output accounting is live-checked.
    if (!await budget.reserve({ operationId, provider, model, inputTokenBound: bytes + 4096, outputTokenBound: provider === "gemini" ? 65_536 : outputLimit })) throw new GatewayControlError("AI_ALREADY_DISPATCHED");
    const signal = init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(Math.max(1, deadline - Date.now()))]) : AbortSignal.timeout(Math.max(1, deadline - Date.now()));
    const outgoingHeaders = new Headers(init.headers);
    for (const [name, value] of Object.entries(headers)) outgoingHeaders.set(name, value);
    const responseStarted = Date.now();
    const response = await transport(input, { ...init, headers: outgoingHeaders, redirect: "error", signal });
    const gatewayLogId = response.headers.get("cf-aig-log-id") ?? undefined;
    const receipt: GatewayReceipt = { operationId, provider, model, status: response.status, ...(gatewayLogId ? { gatewayLogId } : {}) };
    budget.record?.(receipt);
    if (response.ok && provider === "openrouter") {
      const mime = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
      receipt.responseContentType = ["application/json", "text/html", "text/plain", "text/event-stream"].includes(mime ?? "") ? mime : "other";
      let result;
      try {
        const body = await response.clone().text();
        receipt.responseBytes = new TextEncoder().encode(body).byteLength;
        result = JSON.parse(body);
        receipt.responseJsonValid = true;
      } catch (error) {
        receipt.responseJsonValid = false;
        receipt.responseReadError = error instanceof Error ? error.name : "unknown";
        receipt.responseReadAborted = signal.aborted;
      }
      receipt.responseElapsedMs = Date.now() - responseStarted;
      const choice = result?.choices?.[0];
      if (typeof choice?.finish_reason === "string") receipt.finishReason = choice.finish_reason;
      if (typeof choice?.message?.content === "string") receipt.visibleCharacters = choice.message.content.length;
      const reasoning = result?.usage?.completion_tokens_details?.reasoning_tokens;
      if (Number.isSafeInteger(reasoning) && reasoning >= 0) receipt.reasoningTokens = reasoning;
    }
    if (response.ok && provider === "gemini") {
      const result = await response.clone().json().catch(() => null);
      const usage = result?.usageMetadata;
      const inputTokens = usage?.promptTokenCount;
      const candidateTokens = usage?.candidatesTokenCount;
      const thoughtTokens = usage?.thoughtsTokenCount ?? 0;
      if ([inputTokens, candidateTokens, thoughtTokens].every(value => Number.isSafeInteger(value) && value >= 0)) {
        const totalOutput = Number.isSafeInteger(usage?.totalTokenCount) && usage.totalTokenCount >= inputTokens ? usage.totalTokenCount - inputTokens : 0;
        await budget.settle(operationId, { inputTokens, outputTokens: Math.max(candidateTokens + thoughtTokens, totalOutput) });
      }
    }
    // Failures and absent/invalid usage retain the entire reservation.
    return response;
  };
  if (provider === "gemini") return createGoogle({ apiKey: key, baseURL, headers, fetch: guardedFetch })(model);
  return createOpenAICompatible({
    name: "openrouter", apiKey: key, baseURL, headers, fetch: guardedFetch, supportsStructuredOutputs: true,
    transformRequestBody: body => ({ ...body, model, ...(model === defaultOpenRouterModel ? { reasoning: { max_tokens: 256 } } : {}), plugins: [], provider: { allow_fallbacks: false, require_parameters: true, max_price: { prompt: 0, completion: 0, request: 0, image: 0 } } }),
  })(model);
}
