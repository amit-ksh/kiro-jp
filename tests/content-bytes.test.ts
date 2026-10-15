import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readContentBytes,
  type ContentReader,
} from "../apps/native/src/data/contentBytes.ts";
test("download bytes are owned before a producer reuses its buffer or cancellation releases it", async () => {
  const shared = new Uint8Array(4);
  let at = 0,
    cancelled = 0;
  const reader: ContentReader = {
    read: async () => {
      if (at === 2) return { done: true };
      shared.set(at++ === 0 ? [9, 1, 2, 9] : [9, 3, 4, 9]);
      return { done: false, value: shared.subarray(1, 3) };
    },
    cancel: async () => {
      shared.fill(0);
      cancelled++;
    },
  };
  assert.deepEqual(
    [...(await readContentBytes(reader, 4, () => true))],
    [1, 2, 3, 4],
  );
  assert.equal(cancelled, 1);
});
test("partial, oversized and invalid-length downloads cannot produce a complete content file", async () => {
  for (const [size, parts] of [
    [4, [[1, 2]]],
    [2, [[1, 2, 3]]],
  ] as const) {
    let at = 0,
      cancelled = 0;
    const reader = {
      read: async () =>
        at < parts.length
          ? { done: false, value: new Uint8Array(parts[at++]!) }
          : { done: true },
      cancel: async () => {
        cancelled++;
      },
    };
    await assert.rejects(readContentBytes(reader, size, () => true));
    assert.equal(cancelled, 1);
  }
  for (const size of [0, -1, 1.5, 2_000_001, Infinity]) {
    let reads = 0;
    await assert.rejects(
      readContentBytes(
        {
          read: async () => {
            reads++;
            return { done: true };
          },
          cancel: async () => {},
        },
        size,
        () => true,
      ),
    );
    assert.equal(reads, 0);
  }
});
test("account cancellation before or during a read aborts without accepting bytes", async () => {
  for (const initiallyCurrent of [false, true]) {
    let valid = initiallyCurrent,
      reads = 0,
      cancelled = 0;
    const reader = {
      read: async () => {
        reads++;
        valid = false;
        return { done: false, value: new Uint8Array([1]) };
      },
      cancel: async () => {
        cancelled++;
      },
    };
    await assert.rejects(
      readContentBytes(reader, 1, () => valid),
      /interrupted/,
    );
    assert.equal(reads, initiallyCurrent ? 1 : 0);
    assert.equal(cancelled, 1);
  }
});
test("reader failure remains observable even when native cancellation also fails", async () => {
  const original = new Error("synthetic stream failed");
  let cancelled = 0;
  await assert.rejects(
    readContentBytes(
      {
        read: async () => {
          throw original;
        },
        cancel: async () => {
          cancelled++;
          throw new Error("cleanup failed");
        },
      },
      3,
      () => true,
    ),
    (error) => error === original,
  );
  assert.equal(cancelled, 1);
});
