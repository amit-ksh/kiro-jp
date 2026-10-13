import { test } from "node:test";
import assert from "node:assert/strict";
import { generateText } from "ai";
import { createGatewayModel, defaultOpenRouterModel, generationPolicy, type Dispatch, type GatewayConfig } from "../packages/backend/convex/lib/ai/providers.ts";

const config: GatewayConfig = { accountId: "test-account", gatewayId: "test-gateway", gatewayToken: "fixture-gateway-token", geminiKey: "fixture-google-key", openRouterKey: "fixture-router-key" };
const googleResponse = () => Response.json({ candidates: [{ content: { role: "model", parts: [{ text: "こんにちは。" }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 4, thoughtsTokenCount: 3, totalTokenCount: 12 } });
const routerResponse = () => Response.json({ id: "fixture", created: 1, model: defaultOpenRouterModel, choices: [{ index: 0, message: { role: "assistant", content: "こんにちは。" }, finish_reason: "stop" }], usage: { prompt_tokens: 5, completion_tokens: 4, total_tokens: 9 } });

test("Google requests are reserved before dispatch, stay on Gateway, and include reasoning in settlement", async () => {
  const events: string[] = []; let request: Dispatch | undefined; let measured;
  const model = createGatewayModel("gemini", config, "fixture-google", {
    reserve: async dispatch => { request = dispatch; events.push("reserved"); return true; },
    settle: async (_id, usage) => { measured = usage; events.push("settled"); },
  }, async (url, init) => {
    assert.equal(url, "https://gateway.ai.cloudflare.com/v1/test-account/test-gateway/google-ai-studio/v1beta/models/gemini-3.8-flash:generateContent");
    assert.deepEqual(events, ["reserved"]);
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("cf-aig-max-attempts"), "1");
    assert.equal(headers.get("cf-aig-no-wholesale"), "true");
    assert.equal(headers.get("cf-aig-collect-log-payload"), "false");
    assert.equal(headers.get("cf-aig-skip-cache"), "true");
    assert.equal(headers.get("x-goog-api-key"), config.geminiKey);
    assert.equal(init?.redirect, "error");
    events.push("dispatched"); return googleResponse();
  });
  const result = await generateText({ ...generationPolicy, model, prompt: "Say hello." });
  assert.equal(result.text, "こんにちは。");
  assert.deepEqual(measured, { inputTokens: 5, outputTokens: 7 });
  assert.equal(request?.outputTokenBound, 65_536);
  assert.deepEqual(events, ["reserved", "dispatched", "settled"]);
});

test("OpenRouter has zero-price routing, no model/provider fallback, and no paid plugins", async () => {
  const model = createGatewayModel("openrouter", { ...config, openRouterPath: "/openrouter/v1" }, "fixture-router", { reserve: async () => true, settle: async () => assert.fail("A free-model request cannot settle Gemini spending.") }, async (url, init) => {
    assert.equal(url, "https://gateway.ai.cloudflare.com/v1/test-account/test-gateway/openrouter/v1/chat/completions");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, defaultOpenRouterModel);
    assert.deepEqual(body.plugins, []);
    assert.deepEqual(body.provider, { allow_fallbacks: false, require_parameters: true, max_price: { prompt: 0, completion: 0, request: 0, image: 0 } });
    assert.equal(body.models, undefined);
    assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${config.openRouterKey}`);
    return routerResponse();
  });
  assert.equal((await generateText({ ...generationPolicy, model, prompt: "Say hello." })).text, "こんにちは。");
});

test("paid model IDs and arbitrary proxy routes are rejected before requesting capacity", () => {
  const budget = { reserve: async () => assert.fail("Invalid configuration must not reserve."), settle: async () => {} };
  assert.throws(() => createGatewayModel("openrouter", { ...config, openRouterModel: "paid/example" }, "invalid-model", budget), /FREE_MODEL_REQUIRED/);
  assert.throws(() => createGatewayModel("openrouter", { ...config, openRouterPath: "https://elsewhere.invalid" as GatewayConfig["openRouterPath"] }, "invalid-route", budget), /INVALID_GATEWAY_ROUTE/);
});

test("a reservation rejection prevents any provider request", async () => {
  let calls = 0;
  const model = createGatewayModel("gemini", config, "denied-budget", { reserve: async () => false, settle: async () => assert.fail("There was no usage.") }, async () => { calls++; return googleResponse(); });
  await assert.rejects(generateText({ ...generationPolicy, model, prompt: "Say hello." }), /AI_ALREADY_DISPATCHED/);
  assert.equal(calls, 0);
});

test("provider errors retain reservations and do not bypass Gateway or silently retry", async () => {
  let calls = 0, reservations = 0, settlements = 0;
  const model = createGatewayModel("gemini", config, "provider-failure", { reserve: async () => { reservations++; return true; }, settle: async () => { settlements++; } }, async () => { calls++; return Response.json({ error: { code: 503, message: "Fixture unavailable" } }, { status: 503 }); });
  await assert.rejects(generateText({ ...generationPolicy, model, prompt: "Say hello." }));
  assert.equal(calls, 1); assert.equal(reservations, 1); assert.equal(settlements, 0);
});

test("concurrent generations share the three-request turn ceiling and distinct operation IDs", async () => {
  const operations: string[] = []; let calls = 0;
  const model = createGatewayModel("gemini", config, "bounded-turn", { reserve: async request => { operations.push(request.operationId); return true; }, settle: async () => {} }, async () => { calls++; return googleResponse(); });
  const results = await Promise.allSettled(Array.from({ length: 4 }, () => generateText({ ...generationPolicy, model, prompt: "Say hello." })));
  assert.equal(calls, 3); assert.equal(new Set(operations).size, 3);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 3);
  assert.equal(results.filter(result => result.status === "rejected").length, 1);
});

test("unbounded output is rejected before spending; missing usage holds the reservation", async () => {
  let reserves = 0, settlements = 0;
  const model = createGatewayModel("gemini", config, "usage-bound", { reserve: async () => { reserves++; return true; }, settle: async () => { settlements++; } }, async () => Response.json({ candidates: [{ content: { role: "model", parts: [{ text: "こんにちは。" }] }, finishReason: "STOP" }] }));
  await assert.rejects(generateText({ ...generationPolicy, model, maxOutputTokens: 65_536, prompt: "Say hello." }), /INVALID_AI_OUTPUT_LIMIT/);
  assert.equal(reserves, 0);
  assert.equal((await generateText({ ...generationPolicy, model, prompt: "Say hello." })).text, "こんにちは。");
  assert.equal(reserves, 1); assert.equal(settlements, 0);
});
