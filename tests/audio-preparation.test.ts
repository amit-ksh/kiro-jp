import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { inspectWav } from "../scripts/lib/wav.mjs";
function wave() {
  const data = 24000,
    bytes = Buffer.alloc(44 + data);
  bytes.write("RIFF");
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVE", 8);
  bytes.write("fmt ", 12);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(24000, 24);
  bytes.writeUInt32LE(48000, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(data, 40);
  return bytes;
}
test("audio inspection accepts a complete wave and rejects truncated containers and invalid format chunks", () => {
  assert.deepEqual(inspectWav(wave()), { seconds: 0.5, sampleRate: 24000 });
  assert.throws(() => inspectWav(wave().subarray(0, 60)));
  const malformed = wave();
  malformed.writeUInt32LE(4, 16);
  assert.throws(() => inspectWav(malformed));
  const silentDuration = wave();
  silentDuration.writeUInt32LE(0, 28);
  assert.throws(() => inspectWav(silentDuration));
  const oversizedChunk = wave();
  oversizedChunk.writeUInt32LE(100000, 40);
  assert.throws(() => inspectWav(oversizedChunk));
});
test("audio CLI version and rejected input run before private configuration or inference dependencies", () => {
  const script = fileURLToPath(
    new URL("../scripts/prepare-lesson-audio.mjs", import.meta.url),
  );
  for (const flag of ["--version", "-v", "-V"]) {
    const result = spawnSync(process.execPath, [script, flag], {
      cwd: tmpdir(),
      encoding: "utf8",
    });
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), "1.1.0");
    assert.equal(result.stderr, "");
  }
  const invalid = spawnSync(process.execPath, [script, "--generte"], {
    cwd: tmpdir(),
    encoding: "utf8",
  });
  assert.equal(invalid.status, 2);
  assert.match(invalid.stdout, /Invalid input/u);
  assert.equal(invalid.stderr, "");
  const limit = spawnSync(process.execPath, [script, "--limit", "999"], {
    cwd: tmpdir(),
    encoding: "utf8",
  });
  assert.equal(limit.status, 2);
  assert.match(limit.stdout, /between 1 and 100/u);
  const mixed = spawnSync(process.execPath, [script, "--check", "--dry-run"], {
    cwd: tmpdir(),
    encoding: "utf8",
  });
  assert.equal(mixed.status, 2);
  assert.match(mixed.stdout, /exactly one mode/u);
  assert.equal(mixed.stderr, "");
  for (const args of [["--generate","--attempt","4"],["--check","--attempt","2"],["--lesson","../other"],["--lesson","directions","--lesson","requests"]]) {
    const result=spawnSync(process.execPath,[script,...args],{cwd:tmpdir(),encoding:"utf8"});assert.equal(result.status,2);assert.equal(result.stderr,"");
  }
});
