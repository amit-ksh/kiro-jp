import { test } from "node:test";
import assert from "node:assert/strict";
import {
  boundedSpeechBody,
  decodeSpeechResponse,
  validSpeechSource,
} from "../packages/backend/convex/lib/speechContract.ts";
import { transcribeRecording } from "../packages/backend/convex/lib/ai/speech.ts";

function box(type: string, ...parts: Uint8Array[]) {
  const body = Buffer.concat(parts),
    out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(out.length);
  out.write(type, 4);
  body.copy(out, 8);
  return out;
}
function audio() {
  const mdhd = Buffer.alloc(24);
  mdhd.writeUInt32BE(48000, 12);
  mdhd.writeUInt32BE(96000, 16);
  const hdlr = Buffer.alloc(16);
  hdlr.write("soun", 8);
  const stsd = Buffer.alloc(8);
  stsd.writeUInt32BE(1, 4);
  return Buffer.concat([
    box("ftyp", Buffer.from("M4A \0\0\0\0isom")),
    box("mdat", Buffer.alloc(20)),
    box(
      "moov",
      box(
        "trak",
        box(
          "mdia",
          box("mdhd", mdhd),
          box("hdlr", hdlr),
          box(
            "minf",
            box("stbl", box("stsd", stsd, box("mp4a", Buffer.alloc(28)))),
          ),
        ),
      ),
    ),
  ]);
}
const config = {
  accountId: "test_account",
  gatewayId: "test_gateway",
  gatewayToken: "synthetic_gateway",
  workersToken: "synthetic_workers",
  freeOnlyVerified: true,
};
test("speech transport cannot dispatch without a free-plan confirmation and reservation", async () => {
  let dispatched = 0,
    reserved = 0;
  const transport = (async () => {
    dispatched++;
    throw Error("Unexpected call");
  }) as typeof fetch;
  const reserve = async () => {
    reserved++;
    return true;
  };
  await assert.rejects(
    transcribeRecording(
      audio(),
      { ...config, freeOnlyVerified: false },
      "test.1",
      reserve,
      () => {},
      transport,
    ),
    /FREE_PLAN/,
  );
  await assert.rejects(
    transcribeRecording(
      Buffer.from("corrupt"),
      config,
      "test.1",
      reserve,
      () => {},
      transport,
    ),
  );
  assert.equal(reserved, 0);
  await assert.rejects(
    transcribeRecording(
      audio(),
      config,
      "test.1",
      async () => false,
      () => {},
      transport,
    ),
    /CAPACITY/,
  );
  assert.equal(dispatched, 0);
});
test("Whisper sends original AAC bytes only through its fixed Gateway route", async () => {
  const original = audio();
  let dispatched = 0,
    reserved = 0;
  const result = await transcribeRecording(
    original,
    config,
    "test.2",
    async () => {
      reserved++;
      return true;
    },
    (receipt) => assert.equal(receipt.gatewayLogId, "synthetic-log"),
    (async (url, init) => {
      dispatched++;
      assert.equal(reserved, 1);
      assert.equal(
        url,
        "https://api.cloudflare.com/client/v4/accounts/test_account/ai/run/@cf/openai/whisper-large-v3-turbo",
      );
      assert.equal(init?.redirect, "error");
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("cf-aig-gateway-id"), "test_gateway");
      assert.equal(headers.get("cf-aig-max-attempts"), "1");
      assert.equal(headers.get("cf-aig-collect-log-payload"), "false");
      assert.equal(headers.get("cf-aig-no-wholesale"), "true");
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(Buffer.from(body.audio, "base64"), original);
      assert.equal(body.language, "ja");
      assert.equal(body.task, "transcribe");
      assert.equal(body.vad_filter, true);
      assert.equal(body.initial_prompt, undefined);
      return Response.json(
        {
          success: true,
          result: {
            text: "水をください。",
            segments: [{ text: "水をください。", start: 0, end: 2 }],
          },
        },
        { headers: { "cf-aig-log-id": "synthetic-log" } },
      );
    }) as typeof fetch,
  );
  assert.equal(dispatched, 1);
  assert.equal(result.text, "水をください。");
});
test("missing Gateway receipt, malformed recognition and empty speech stay distinct", async () => {
  let calls = 0;
  await assert.rejects(
    transcribeRecording(
      audio(),
      config,
      "test.3",
      async () => true,
      () => {},
      (async () => {
        calls++;
        return Response.json({ success: true, result: { text: "invented" } });
      }) as typeof fetch,
    ),
    /GATEWAY/,
  );
  assert.equal(calls, 1);
  assert.deepEqual(
    decodeSpeechResponse(
      { success: true, result: { text: "", segments: [] } },
      2000,
    ),
    { text: "", segments: [] },
  );
  for (const raw of [
    { success: false },
    { success: true, result: { text: "x".repeat(1001) } },
    {
      success: true,
      result: { text: "水", segments: [{ text: "水", start: 0, end: 60 }] },
    },
  ])
    assert.throws(() => decodeSpeechResponse(raw, 2000));
});
test("binary upload is bounded even without a Content-Length header", async () => {
  const bytes = audio();
  assert.deepEqual(
    Buffer.from(
      await boundedSpeechBody(
        new Request("https://example.test", {
          method: "POST",
          headers: { "Content-Type": "audio/mp4" },
          body: bytes,
        }),
      ),
    ),
    bytes,
  );
  await assert.rejects(
    boundedSpeechBody(
      new Request("https://example.test", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: bytes,
      }),
    ),
    /UNSUPPORTED/,
  );
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(2 * 1024 * 1024));
      controller.enqueue(new Uint8Array(1));
      controller.close();
    },
  });
  await assert.rejects(
    boundedSpeechBody(
      new Request("https://example.test", {
        method: "POST",
        headers: { "Content-Type": "audio/mp4" },
        body: stream,
        duplex: "half",
      } as RequestInit),
    ),
    /TOO_LARGE/,
  );
  assert(
    validSpeechSource({ lessonSessionId: "session-1", cueId: "word-water" }),
  );
  assert(
    !validSpeechSource({
      lessonSessionId: "session-1",
      conversationSegmentId: "segment-1",
      cueId: "word-water",
    }),
  );
});
