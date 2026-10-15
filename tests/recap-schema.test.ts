import { test } from "node:test";
import assert from "node:assert/strict";
import { generateText, Output } from "ai";
import { recapOutputSchema } from "../packages/backend/convex/lib/ai/recap.ts";
import {
  createGatewayModel,
  defaultOpenRouterModel,
  generationPolicy,
} from "../packages/backend/convex/lib/ai/providers.ts";

test("an ended chat with no pending assessment asks the actual SDK for summary only", async () => {
  const model = createGatewayModel(
    "openrouter",
    {
      accountId: "fixture-account",
      gatewayId: "fixture-gateway",
      gatewayToken: "fixture-gateway-token",
      openRouterKey: "fixture-router-key",
    },
    "recap-no-pending",
    {
      reserve: async () => true,
      settle: async () =>
        assert.fail("Free request must not settle Gemini spending."),
    },
    async (_url, init) => {
      const request = JSON.parse(String(init?.body));
      const properties = request.response_format.json_schema.schema.properties;
      assert.deepEqual(Object.keys(properties), ["recap"]);
      return Response.json({
        id: "fixture",
        created: 1,
        model: defaultOpenRouterModel,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: JSON.stringify({
                recap: "You asked whether new books were available.",
              }),
            },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 4, total_tokens: 9 },
      });
    },
  );
  const result = await generateText({
    ...generationPolicy,
    model,
    output: Output.object({ schema: recapOutputSchema([]) }),
    prompt: "Summarize this ended practice. Existing evidence is retained.",
  });
  assert.equal(
    result.output.recap,
    "You asked whether new books were available.",
  );
  assert.equal("assessments" in result.output, false);
});

test("recap assessment schema accepts only immutable pending message IDs and caps their count", () => {
  const schema = recapOutputSchema(["pending-message"]);
  const assessment = {
    validity: "appropriate",
    meaningfulJapanese: true,
    target: "used",
    messageId: "pending-message",
    span: "本はありますか",
    explanation: "An appropriate availability question.",
  };
  assert(
    schema.safeParse({ recap: "A useful question.", assessments: [assessment] })
      .success,
  );
  assert.equal(
    schema.safeParse({
      recap: "A useful question.",
      assessments: [{ ...assessment, messageId: "already-accepted-message" }],
    }).success,
    false,
  );
  assert.equal(
    schema.safeParse({
      recap: "A useful question.",
      assessments: [assessment, assessment],
    }).success,
    false,
  );
  assert.throws(() =>
    recapOutputSchema(Array.from({ length: 7 }, (_, i) => `message-${i}`)),
  );
});
