import { test } from "node:test";
import assert from "node:assert/strict";
import { generateText } from "ai";
import { actionGateway } from "../packages/backend/convex/lib/ai/service.ts";
import { generationPolicy } from "../packages/backend/convex/lib/ai/providers.ts";

test("an unavailable review source stops inference before both reservation and transport", async () => {
  const settings = {
    AI_CONVERSATION_PROVIDER: "gemini",
    CLOUDFLARE_ACCOUNT_ID: "synthetic-account",
    CLOUDFLARE_GATEWAY_ID: "synthetic-gateway",
    CLOUDFLARE_GATEWAY_TOKEN: "test-only-token",
    GEMINI_API_KEY: "test-only-key",
  };
  const previous = Object.fromEntries(
      Object.keys(settings).map((key) => [key, process.env[key]]),
    ),
    transport = globalThis.fetch;
  let checks = 0,
    reservations = 0,
    requests = 0;
  try {
    Object.assign(process.env, settings);
    globalThis.fetch = async () => {
      requests++;
      throw new Error("Unexpected transport");
    };
    const ctx = {
      runMutation: async () => {
        reservations++;
        return { start: true };
      },
    } as unknown as Parameters<typeof actionGateway>[0];
    const model = actionGateway(
      ctx,
      "reviewSentence.source-guard",
      [],
      async () => {
        checks++;
        return false;
      },
    );
    await assert.rejects(
      generateText({
        ...generationPolicy,
        model,
        prompt: "Synthetic source lifecycle check.",
      }),
    );
    assert.equal(checks, 1);
    assert.equal(reservations, 0);
    assert.equal(requests, 0);
  } finally {
    globalThis.fetch = transport;
    for (const key of Object.keys(settings))
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
  }
});
