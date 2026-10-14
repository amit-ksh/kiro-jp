import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectRecording } from "../packages/learning-core/src/recording.ts";
function box(type: string, ...parts: Uint8Array[]) {
  const body = Buffer.concat(parts),
    out = Buffer.alloc(8 + body.length);
  out.writeUInt32BE(out.length);
  out.write(type, 4);
  body.copy(out, 8);
  return out;
}
function audio(seconds = 2, handler = "soun", codec = "mp4a") {
  const mdhd = Buffer.alloc(24);
  mdhd.writeUInt32BE(48000, 12);
  mdhd.writeUInt32BE(Math.round(seconds * 48000), 16);
  const hdlr = Buffer.alloc(16);
  hdlr.write(handler, 8);
  const stsd = Buffer.alloc(8);
  stsd.writeUInt32BE(1, 4);
  const media = box(
    "mdia",
    box("mdhd", mdhd),
    box("hdlr", hdlr),
    box("minf", box("stbl", box("stsd", stsd, box(codec, Buffer.alloc(28))))),
  );
  return Buffer.concat([
    box("ftyp", Buffer.from("M4A \0\0\0\0isom")),
    box("mdat", Buffer.alloc(20)),
    box("moov", box("trak", media)),
  ]);
}
test("bounded single-track AAC containers expose actual media duration", () => {
  const bytes = audio();
  assert.deepEqual(inspectRecording(bytes), {
    mime: "audio/mp4",
    durationMillis: 2000,
    bytes: bytes.length,
  });
  for (const invalid of [
    audio(31),
    audio(0.1),
    audio(2, "vide"),
    audio(2, "soun", "avc1"),
    bytes.subarray(0, bytes.length - 1),
    Buffer.alloc(2100000),
  ])
    assert.throws(() => inspectRecording(invalid));
  const corrupt = audio();
  corrupt.writeUInt32BE(5, 0);
  assert.throws(() => inspectRecording(corrupt));
});
