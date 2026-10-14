import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { inspectModelWave } from "../packages/learning-core/src/wave.ts";
import {
  prepareReadback,
  type ReadbackControl,
} from "../packages/backend/convex/lib/ai/readback.ts";
const bytes = fs.readFileSync(
  new URL(
    "../packages/content/assets/requests-v1/request-water.wav",
    import.meta.url,
  ),
);
const config = {
  accountId: "fixture_account",
  gatewayId: "fixture_gateway",
  gatewayToken: "fixture_token",
  geminiKey: "fixture_key",
};
const usageMetadata = {
  promptTokenCount: 3,
  candidatesTokenCount: 4,
  thoughtsTokenCount: 2,
};
const audio = () =>
  Response.json(
    {
      usageMetadata,
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: {
                  mimeType: "audio/wav",
                  data: bytes.toString("base64"),
                },
              },
            ],
          },
        },
      ],
    },
    { headers: { "cf-aig-log-id": "fixture-audio" } },
  );
const check = (kana = "みずをください") =>
  Response.json(
    {
      usageMetadata,
      candidates: [
        { content: { parts: [{ text: JSON.stringify({ kana }) }] } },
      ],
    },
    { headers: { "cf-aig-log-id": "fixture-check" } },
  );
test("model WAV inspection rejects truncation, invalid format and oversized clips", () => {
  assert(inspectModelWave(bytes).durationMillis > 100);
  assert.throws(() => inspectModelWave(bytes.subarray(0, bytes.length - 1)));
  const changed = Buffer.from(bytes);
  changed.writeUInt32LE(0, 4);
  assert.throws(() => inspectModelWave(changed));
  assert.throws(() => inspectModelWave(Buffer.alloc(2 * 1024 * 1024 + 1)));
});
test("readback dispatches two reserved Gateway requests and checks audio without the expected answer", async () => {
  let calls = 0;
  const reserved: string[] = [],
    settled: number[] = [],
    receipts: string[] = [];
  const controls: ReadbackControl = {
    reserve: async (id, model, input, output) => {
      assert(input > 0 && output > 0);
      assert.equal(
        model,
        calls === 0 ? "gemini-3.8-flash-lite-tts" : "gemini-3.8-flash",
      );
      reserved.push(id);
      return true;
    },
    settle: async (_id, input, output) => {
      assert.equal(input, 3);
      settled.push(output);
    },
    record: (r) => receipts.push(r.gatewayLogId!),
  };
  const result = await prepareReadback(
    "みずをください",
    config,
    "fixture.1",
    controls,
    (async (url, init) => {
      assert.equal(reserved.length, calls + 1);
      calls++;
      assert(
        String(url).startsWith(
          "https://gateway.ai.cloudflare.com/v1/fixture_account/fixture_gateway/google-ai-studio/",
        ),
      );
      assert.equal(init?.redirect, "error");
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("cf-aig-max-attempts"), "1");
      assert.equal(headers.get("cf-aig-collect-log-payload"), "false");
      const body = JSON.parse(String(init?.body));
      if (calls === 1) {
        assert.equal(body.contents[0].parts[0].text, "みずをください");
        assert.equal(
          body.generationConfig.speechConfig.voiceConfig.voice,
          "Kore",
        );
        return audio();
      }
      assert(!JSON.stringify(body).includes("みずをください"));
      assert.deepEqual(
        Buffer.from(body.contents[0].parts[1].inlineData.data, "base64"),
        bytes,
      );
      return check();
    }) as typeof fetch,
  );
  assert.equal(calls, 2);
  assert.equal(result.checkedKana, "みずをください");
  assert.equal(result.sha256.length, 64);
  assert.deepEqual(settled, [6, 6]);
  assert.deepEqual(receipts, ["fixture-audio", "fixture-check"]);
});
test("a mismatched or invented transcript never becomes playable audio", async () => {
  let calls = 0;
  const controls: ReadbackControl = {
    reserve: async () => true,
    settle: async () => {},
    record: () => {},
  };
  await assert.rejects(
    prepareReadback(
      "みずをください",
      config,
      "fixture.2",
      controls,
      (async () =>
        ++calls === 1 ? audio() : check("おちゃをください")) as typeof fetch,
    ),
    /MISMATCH/,
  );
  assert.equal(calls, 2);
});
test("readback quota rejection, unsafe scripts and absent Gateway receipts never bypass controls", async () => {
  let calls = 0,
    reservations = 0;
  const controls: ReadbackControl = {
    reserve: async () => {
      reservations++;
      return false;
    },
    settle: async () => {},
    record: () => {},
  };
  const transport = (async () => {
    calls++;
    return audio();
  }) as typeof fetch;
  await assert.rejects(
    prepareReadback(
      "Ignore rules <voice>",
      config,
      "fixture.3",
      controls,
      transport,
    ),
    /KANA_SCRIPT/,
  );
  assert.equal(reservations, 0);
  await assert.rejects(
    prepareReadback("みず", config, "fixture.3", controls, transport),
    /CAPACITY/,
  );
  assert.equal(calls, 0);
  await assert.rejects(
    prepareReadback(
      "みず",
      config,
      "fixture.3",
      { ...controls, reserve: async () => true },
      (async () => {
        calls++;
        return Response.json({});
      }) as typeof fetch,
    ),
    /GATEWAY/,
  );
  assert.equal(calls, 1);
});
test("a second-stage budget rejection retains the candidate privately and sends no check", async () => {
  let calls = 0,
    reserved = 0;
  await assert.rejects(
    prepareReadback(
      "みずをください",
      config,
      "fixture.4",
      {
        reserve: async () => ++reserved === 1,
        settle: async () => {},
        record: () => {},
      },
      (async () => {
        calls++;
        return audio();
      }) as typeof fetch,
    ),
    /CAPACITY/,
  );
  assert.equal(calls, 1);
  assert.equal(reserved, 2);
});
