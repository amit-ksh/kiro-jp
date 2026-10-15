import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkLessonAudio } from "../scripts/lib/check-lesson-audio.mjs";

test("invalid model check results retain bounded diagnostics without approving any clip", async () => {
  const originalFetch = globalThis.fetch;
  for (const content of [
    JSON.stringify([{ id: "word", kana: "ミセ" }]),
    '{"unexpected":true}',
    "[",
    "[null]",
  ]) {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "kiro-audio-check-"),
    );
    try {
      const clip = { id: "word", text: "みせ" };
      fs.writeFileSync(
        path.join(directory, "word.wav"),
        new Uint8Array([1, 2]),
      );
      fs.writeFileSync(
        path.join(directory, "word.json"),
        JSON.stringify({
          ...clip,
          sha256: "fixture-audio-hash",
          languageCheck: "pending",
        }),
      );
      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            candidates: [
              { finishReason: "STOP", content: { parts: [{ text: content }] } },
            ],
          }),
          { status: 200 },
        );
      const client = { mutation: async () => ({ start: true }) };
      await assert.rejects(
        checkLessonAudio({ client, env: {}, directory, clips: [clip] }),
      );
      const receipt = JSON.parse(
        fs.readFileSync(
          path.join(directory, ".audio-check-failure.json"),
          "utf8",
        ),
      );
      assert.equal(receipt.code, "INVALID_AUDIO_CHECK_RESPONSE");
      assert.equal(receipt.responseReceived, true);
      assert.equal(receipt.finishReason, "STOP");
      assert(receipt.operationId.startsWith("lesson-audio-check-"));
      assert(JSON.stringify(receipt).length < 5000);
      assert.equal(
        JSON.parse(fs.readFileSync(path.join(directory, "word.json"), "utf8"))
          .languageCheck,
        "pending",
      );
    } finally {
      globalThis.fetch = originalFetch;
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

test("a well-formed different transcript remains unapproved rather than being coerced into a matching answer", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "kiro-audio-check-")),
    originalFetch = globalThis.fetch;
  try {
    const clip = { id: "word", text: "みせ" };
    fs.writeFileSync(path.join(directory, "word.wav"), new Uint8Array([1, 2]));
    fs.writeFileSync(
      path.join(directory, "word.json"),
      JSON.stringify({
        ...clip,
        sha256: "fixture-audio-hash",
        languageCheck: "pending",
      }),
    );
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  { text: JSON.stringify([{ id: "word", kana: "みず" }]) },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      );
    const result = await checkLessonAudio({
      client: { mutation: async () => ({ start: true }) },
      env: {},
      directory,
      clips: [clip],
    });
    assert.deepEqual(result, [{ id: "word", status: "needs-audio-review" }]);
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(directory, "word.json"), "utf8"))
        .languageCheck.matches,
      false,
    );
  } finally {
    globalThis.fetch = originalFetch;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("an existing audio-check reservation cannot dispatch or replace another inference", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "kiro-audio-check-"));
  const originalFetch = globalThis.fetch;
  try {
    fs.writeFileSync(
      path.join(directory, "word.json"),
      JSON.stringify({
        id: "word",
        text: "みせ",
        sha256: "fixture-audio-hash",
        languageCheck: "pending",
      }),
    );
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      throw Error("must not dispatch");
    };
    await assert.rejects(
      checkLessonAudio({
        client: { mutation: async () => ({ start: false }) },
        env: {},
        directory,
        clips: [{ id: "word", text: "みせ" }],
      }),
      /CHECK_ALREADY_DISPATCHED/,
    );
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
