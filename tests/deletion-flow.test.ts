import { test } from "node:test";
import assert from "node:assert/strict";
import { sqliteDirectoryUri } from "../apps/native/src/data/localPaths.ts";
import {
  advanceDeletion,
  parseDeletionIntent,
} from "../apps/native/src/features/auth/deletionFlow.ts";

test("native SQLite paths become absolute file URIs without reinterpreting percent-encoded account scope names", () => {
  assert.equal(
    sqliteDirectoryUri(
      "/data/ExperienceData/%40anonymous%2Fapp with space/SQLite",
    ),
    "file:///data/ExperienceData/%2540anonymous%252Fapp%20with%20space/SQLite",
  );
  assert.equal(
    sqliteDirectoryUri("file:///data/ExperienceData/%2540anonymous/SQLite"),
    "file:///data/ExperienceData/%2540anonymous/SQLite",
  );
  for (const value of [
    "relative/SQLite",
    "https://other/SQLite",
    "content://other/SQLite",
    "file://other/SQLite",
  ])
    assert.throws(() => sqliteDirectoryUri(value));
});
test("a lost deletion acknowledgement recovers by receipt without needing the revoked login", async () => {
  let submitted = false,
    cleaned = 0,
    completed = 0,
    requests = 0;
  const ports = {
    status: async () => (submitted ? { status: "pending" as const } : null),
    request: async () => {
      submitted = true;
      requests++;
      throw new Error("response lost");
    },
    cleanup: async () => {
      cleaned++;
    },
    complete: async () => {
      completed++;
    },
  };
  await assert.rejects(advanceDeletion(ports), /response lost/u);
  assert.equal(cleaned, 0);
  assert.equal(await advanceDeletion(ports), "pending");
  assert.equal(requests, 1);
  assert.equal(cleaned, 1);
  assert.equal(completed, 0);
  assert.equal(
    await advanceDeletion({
      ...ports,
      status: async () => ({ status: "complete" }),
    }),
    "complete",
  );
  assert.equal(requests, 1);
  assert.equal(completed, 1);
});
test("cloud completion cannot hide a failed local cleanup", async () => {
  let finished = false;
  const ports = {
    status: async () => ({ status: "complete" as const }),
    request: async () => {
      throw new Error("must not resubmit");
    },
    cleanup: async () => {
      throw new Error("busy storage");
    },
    complete: async () => {
      finished = true;
    },
  };
  await assert.rejects(advanceDeletion(ports), /busy storage/u);
  assert.equal(finished, false);
  assert.equal(
    await advanceDeletion({ ...ports, cleanup: async () => {} }),
    "complete",
  );
  assert.equal(finished, true);
});
test("an unavailable receipt lookup never starts a second request or claims cleanup", async () => {
  const never = async () => {
    throw new Error("must not execute");
  };
  await assert.rejects(
    advanceDeletion({
      status: async () => {
        throw new Error("offline");
      },
      request: never,
      cleanup: never,
      complete: never,
    }),
    /offline/u,
  );
});
test("deletion recovery accepts only a supported intent with an opaque owner and full random receipt", () => {
  const value = {
    version: 1,
    accountId: "syntheticOwner",
    receipt: "a".repeat(64),
    phase: "requested",
  };
  assert.deepEqual(parseDeletionIntent(JSON.stringify(value)), value);
  for (const patch of [
    { version: 2 },
    { accountId: "../../other" },
    { accountId: "" },
    { receipt: "a".repeat(63) },
    { receipt: "not-random" },
    { phase: "canceled" },
  ])
    assert.throws(() =>
      parseDeletionIntent(JSON.stringify({ ...value, ...patch })),
    );
});
